# AIIMS HRMS — Phase 5: Leave Accounts & Balance Management

> Place each file at its path. OVERWRITES: api/v1/__init__.py, api/v1/leave_balances.py, App.tsx. Prereq: Phases 0-4.

## SCOPE
- `GET /leave-balances/:eid` — all balances with visual bar data
- `GET /leave-balances/:eid/ledger/:lid` — full transaction ledger
- `GET /leave-balances/:eid/project` — hypothetical balance projection
- `POST /leave-balances/credit/annual` — EL/HPL annual credit run
- `POST /leave-balances/carryforward` — year-end carry-forward (EL capped 300)
- `PUT /leave-balances/:bid/manual-adjust` — manual adjustment with audit log
- Frontend: My Leave Account (balance cards, progress bars, ledger), Year-End Processing (carry-forward + annual credit buttons)

### FILE: `backend/app/api/v1/__init__.py`

⚠️ **OVERWRITE**

```python
"""API v1 router — Phases 2-8."""

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
from app.api.v1.leave_applications import router as applications_router
from app.api.v1.leave_approvals import router as approvals_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.reports import router as reports_router
from app.api.v1.admin import router as admin_router

router = APIRouter()
for r in [auth_router, employees_router, departments_router, designations_router, users_router,
          leave_types_router, entitlement_router, holiday_router, workflow_router, balances_router,
          applications_router, approvals_router, notifications_router, reports_router, admin_router]:
    router.include_router(r)

@router.get("/ping")
async def ping():
    return {"ping": "pong"}
```

---

### FILE: `backend/app/api/v1/leave_balances.py`

⚠️ **OVERWRITE**

```python
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
            year_start = f"{leave_year}-04-01"
        else:
            doj = emp_row.doj
            year_start = f"{leave_year}-{doj.month:02d}-{doj.day:02d}"

        existing = await db.execute(text("""
            SELECT id FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid AND leave_year = :ly
        """), {"eid": str(emp_row.id), "lid": str(lt_row[0]), "ly": leave_year})
        ex_row = existing.fetchone()

        if ex_row:
            await db.execute(text("UPDATE leave_balances SET opening_balance = :bal, credited = :bal, last_updated = now() WHERE id = :id"), {"bal": balance, "id": str(ex_row[0])})
        else:
            await db.execute(text("""
                INSERT INTO leave_balances (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
                VALUES (uuid_generate_v4(), :eid, :lid, :ly, :ysd::date, :bal, :bal)
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
    year_start = body["year_start"]
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
    """), {"sy": source_year, "ty": target_year, "ys": f"{target_year}-04-01"})
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
```

---

### FILE: `frontend/src/pages/Phase5Pages.tsx`

