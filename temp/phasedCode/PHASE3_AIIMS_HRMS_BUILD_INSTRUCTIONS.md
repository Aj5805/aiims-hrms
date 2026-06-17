# AIIMS HRMS — Phase 3: Leave Configuration & Opening Balances

> **For AI agent consumption.** Each section = one file. Place at path.
> **Prerequisite:** Phase 2 (Auth + Employee Master) must be complete.

---

## PHASE 3 SCOPE

### Backend (6 new route files)
- `GET/POST/PUT /leave-types` — leave type CRUD
- `GET/POST/PUT /leave-entitlement-rules` — entitlement rules per category×leave type
- `GET/POST/PUT/DELETE /holiday-master` — holiday CRUD by year
- `GET/POST/PUT /workflow-configs` + steps CRUD + `POST /simulate` for routing preview
- `POST /leave-balances/opening` (bulk JSON) + `/opening/import` (Excel via openpyxl)

### Frontend (3 files)
- Phase 3 API endpoints wrapper
- 5 pages: Leave Types, Entitlement Rules, Holiday Master, Workflow Configurator (with simulate), Opening Balances (JSON + Excel import)
- Updated App.tsx with all Phase 3 routes in navbar

### OVERWRITES
- `backend/app/api/v1/__init__.py` — registers new routers
- `frontend/src/App.tsx` — adds Phase 3 nav + routes

---

### FILE: `backend/app/api/v1/__init__.py`

⚠️ **OVERWRITE**

```python
"""API v1 router — registers all route modules (Phases 2 + 3)."""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.employees import router as employees_router
from app.api.v1.departments import router as departments_router
from app.api.v1.designations import router as designations_router
from app.api.v1.users import router as users_router
from app.api.v1.leave_types import router as leave_types_router
from app.api.v1.leave_entitlement_rules import router as entitlement_router
from app.api.v1.holiday_master import router as holiday_router
from app.api.v1.workflow_configs import router as workflow_router
from app.api.v1.leave_balances import router as balances_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(employees_router)
router.include_router(departments_router)
router.include_router(designations_router)
router.include_router(users_router)
router.include_router(leave_types_router)
router.include_router(entitlement_router)
router.include_router(holiday_router)
router.include_router(workflow_router)
router.include_router(balances_router)


@router.get("/ping")
async def ping():
    return {"ping": "pong"}
```

---

### FILE: `backend/app/api/v1/leave_types.py`

```python
"""Leave types CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/leave-types", tags=["leave-types"])


@router.get("")
async def list_leave_types(
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "DEAN_ACADEMIC", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("SELECT * FROM leave_types ORDER BY code"))
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("", status_code=201)
async def create_leave_type(
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    lid = str(uuid.uuid4())
    cols = ["id", "code", "name", "scheme", "is_accumulating", "max_accumulation",
            "requires_mc", "min_days_for_mc", "count_holidays", "is_half_day_allowed",
            "carry_forward", "encashable"]
    vals = {c: body.get(c) for c in cols if c != "id"}
    vals["id"] = lid
    placeholders = ", ".join(f":{c}" for c in cols)
    await db.execute(
        text(f"INSERT INTO leave_types ({', '.join(cols)}) VALUES ({placeholders})"), vals)
    await db.commit()
    result = await db.execute(text("SELECT * FROM leave_types WHERE id = :id"), {"id": lid})
    return dict(result.fetchone()._mapping)


@router.put("/{leave_type_id}")
async def update_leave_type(
    leave_type_id: str, body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    editable = ["name", "is_accumulating", "max_accumulation", "requires_mc",
                "min_days_for_mc", "count_holidays", "is_half_day_allowed",
                "carry_forward", "encashable", "validation_rules"]
    updates = {k: v for k, v in body.items() if k in editable}
    if not updates:
        raise HTTPException(status_code=400, detail="No editable fields")
    set_c = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = leave_type_id
    await db.execute(text(f"UPDATE leave_types SET {set_c} WHERE id = :id"), updates)
    await db.commit()
    result = await db.execute(text("SELECT * FROM leave_types WHERE id = :id"), {"id": leave_type_id})
    return dict(result.fetchone()._mapping)
```

