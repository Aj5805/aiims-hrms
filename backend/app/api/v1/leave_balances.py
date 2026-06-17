"""Leave balances — opening entry, import, ledger, projections, annual credit, carry-forward, manual adjust."""

import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from openpyxl import load_workbook
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, employee_scope, require_role
from app.core.database import get_db

router = APIRouter(prefix="/leave-balances", tags=["leave-balances"])


# ── Phase 3: Opening Balances ───────────────────────────────────────────────

@router.post("/opening")
async def bulk_opening_balance(
    body: list[dict],
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    """Accepts array of {emp_code, leave_type_code, opening_balance}. Idempotent."""
    results = []
    for item in body:
        emp_code = item["emp_code"]
        lt_code = item["leave_type_code"]
        balance = item["opening_balance"]

        emp = await db.execute(text("SELECT e.id, c.leave_scheme, e.doj FROM employees e JOIN employee_categories c ON e.category_id = c.id WHERE e.emp_code = :ec"), {"ec": emp_code})
        emp_row = emp.fetchone()
        if not emp_row:
            results.append({"emp_code": emp_code, "status": "error", "message": "Employee not found"})
            continue

        lt = await db.execute(text("SELECT id FROM leave_types WHERE code = :c"), {"c": lt_code})
        lt_row = lt.fetchone()
        if not lt_row:
            results.append({"emp_code": emp_code, "status": "error", "message": f"Unknown leave type: {lt_code}"})
            continue

        scheme = emp_row.leave_scheme
        leave_year = 2026
        if scheme == "CCS":
            year_start = date(leave_year, 4, 1)
        else:
            doj = emp_row.doj
            year_start = date(leave_year, doj.month, doj.day)

        existing = await db.execute(text("""
            SELECT id FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid AND leave_year = :ly
        """), {"eid": str(emp_row.id), "lid": str(lt_row[0]), "ly": leave_year})
        ex_row = existing.fetchone()

        if ex_row:
            await db.execute(text("UPDATE leave_balances SET opening_balance = :bal, credited = 0, availed = 0, last_updated = now() WHERE id = :id"), {"bal": balance, "id": str(ex_row[0])})
        else:
            await db.execute(text("""
                INSERT INTO leave_balances (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
                VALUES (uuid_generate_v4(), :eid, :lid, :ly, :ysd, :bal, 0)
            """), {"eid": str(emp_row.id), "lid": str(lt_row[0]), "ly": leave_year, "ysd": year_start, "bal": balance})
        results.append({"emp_code": emp_code, "leave_type": lt_code, "status": "ok"})

    await db.commit()
    return {"processed": len(results), "results": results}


@router.post("/opening/import")
async def import_opening_balances(
    file: UploadFile,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    """Excel import. Columns: emp_code, leave_type_code, opening_balance."""
    content = await file.read()
    wb = load_workbook(io.BytesIO(content), read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    payload = []
    for row in rows:
        if not row[0]:
            continue
        payload.append({"emp_code": str(row[0]).strip(), "leave_type_code": str(row[1]).strip() if row[1] else "", "opening_balance": float(row[2]) if row[2] else 0})
    return await bulk_opening_balance(payload, _=_, db=db)


# ── Phase 5: Balance Accounts ───────────────────────────────────────────────

@router.get("/{employee_id}")
async def get_balances(employee_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT lb.*, lt.code AS leave_type_code, lt.name AS leave_type_name, lt.max_accumulation
        FROM leave_balances lb JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.employee_id = :eid AND lb.leave_year = 2026 ORDER BY lt.code
    """), {"eid": employee_id})
    balances = [dict(r._mapping) for r in result.fetchall()]
    return {"employee_id": employee_id, "balances": balances}


@router.get("/{employee_id}/ledger/{leave_type_id}")
async def get_ledger(employee_id: str, leave_type_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    bal = await db.execute(text("SELECT * FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid ORDER BY leave_year"), {"eid": employee_id, "lid": leave_type_id})
    balances = [dict(r._mapping) for r in bal.fetchall()]
    apps = await db.execute(text("SELECT app_number, leave_type_id, from_date, to_date, applied_days, status FROM leave_applications WHERE employee_id = :eid AND leave_type_id = :lid AND status IN ('APPROVED','RECALLED') ORDER BY from_date"), {"eid": employee_id, "lid": leave_type_id})
    transactions = [dict(r._mapping) for r in apps.fetchall()]
    return {"employee_id": employee_id, "leave_type_id": leave_type_id, "balances": balances, "transactions": transactions}


@router.get("/{employee_id}/project")
async def project_balance(employee_id: str, from_date: str = Query(), to_date: str = Query(), leave_type_code: str = Query(), current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lt = await db.execute(text("SELECT id FROM leave_types WHERE code = :c"), {"c": leave_type_code})
    lt_row = lt.fetchone()
    if not lt_row:
        raise HTTPException(status_code=400, detail=f"Unknown leave type: {leave_type_code}")
    lt_id = str(lt_row[0])
    bal = await db.execute(text("SELECT closing_balance FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid ORDER BY leave_year DESC LIMIT 1"), {"eid": employee_id, "lid": lt_id})
    bal_row = bal.fetchone()
    current = float(bal_row[0]) if bal_row else 0
    fd = date.fromisoformat(from_date)
    td = date.fromisoformat(to_date)
    holidays_result = await db.execute(text("SELECT holiday_date FROM holiday_master WHERE holiday_date BETWEEN :f AND :t"), {"f": fd, "t": td})
    holiday_dates = {r[0] for r in holidays_result.fetchall()}
    days = sum(1 for d in [(fd + date.resolution * i) for i in range((td - fd).days + 1)] if d.weekday() < 5 and d not in holiday_dates)
    return {"current_balance": current, "requested_days": days, "projected_balance": max(0, current - days)}


@router.post("/credit/annual")
async def annual_credit_run(body: dict, _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")), db: AsyncSession = Depends(get_db)):
    year_start = date.fromisoformat(body["year_start"])
    leave_year = body["leave_year"]
    result = await db.execute(text("""
        INSERT INTO leave_balances (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
        SELECT uuid_generate_v4(), e.id, lt.id, :ly, :ys::date,
               COALESCE((SELECT closing_balance FROM leave_balances WHERE employee_id = e.id AND leave_type_id = lt.id AND leave_year = :ly - 1), 0),
               COALESCE(ler.days_per_year, 0)
        FROM employees e JOIN employee_categories c ON e.category_id = c.id
        JOIN leave_entitlement_rules ler ON ler.category_id = c.id
        JOIN leave_types lt ON ler.leave_type_id = lt.id
        WHERE lt.is_accumulating = true AND c.leave_scheme = 'CCS'
          AND NOT EXISTS (SELECT 1 FROM leave_balances lb2 WHERE lb2.employee_id = e.id AND lb2.leave_type_id = lt.id AND lb2.leave_year = :ly)
    """), {"ly": leave_year, "ys": year_start})
    await db.commit()
    return {"message": f"Annual credit run complete for {leave_year}", "rows_affected": result.rowcount}


@router.post("/carryforward")
async def carry_forward_run(body: dict, _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")), db: AsyncSession = Depends(get_db)):
    source_year = body["source_year"]
    target_year = body["target_year"]
    result = await db.execute(text("""
        INSERT INTO leave_balances (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance)
        SELECT uuid_generate_v4(), lb.employee_id, lb.leave_type_id, :ty, :ys::date,
               LEAST(COALESCE(lt.max_accumulation, 300), lb.closing_balance)
        FROM leave_balances lb JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.leave_year = :sy AND lt.carry_forward = true AND lt.code = 'EL'
          AND NOT EXISTS (SELECT 1 FROM leave_balances lb2 WHERE lb2.employee_id = lb.employee_id AND lb2.leave_type_id = lb.leave_type_id AND lb2.leave_year = :ty)
    """), {"sy": source_year, "ty": target_year, "ys": date(target_year, 4, 1)})
    await db.commit()
    return {"message": f"Carry-forward complete", "rows_affected": result.rowcount}


@router.put("/{balance_id}/manual-adjust")
async def manual_adjust(balance_id: str, body: dict, current_user: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")), db: AsyncSession = Depends(get_db)):
    reason = body.get("reason")
    if not reason:
        raise HTTPException(status_code=400, detail="Reason required")
    amount = body.get("amount", 0)
    field = body.get("field", "credited")
    await db.execute(text(f"UPDATE leave_balances SET {field} = {field} + :amt, last_updated = now() WHERE id = :bid"), {"amt": amount, "bid": balance_id})
    await db.execute(text("INSERT INTO audit_log (id, actor_id, entity_type, entity_id, action, before_state, after_state) VALUES (uuid_generate_v4(), :aid, 'leave_balance', :bid, 'UPDATE', '{}', :reason::jsonb)"), {"aid": current_user["user_id"], "bid": balance_id, "reason": f'{{"reason":"{reason}","field":"{field}","amount":{amount}}}'})
    await db.commit()
    return {"message": "Adjusted", "reason": reason}