```typescript
import { useState, useEffect } from 'react';
import api from './client';

const balApi = {
  get: (eid: string) => api.get(`/leave-balances/${eid}`),
  ledger: (eid: string, lid: string) => api.get(`/leave-balances/${eid}/ledger/${lid}`),
  project: (eid: string, p: Record<string, string>) => api.get(`/leave-balances/${eid}/project`, { params: p }),
  annualCredit: (data: Record<string, unknown>) => api.post('/leave-balances/credit/annual', data),
  carryForward: (data: Record<string, unknown>) => api.post('/leave-balances/carryforward', data),
  manualAdjust: (bid: string, data: Record<string, unknown>) => api.put(`/leave-balances/${bid}/manual-adjust`, data),
};

export function MyLeaveAccountPage() {
  const [eid, setEid] = useState('');
  const [balances, setBalances] = useState<Record<string, unknown>[]>([]);
  const [ledger, setLedger] = useState<Record<string, unknown> | null>(null);
  const [projection, setProjection] = useState<Record<string, unknown> | null>(null);

  const loadBalances = async () => {
    if (!eid) return;
    const { data } = await balApi.get(eid);
    setBalances(data.balances || []);
  };

  const showLedger = async (ltId: string) => {
    const { data } = await balApi.ledger(eid, ltId);
    setLedger(data);
  };

  const project = async () => {
    const fd = (document.getElementById('proj-from') as HTMLInputElement).value;
    const td = (document.getElementById('proj-to') as HTMLInputElement).value;
    const lt = (document.getElementById('proj-lt') as HTMLInputElement).value;
    if (!fd || !td || !lt) return;
    const { data } = await balApi.project(eid, { from_date: fd, to_date: td, leave_type_code: lt });
    setProjection(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input placeholder="Employee ID" value={eid} onChange={(e) => setEid(e.target.value)} className="border rounded px-3 py-2" />
        <button onClick={loadBalances} className="bg-primary-600 text-white px-4 py-2 rounded text-sm">Load</button>
      </div>

      {balances.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((b: Record<string, unknown>) => {
            const avail = parseFloat(String(b.closing_balance || 0));
            const max = parseFloat(String(b.max_accumulation || avail + 50));
            const pct = Math.min(100, (avail / max) * 100);
            return (
              <div key={b.id as string} className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md" onClick={() => showLedger(b.leave_type_id as string)}>
                <div className="flex justify-between"><span className="font-semibold">{b.leave_type_code as string}</span><span className="text-sm text-gray-400">{b.leave_type_name as string}</span></div>
                <div className="text-2xl font-bold mt-2">{avail.toFixed(1)} <span className="text-xs text-gray-400 font-normal">days</span></div>
                <div className="mt-2 bg-gray-200 rounded-full h-2"><div className="bg-primary-500 rounded-full h-2" style={{ width: `${pct}%` }} /></div>
                <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Availed: {String(b.availed)}</span><span>Credited: {String(b.credited)}</span></div>
              </div>
            );
          })}
        </div>
      )}

      {ledger && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Ledger</h3>
          <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-3 py-2">App #</th><th className="px-3 py-2">From</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Days</th></tr></thead><tbody>
            {(ledger.transactions as Record<string, unknown>[])?.map((t: Record<string, unknown>) => (
              <tr key={t.app_number as string} className="border-t"><td className="px-3 py-2">{t.app_number as string}</td><td className="px-3 py-2">{t.from_date as string}</td><td className="px-3 py-2">{t.to_date as string}</td><td className="px-3 py-2">{String(t.applied_days)}</td></tr>
            ))}
          </tbody></table>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-2">Balance Projection</h3>
        <div className="flex gap-2">
          <input id="proj-lt" placeholder="Leave type" className="border rounded px-2 py-1 w-28 text-sm" />
          <input id="proj-from" type="date" className="border rounded px-2 py-1 text-sm" />
          <input id="proj-to" type="date" className="border rounded px-2 py-1 text-sm" />
          <button onClick={project} className="bg-primary-600 text-white px-3 py-1 rounded text-sm">Project</button>
        </div>
        {projection && (
          <div className="mt-2 text-sm">
            <span className="text-gray-500">Current: {String(projection.current_balance)} → </span>
            <span className="text-gray-500">Requested: {String(projection.requested_days)} → </span>
            <span className={`font-bold ${(projection.projected_balance as number) < 0 ? 'text-red-600' : 'text-green-600'}`}>Projected: {String(projection.projected_balance)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function YearEndProcessingPage() {
  const [msg, setMsg] = useState('');

  const runCarryForward = async () => {
    try {
      const { data } = await balApi.carryForward({ source_year: 2026, target_year: 2027 });
      setMsg(`Carry-forward done. ${data.rows_affected} rows.`);
    } catch (err: unknown) { setMsg((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed'); }
  };

  const runAnnualCredit = async () => {
    try {
      const { data } = await balApi.annualCredit({ year_start: '2027-04-01', leave_year: 2027 });
      setMsg(`Annual credit done. ${data.rows_affected} rows.`);
    } catch (err: unknown) { setMsg((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Year-End Processing</h2>
      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4 text-sm">{msg}</div>}
      <div className="space-y-4">
        <div className="border rounded p-4">
          <p className="font-medium">Carry-Forward (2026 → 2027)</p>
          <p className="text-xs text-gray-500 mb-2">EL capped at 300 days. Other types per config.</p>
          <button onClick={runCarryForward} className="bg-primary-600 text-white px-4 py-2 rounded text-sm">Execute Carry-Forward</button>
        </div>
        <div className="border rounded p-4">
          <p className="font-medium">Annual Credit (2027)</p>
          <p className="text-xs text-gray-500 mb-2">Credits accumulating leave types (EL, HPL) for all CCS staff.</p>
          <button onClick={runAnnualCredit} className="bg-primary-600 text-white px-4 py-2 rounded text-sm">Execute Annual Credit</button>
        </div>
      </div>
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
import LoginPage from './pages/LoginPage'; import EmployeeListPage from './pages/EmployeeListPage'; import MastersPage from './pages/MastersPage';
import { LeaveTypesPage, EntitlementRulesPage, HolidayPage, WorkflowPage, OpeningBalancePage } from './pages/Phase3Pages';
import { ApplyLeavePage, MyApplicationsPage, ApprovalInboxPage } from './pages/Phase4Pages';
import { MyLeaveAccountPage, YearEndProcessingPage } from './pages/Phase5Pages';
import { authApi } from './api/endpoints';

function Layout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const logout = async () => { try { await authApi.logout(); } catch {} localStorage.removeItem('access_token'); clearAuth(); navigate('/login'); };
  return (
    <div className="min-h-screen bg-[#F0F4F8]"><header className="bg-white shadow-sm border-b"><div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6"><h1 className="text-lg font-semibold text-primary-800">AIIMS HRMS</h1>
        {user && <nav className="flex gap-3 text-sm">
          <Link to="/" className="text-gray-600 hover:text-primary-600">Emp</Link>
          <Link to="/masters" className="text-gray-600 hover:text-primary-600">Masters</Link>
          <Link to="/apply" className="text-gray-600 hover:text-primary-600">Apply</Link>
          <Link to="/my-apps" className="text-gray-600 hover:text-primary-600">Apps</Link>
          <Link to="/inbox" className="text-gray-600 hover:text-primary-600">Inbox</Link>
          <Link to="/leave-account" className="text-gray-600 hover:text-primary-600">Account</Link>
          <Link to="/year-end" className="text-gray-600 hover:text-primary-600">Yr-End</Link>
          <Link to="/leave-types" className="text-gray-600 hover:text-primary-600">Types</Link>
          <Link to="/entitlements" className="text-gray-600 hover:text-primary-600">Rules</Link>
          <Link to="/holidays" className="text-gray-600 hover:text-primary-600">Hols</Link>
          <Link to="/workflows" className="text-gray-600 hover:text-primary-600">WFs</Link>
          <Link to="/balances" className="text-gray-600 hover:text-primary-600">Bal</Link>
        </nav>}
      </div>
      <div className="flex items-center gap-4">{user && <span className="text-sm text-gray-500">{user.username} ({user.role})</span>}<span className="text-sm text-gray-400">v0.5.0</span>{user && <button onClick={logout} className="text-sm text-red-600">Logout</button>}</div>
    </div></header><main className="max-w-7xl mx-auto px-4 py-6">{children}</main></div>
  );
}

export default function App() {
  return (<Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/*" element={<Layout><Routes>
      <Route path="/" element={<EmployeeListPage />} /><Route path="/masters" element={<MastersPage />} />
      <Route path="/apply" element={<ApplyLeavePage />} /><Route path="/my-apps" element={<MyApplicationsPage />} />
      <Route path="/inbox" element={<ApprovalInboxPage />} /><Route path="/leave-account" element={<MyLeaveAccountPage />} />
      <Route path="/year-end" element={<YearEndProcessingPage />} />
      <Route path="/leave-types" element={<LeaveTypesPage />} /><Route path="/entitlements" element={<EntitlementRulesPage />} />
      <Route path="/holidays" element={<HolidayPage />} /><Route path="/workflows" element={<WorkflowPage />} />
      <Route path="/balances" element={<OpeningBalancePage />} />
    </Routes></Layout>} />
  </Routes>);
}
```

---