---

### FILE: `backend/app/api/v1/leave_entitlement_rules.py`

```python
"""Leave entitlement rules routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/leave-entitlement-rules", tags=["entitlement-rules"])


@router.get("")
async def list_rules(
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "DEAN_ACADEMIC", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT r.*, c.code AS category_code, lt.code AS leave_type_code
        FROM leave_entitlement_rules r
        JOIN employee_categories c ON r.category_id = c.id
        JOIN leave_types lt ON r.leave_type_id = lt.id
        ORDER BY c.code, lt.code
    """))
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("", status_code=201)
async def create_rule(
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    cat = await db.execute(text("SELECT id FROM employee_categories WHERE code = :c"), {"c": body["category_code"]})
    c_row = cat.fetchone()
    if not c_row:
        raise HTTPException(status_code=400, detail="Unknown category")
    lt = await db.execute(text("SELECT id FROM leave_types WHERE code = :c"), {"c": body["leave_type_code"]})
    lt_row = lt.fetchone()
    if not lt_row:
        raise HTTPException(status_code=400, detail="Unknown leave type")

    rid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO leave_entitlement_rules
            (id, category_id, leave_type_id, year_ref, days_per_year, prorata_rate,
             year1_days, year2_plus_days, max_at_a_stretch, max_in_tenure, carry_forward, special_rules)
        VALUES (:id, :cid, :lid, :yr, :dpy, :pr, :y1, :y2, :ms, :mt, :cf, :sr::jsonb)
    """), {
        "id": rid, "cid": str(c_row[0]), "lid": str(lt_row[0]),
        "yr": body.get("year_ref", "FINANCIAL"),
        "dpy": body.get("days_per_year"), "pr": body.get("prorata_rate"),
        "y1": body.get("year1_days"), "y2": body.get("year2_plus_days"),
        "ms": body.get("max_at_a_stretch"), "mt": body.get("max_in_tenure"),
        "cf": body.get("carry_forward", False), "sr": body.get("special_rules"),
    })
    await db.commit()
    return {"id": rid, "message": "Created"}


@router.put("/{rule_id}")
async def update_rule(
    rule_id: str, body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    editable = ["days_per_year", "prorata_rate", "year1_days", "year2_plus_days",
                "max_at_a_stretch", "max_in_tenure", "carry_forward"]
    updates = {k: v for k, v in body.items() if k in editable}
    if not updates:
        raise HTTPException(status_code=400, detail="No editable fields")
    set_c = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = rule_id
    await db.execute(text(f"UPDATE leave_entitlement_rules SET {set_c} WHERE id = :id"), updates)
    await db.commit()
    return {"message": "Updated"}
```

---

### FILE: `backend/app/api/v1/holiday_master.py`

```python
"""Holiday master routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/holiday-master", tags=["holiday-master"])


@router.get("")
async def list_holidays(
    year: int = Query(None),
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "DEAN_ACADEMIC", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    query = "SELECT * FROM holiday_master"
    params = {}
    if year:
        query += " WHERE year = :year"
        params["year"] = year
    query += " ORDER BY holiday_date"
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("", status_code=201)
async def create_holiday(
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    hid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO holiday_master (id, year, holiday_date, holiday_name, holiday_type, applicable_to)
        VALUES (:id, :year, :date, :name, :type, :app)
    """), {
        "id": hid, "year": body["year"], "date": body["holiday_date"],
        "name": body["holiday_name"], "type": body["holiday_type"],
        "app": body.get("applicable_to", "ALL"),
    })
    await db.commit()
    result = await db.execute(text("SELECT * FROM holiday_master WHERE id = :id"), {"id": hid})
    return dict(result.fetchone()._mapping)


@router.put("/{holiday_id}")
async def update_holiday(
    holiday_id: str, body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    editable = ["holiday_name", "holiday_type", "applicable_to"]
    updates = {k: v for k, v in body.items() if k in editable}
    if not updates:
        raise HTTPException(status_code=400, detail="No editable fields")
    set_c = ", ".join(f"{k} = :{k}" for k in updates)
    updates["id"] = holiday_id
    await db.execute(text(f"UPDATE holiday_master SET {set_c} WHERE id = :id"), updates)
    await db.commit()
    result = await db.execute(text("SELECT * FROM holiday_master WHERE id = :id"), {"id": holiday_id})
    return dict(result.fetchone()._mapping)


@router.delete("/{holiday_id}")
async def delete_holiday(
    holiday_id: str,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(text("DELETE FROM holiday_master WHERE id = :id"), {"id": holiday_id})
    await db.commit()
    return {"message": "Deleted"}
```

---

### FILE: `backend/app/api/v1/workflow_configs.py`

```python
"""Workflow config API — CRUD + simulate."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db

router = APIRouter(prefix="/workflow-configs", tags=["workflow-configs"])


@router.get("")
async def list_configs(
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("SELECT * FROM workflow_configs ORDER BY config_name"))
    configs = []
    for r in result.fetchall():
        cfg = dict(r._mapping)
        steps_result = await db.execute(
            text("SELECT * FROM workflow_steps WHERE config_id = :cid ORDER BY step_order"),
            {"cid": cfg["id"]})
        cfg["steps"] = [dict(s._mapping) for s in steps_result.fetchall()]
        configs.append(cfg)
    return configs


@router.post("", status_code=201)
async def create_config(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workflow_configs (id, config_name, category_id, leave_type_id, min_days, max_days, created_by)
        VALUES (:id, :name, NULL, NULL, :min_d, :max_d, :cb)
    """), {
        "id": cid, "name": body["config_name"],
        "min_d": body.get("min_days", 1), "max_d": body.get("max_days"),
        "cb": current_user["user_id"],
    })
    await db.commit()
    return {"id": cid, "message": "Created"}


@router.put("/{config_id}")
async def update_config(
    config_id: str, body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    editable = ["config_name", "min_days", "max_days", "is_active"]
    updates = {k: v for k, v in body.items() if k in editable}
    if updates:
        set_c = ", ".join(f"{k} = :{k}" for k in updates)
        updates["id"] = config_id
        await db.execute(text(f"UPDATE workflow_configs SET {set_c}, version = version + 1 WHERE id = :id"), updates)
        await db.commit()
    return {"message": "Updated"}


@router.post("/{config_id}/steps", status_code=201)
async def add_step(
    config_id: str, body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    sid = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO workflow_steps (id, config_id, step_order, approver_role, approver_office, sla_hours, is_final_authority)
        VALUES (:id, :cid, :so, :role, :office, :sla, :final)
    """), {
        "id": sid, "cid": config_id, "so": body["step_order"],
        "role": body["approver_role"], "office": body.get("approver_office"),
        "sla": body.get("sla_hours", 48), "final": body.get("is_final_authority", False),
    })
    await db.commit()
    return {"id": sid, "message": "Step added"}


@router.put("/{config_id}/steps/{step_id}")
async def update_step(
    config_id: str, step_id: str, body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    editable = ["step_order", "approver_role", "approver_office", "sla_hours", "is_final_authority", "skip_if_self_applicant"]
    updates = {k: v for k, v in body.items() if k in editable}
    if updates:
        set_c = ", ".join(f"{k} = :{k}" for k in updates)
        updates["id"] = step_id
        await db.execute(text(f"UPDATE workflow_steps SET {set_c} WHERE id = :id AND config_id = :cid"), {**updates, "cid": config_id})
        await db.commit()
    return {"message": "Updated"}


@router.delete("/{config_id}/steps/{step_id}")
async def delete_step(
    config_id: str, step_id: str,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(text("DELETE FROM workflow_steps WHERE id = :id AND config_id = :cid"), {"id": step_id, "cid": config_id})
    await db.commit()
    return {"message": "Deleted"}


@router.post("/simulate")
async def simulate_workflow(
    body: dict,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    """Given category_code, leave_type_code, and days, return the matching workflow chain."""
    cat_code = body.get("category_code")
    lt_code = body.get("leave_type_code")
    days = int(body.get("days", 1))

    query = """
        SELECT wc.* FROM workflow_configs wc
        LEFT JOIN employee_categories c ON wc.category_id = c.id
        LEFT JOIN leave_types lt ON wc.leave_type_id = lt.id
        WHERE wc.is_active = true
          AND (wc.category_id IS NULL OR c.code = :cat)
          AND (wc.leave_type_id IS NULL OR lt.code = :lt)
          AND wc.min_days <= :days
          AND (wc.max_days IS NULL OR wc.max_days >= :days)
        ORDER BY
          (CASE WHEN wc.category_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
          (CASE WHEN wc.leave_type_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
          wc.min_days DESC
        LIMIT 1
    """
    result = await db.execute(text(query), {"cat": cat_code, "lt": lt_code, "days": days})
    cfg = result.fetchone()
    if not cfg:
        return {"matched": False, "message": "No workflow config matched"}

    cfg_dict = dict(cfg._mapping)
    steps = await db.execute(
        text("SELECT * FROM workflow_steps WHERE config_id = :cid ORDER BY step_order"),
        {"cid": cfg_dict["id"]})
    cfg_dict["steps"] = [dict(s._mapping) for s in steps.fetchall()]
    return {"matched": True, "config": cfg_dict}
```

---

### FILE: `backend/app/api/v1/leave_balances.py`

```python
"""Leave balances — opening balance entry + import."""

import io
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from openpyxl import load_workbook

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/leave-balances", tags=["leave-balances"])


@router.post("/opening")
async def bulk_opening_balance(
    body: list[dict],
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    """
    Accepts array of {emp_code, leave_type_code, opening_balance}.
    Idempotent — re-run safe, duplicate = update not insert.
    """
    results = []
    for item in body:
        emp_code = item["emp_code"]
        lt_code = item["leave_type_code"]
        balance = item["opening_balance"]

        emp = await db.execute(text("SELECT e.id, e.category_id, e.doj, c.leave_scheme FROM employees e JOIN employee_categories c ON e.category_id = c.id WHERE e.emp_code = :ec"), {"ec": emp_code})
        emp_row = emp.fetchone()
        if not emp_row:
            results.append({"emp_code": emp_code, "status": "error", "message": "Employee not found"})
            continue

        lt = await db.execute(text("SELECT id FROM leave_types WHERE code = :c"), {"c": lt_code})
        lt_row = lt.fetchone()
        if not lt_row:
            results.append({"emp_code": emp_code, "status": "error", "message": f"Unknown leave type: {lt_code}"})
            continue

        # Compute year_start_date
        scheme = emp_row.leave_scheme
        if scheme == "CCS":
            year_start = f"{2026}-04-01"
            leave_year = 2026
        else:
            # Residency: joining-date anniversary
            doj = emp_row.doj
            year_start = f"2026-{doj.month:02d}-{doj.day:02d}"
            leave_year = 2026

        # Upsert
        existing = await db.execute(text("""
            SELECT id FROM leave_balances
            WHERE employee_id = :eid AND leave_type_id = :lid AND leave_year = :ly
        """), {"eid": str(emp_row.id), "lid": str(lt_row[0]), "ly": leave_year})
        ex_row = existing.fetchone()

        if ex_row:
            await db.execute(text("""
                UPDATE leave_balances SET opening_balance = :bal, credited = :bal, last_updated = now()
                WHERE id = :id
            """), {"bal": balance, "id": str(ex_row[0])})
        else:
            bid = str(uuid.uuid4())
            await db.execute(text("""
                INSERT INTO leave_balances (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
                VALUES (:id, :eid, :lid, :ly, :ysd::date, :bal, :bal)
            """), {
                "id": bid, "eid": str(emp_row.id), "lid": str(lt_row[0]),
                "ly": leave_year, "ysd": year_start, "bal": balance,
            })
        results.append({"emp_code": emp_code, "leave_type": lt_code, "status": "ok"})

    await db.commit()
    return {"processed": len(results), "results": results}


@router.post("/opening/import")
async def import_opening_balances(
    file: UploadFile,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    """Excel import. Expects columns: emp_code, leave_type_code, opening_balance."""
    content = await file.read()
    wb = load_workbook(io.BytesIO(content), read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))  # Skip header

    payload = []
    for row in rows:
        if not row[0]:
            continue
        payload.append({
            "emp_code": str(row[0]).strip(),
            "leave_type_code": str(row[1]).strip() if row[1] else "",
            "opening_balance": float(row[2]) if row[2] else 0,
        })

    return await bulk_opening_balance(payload, _=_, db=db)
```

---

### FILE: `frontend/src/api/phase3_endpoints.ts`

```typescript
import api from './client';

export const leaveTypesApi = {
  list: () => api.get('/leave-types'),
  create: (data: Record<string, unknown>) => api.post('/leave-types', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/leave-types/${id}`, data),
};

export const entitlementRulesApi = {
  list: () => api.get('/leave-entitlement-rules'),
  create: (data: Record<string, unknown>) => api.post('/leave-entitlement-rules', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/leave-entitlement-rules/${id}`, data),
};

export const holidayApi = {
  list: (year?: number) => api.get('/holiday-master', { params: year ? { year } : {} }),
  create: (data: Record<string, unknown>) => api.post('/holiday-master', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/holiday-master/${id}`, data),
  delete: (id: string) => api.delete(`/holiday-master/${id}`),
};

export const workflowApi = {
  list: () => api.get('/workflow-configs'),
  create: (data: Record<string, unknown>) => api.post('/workflow-configs', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/workflow-configs/${id}`, data),
  addStep: (configId: string, data: Record<string, unknown>) => api.post(`/workflow-configs/${configId}/steps`, data),
  updateStep: (configId: string, stepId: string, data: Record<string, unknown>) => api.put(`/workflow-configs/${configId}/steps/${stepId}`, data),
  deleteStep: (configId: string, stepId: string) => api.delete(`/workflow-configs/${configId}/steps/${stepId}`),
  simulate: (data: Record<string, unknown>) => api.post('/workflow-configs/simulate', data),
};

export const balancesApi = {
  opening: (data: Record<string, unknown>[]) => api.post('/leave-balances/opening', data),
  importExcel: (file: File) => { const f = new FormData(); f.append('file', file); return api.post('/leave-balances/opening/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }); },
};
```

---

### FILE: `frontend/src/pages/Phase3Pages.tsx`

```typescript
import { useState, useEffect } from 'react';
import { leaveTypesApi, entitlementRulesApi, holidayApi, workflowApi, balancesApi } from '../api/phase3_endpoints';

export function LeaveTypesPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const load = async () => { const { data } = await leaveTypesApi.list(); setItems(data); };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Leave Types</h2>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Code</th><th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Scheme</th><th className="px-3 py-2 text-center">Half-Day</th>
              <th className="px-3 py-2 text-center">MC Required</th><th className="px-3 py-2 text-center">Carry Fwd</th>
            </tr>
          </thead>
          <tbody>
            {items.map((lt: Record<string, unknown>) => (
              <tr key={lt.id as string} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">{lt.code as string}</td>
                <td className="px-3 py-2">{lt.name as string}</td>
                <td className="px-3 py-2">{lt.scheme as string}</td>
                <td className="px-3 py-2 text-center">{lt.is_half_day_allowed ? '✅' : '—'}</td>
                <td className="px-3 py-2 text-center">{lt.requires_mc ? '✅' : '—'}</td>
                <td className="px-3 py-2 text-center">{lt.carry_forward ? '✅' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EntitlementRulesPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const load = async () => { const { data } = await entitlementRulesApi.list(); setItems(data); };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Entitlement Rules</h2>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-left">Leave Type</th>
              <th className="px-3 py-2 text-left">Year Ref</th><th className="px-3 py-2 text-right">Days/Yr</th>
              <th className="px-3 py-2 text-right">Yr1</th><th className="px-3 py-2 text-right">Yr2+</th>
              <th className="px-3 py-2 text-right">Max Tenure</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r: Record<string, unknown>) => (
              <tr key={r.id as string} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">{r.category_code as string}</td>
                <td className="px-3 py-2 font-mono">{r.leave_type_code as string}</td>
                <td className="px-3 py-2">{r.year_ref as string}</td>
                <td className="px-3 py-2 text-right">{r.days_per_year != null ? String(r.days_per_year) : '—'}</td>
                <td className="px-3 py-2 text-right">{r.year1_days != null ? String(r.year1_days) : '—'}</td>
                <td className="px-3 py-2 text-right">{r.year2_plus_days != null ? String(r.year2_plus_days) : '—'}</td>
                <td className="px-3 py-2 text-right">{r.max_in_tenure != null ? String(r.max_in_tenure) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HolidayPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('GAZETTED');

  const load = async () => { const { data } = await holidayApi.list(year); setItems(data); };
  useEffect(() => { load(); }, [year]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await holidayApi.create({ year, holiday_date: date, holiday_name: name, holiday_type: type });
    setName(''); setDate(''); load();
  };

  const del = async (id: string) => { if (confirm('Delete?')) { await holidayApi.delete(id); load(); } };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Holiday Master — {year}</h2>
      <form onSubmit={add} className="flex gap-2 mb-4">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2" required />
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2 flex-1" required />
        <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded px-3 py-2">
          <option>GAZETTED</option><option>RESTRICTED</option><option>OPTIONAL</option>
        </select>
        <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded text-sm">Add</button>
      </form>
      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Type</th><th></th></tr></thead>
          <tbody>
            {items.map((h: Record<string, unknown>) => (
              <tr key={h.id as string} className="border-t">
                <td className="px-3 py-2">{h.holiday_date as string}</td>
                <td className="px-3 py-2">{h.holiday_name as string}</td>
                <td className="px-3 py-2"><span className="text-xs px-2 py-1 rounded bg-gray-100">{h.holiday_type as string}</span></td>
                <td className="px-3 py-2"><button onClick={() => del(h.id as string)} className="text-red-600 text-xs hover:underline">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WorkflowPage() {
  const [configs, setConfigs] = useState<Record<string, unknown>[]>([]);
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);
  const [name, setName] = useState('');

  const load = async () => { const { data } = await workflowApi.list(); setConfigs(data); };
  useEffect(() => { load(); }, []);

  const createCfg = async () => {
    if (!name) return;
    await workflowApi.create({ config_name: name });
    setName(''); load();
  };

  const simulate = async () => {
    const cat = (document.getElementById('sim-cat') as HTMLInputElement).value;
    const lt = (document.getElementById('sim-lt') as HTMLInputElement).value;
    const days = +(document.getElementById('sim-days') as HTMLInputElement).value || 1;
    const { data } = await workflowApi.simulate({ category_code: cat, leave_type_code: lt, days });
    setSimResult(data);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Workflow Configurator</h2>
      <div className="flex gap-2 mb-4">
        <input placeholder="Config name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2 flex-1" />
        <button onClick={createCfg} className="bg-primary-600 text-white px-4 py-2 rounded text-sm">Create</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Workflow Chains</h3>
          {configs.map((c: Record<string, unknown>) => (
            <details key={c.id as string} className="mb-2 border rounded">
              <summary className="px-3 py-2 cursor-pointer font-medium text-sm">
                {c.config_name as string} <span className="text-gray-400">({(c.steps as unknown[])?.length || 0} steps)</span>
              </summary>
              <div className="px-3 pb-2 text-xs space-y-1">
                {(c.steps as Record<string, unknown>[])?.map((s: Record<string, unknown>) => (
                  <div key={s.id as string} className="flex gap-2 text-gray-600">
                    <span className="w-6 text-center font-mono">{s.step_order as number}</span>
                    <span>{s.approver_role as string}</span>
                    <span className="text-gray-400">SLA: {s.sla_hours as number}h</span>
                    {s.is_final_authority && <span className="text-green-600 font-bold">FINAL</span>}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Simulate Routing</h3>
          <div className="flex gap-2 mb-3">
            <input id="sim-cat" placeholder="Category" className="border rounded px-2 py-1 w-28 text-sm" />
            <input id="sim-lt" placeholder="Leave Type" className="border rounded px-2 py-1 w-28 text-sm" />
            <input id="sim-days" type="number" defaultValue={3} className="border rounded px-2 py-1 w-20 text-sm" />
            <button onClick={simulate} className="bg-primary-600 text-white px-3 py-1 rounded text-sm">Simulate</button>
          </div>
          {simResult && (
            <div className="text-sm">
              {simResult.matched ? (
                <div>
                  <p className="text-green-700 font-medium">Matched: {(simResult.config as Record<string, unknown>).config_name as string}</p>
                  {(simResult.config as Record<string, unknown>).steps && ((simResult.config as Record<string, unknown>).steps as Record<string, unknown>[]).map((s: Record<string, unknown>) => (
                    <div key={s.id as string} className="ml-2 text-gray-600">→ {s.approver_role as string}</div>
                  ))}
                </div>
              ) : <p className="text-red-600">No workflow matched</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function OpeningBalancePage() {
  const [jsonText, setJsonText] = useState('');
  const [result, setResult] = useState('');

  const submit = async () => {
    try {
      const payload = JSON.parse(jsonText);
      const { data } = await balancesApi.opening(payload);
      setResult(JSON.stringify(data, null, 2));
    } catch { setResult('Invalid JSON'); }
  };

  const importExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const { data } = await balancesApi.importExcel(f);
    setResult(JSON.stringify(data, null, 2));
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Opening Balances</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">JSON Entry</h3>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='[{emp_code: "EMP001", leave_type_code: "EL", opening_balance: 30}]'
            className="w-full border rounded px-3 py-2 text-sm font-mono h-40"
          />
          <button onClick={submit} className="mt-2 bg-primary-600 text-white px-4 py-2 rounded text-sm">Submit</button>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Excel Import</h3>
          <p className="text-sm text-gray-500 mb-2">Columns: emp_code, leave_type_code, opening_balance</p>
          <label className="inline-block px-4 py-2 bg-green-600 text-white rounded cursor-pointer text-sm">
            Upload Excel
            <input type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" />
          </label>
        </div>
      </div>
      {result && <pre className="mt-4 bg-gray-900 text-green-400 p-4 rounded text-xs overflow-auto max-h-60">{result}</pre>}
    </div>
  );
}
```

---

### FILE: `frontend/src/App.tsx`

⚠️ **OVERWRITE**

```typescript
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from './stores';
import LoginPage from './pages/LoginPage';
import EmployeeListPage from './pages/EmployeeListPage';
import MastersPage from './pages/MastersPage';
import { LeaveTypesPage, EntitlementRulesPage, HolidayPage, WorkflowPage, OpeningBalancePage } from './pages/Phase3Pages';
import { authApi } from './api/endpoints';

function Layout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('access_token');
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-primary-800">AIIMS HRMS — Bibinagar</h1>
            {user && (
              <nav className="flex gap-4 text-sm">
                <Link to="/" className="text-gray-600 hover:text-primary-600">Employees</Link>
                <Link to="/masters" className="text-gray-600 hover:text-primary-600">Masters</Link>
                <Link to="/leave-types" className="text-gray-600 hover:text-primary-600">Leave Types</Link>
                <Link to="/entitlements" className="text-gray-600 hover:text-primary-600">Rules</Link>
                <Link to="/holidays" className="text-gray-600 hover:text-primary-600">Holidays</Link>
                <Link to="/workflows" className="text-gray-600 hover:text-primary-600">Workflows</Link>
                <Link to="/balances" className="text-gray-600 hover:text-primary-600">Balances</Link>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-gray-500">{user.username} <span className="text-gray-400">({user.role})</span></span>}
            <span className="text-sm text-gray-400">v0.3.0</span>
            {user && <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-800">Logout</button>}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<EmployeeListPage />} />
            <Route path="/masters" element={<MastersPage />} />
            <Route path="/leave-types" element={<LeaveTypesPage />} />
            <Route path="/entitlements" element={<EntitlementRulesPage />} />
            <Route path="/holidays" element={<HolidayPage />} />
            <Route path="/workflows" element={<WorkflowPage />} />
            <Route path="/balances" element={<OpeningBalancePage />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}
```

---

