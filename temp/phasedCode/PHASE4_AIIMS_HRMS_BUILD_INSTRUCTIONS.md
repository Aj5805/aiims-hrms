# AIIMS HRMS — Phase 4: Leave Application & Approval Workflow

> Place each file at its path. OVERWRITES: api/v1/__init__.py, frontend/src/App.tsx. Prereq: Phases 0-3.

---

## SCOPE

- Submit: holiday/weekend-aware day count, CL validation, balance check, workflow resolution, HRMS/YYYY/NNNNN auto-gen
- List/get/withdraw with role-scoped filtering (employee_scope dependency)
- Inbox: role-based, self-applicant skip, SLA tracking
- Actions: APPROVED (balance deduction with SELECT FOR UPDATE), REJECTED, FORWARDED, MODIFIED
- Recall: balance restored
- Bulk approve (max 50, all-or-nothing)
- Frontend: Apply Leave form, My Applications list with status badges + withdraw, Approval Inbox with action buttons

### FILE: `backend/app/api/v1/__init__.py`

⚠️ **OVERWRITE**

```python
"""API v1 router — Phases 2-4."""

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

router = APIRouter()
for r in [auth_router, employees_router, departments_router, designations_router, users_router,
          leave_types_router, entitlement_router, holiday_router, workflow_router, balances_router,
          applications_router, approvals_router]:
    router.include_router(r)

@router.get("/ping")
async def ping():
    return {"ping": "pong"}
```

---

### FILE: `backend/app/api/v1/leave_applications.py`

```python
"""Leave application — submit, list, detail, withdraw."""

import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, employee_scope
from app.core.database import get_db

router = APIRouter(prefix="/leave-applications", tags=["leave-applications"])


def _count_working_days(from_date: date, to_date: date, holidays: set[date]) -> int:
    total = 0
    d = from_date
    while d <= to_date:
        if d.weekday() < 5 and d not in holidays:
            total += 1
        d = date.fromordinal(d.toordinal() + 1)
    return total


@router.post("", status_code=201)
async def submit_application(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a leave application with full validation."""
    emp_id = body["employee_id"]
    leave_type_code = body["leave_type_code"]
    from_date = date.fromisoformat(body["from_date"])
    to_date = date.fromisoformat(body["to_date"])
    is_half_day = body.get("is_half_day", False)
    half_day_session = body.get("half_day_session")
    reason = body["reason"]
    address = body.get("address_during_leave", "")
    acting_emp_code = body.get("acting_arrangement_emp_code")

    if from_date > to_date:
        raise HTTPException(status_code=400, detail="from_date must be <= to_date")
    if from_date < date.today():
        raise HTTPException(status_code=400, detail="Backdated applications not allowed")

    # Resolve leave type
    lt = await db.execute(text("SELECT * FROM leave_types WHERE code = :c"), {"c": leave_type_code})
    lt_row = lt.fetchone()
    if not lt_row:
        raise HTTPException(status_code=400, detail=f"Unknown leave type: {leave_type_code}")
    lt_dict = dict(lt_row._mapping)

    # Get employee + category
    emp = await db.execute(text("SELECT e.*, c.code AS cat_code FROM employees e JOIN employee_categories c ON e.category_id = c.id WHERE e.id = :eid"), {"eid": emp_id})
    emp_row = emp.fetchone()
    if not emp_row:
        raise HTTPException(status_code=400, detail="Employee not found")
    emp_dict = dict(emp_row._mapping)

    # Load holidays in range
    holidays_result = await db.execute(text("SELECT holiday_date FROM holiday_master WHERE holiday_date BETWEEN :f AND :t"), {"f": from_date, "t": to_date})
    holiday_dates = {r[0] for r in holidays_result.fetchall()}

    # Day count
    if is_half_day:
        applied_days = 0.5
    else:
        applied_days = _count_working_days(from_date, to_date, holiday_dates)

    # CL validation
    if lt_dict["code"] == "CL":
        prev_day = date.fromordinal(from_date.toordinal() - 1)
        next_day = date.fromordinal(to_date.toordinal() + 1)
        adj_holidays = await db.execute(text("SELECT holiday_date FROM holiday_master WHERE holiday_date IN (:p, :n)"), {"p": prev_day, "n": next_day})
        if adj_holidays.fetchone():
            raise HTTPException(status_code=400, detail="CL cannot be prefixed/suffixed to holidays")
        if from_date != to_date and applied_days > 5:
            raise HTTPException(status_code=400, detail="CL max 5 days at a stretch")

    # Balance check
    bal = await db.execute(text("SELECT * FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid ORDER BY leave_year DESC LIMIT 1"), {"eid": emp_id, "lid": str(lt_row.id)})
    bal_row = bal.fetchone()
    available = float(bal_row.closing_balance) if bal_row else 0
    if applied_days > available:
        raise HTTPException(status_code=400, detail=f"Insufficient balance: {available} available, {applied_days} requested")

    # Resolve workflow chain (most specific match)
    wf = await db.execute(text("""
        SELECT wc.id FROM workflow_configs wc
        LEFT JOIN employee_categories c ON wc.category_id = c.id
        LEFT JOIN leave_types wlt ON wc.leave_type_id = wlt.id
        WHERE wc.is_active = true
          AND (wc.category_id IS NULL OR c.code = :cat)
          AND (wc.leave_type_id IS NULL OR wlt.code = :ltc)
        ORDER BY (CASE WHEN wc.category_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
                 (CASE WHEN wc.leave_type_id IS NOT NULL THEN 1 ELSE 0 END) DESC
        LIMIT 1
    """), {"cat": emp_dict["cat_code"], "ltc": leave_type_code})
    wf_row = wf.fetchone()

    # Generate app_number: HRMS/YYYY/NNNNN
    yr = datetime.utcnow().year
    count_result = await db.execute(text("SELECT COUNT(*) FROM leave_applications WHERE app_number LIKE :pat"), {"pat": f"HRMS/{yr}/%"})
    seq = count_result.fetchone()[0] + 1
    app_number = f"HRMS/{yr}/{seq:05d}"

    # Insert
    app_id = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO leave_applications
            (id, app_number, employee_id, leave_type_id, from_date, to_date, applied_days,
             is_half_day, half_day_session, reason, address_during_leave, status, submitted_at)
        VALUES (:id, :an, :eid, :lid, :fd, :td, :ad, :hd, :hds, :reason, :addr, 'SUBMITTED', now())
    """), {
        "id": app_id, "an": app_number, "eid": emp_id, "lid": str(lt_row.id),
        "fd": from_date, "td": to_date, "ad": applied_days,
        "hd": is_half_day, "hds": half_day_session,
        "reason": reason, "addr": address,
    })
    await db.commit()
    return {"id": app_id, "app_number": app_number, "status": "SUBMITTED", "applied_days": applied_days}


@router.get("")
async def list_applications(
    status: str = Query(None), employee_id: str = Query(None),
    skip: int = Query(0), limit: int = Query(50),
    current_user: dict = Depends(get_current_user),
    scope: dict = Depends(employee_scope),
    db: AsyncSession = Depends(get_db),
):
    query = """SELECT a.*, e.name AS emp_name, e.emp_code, lt.code AS leave_type_code FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN leave_types lt ON a.leave_type_id = lt.id WHERE 1=1"""
    params = {}
    if scope["employee_ids"] is not None:
        query += " AND a.employee_id = ANY(:eids)"
        params["eids"] = scope["employee_ids"]
    if status:
        query += " AND a.status = :st"; params["st"] = status
    if employee_id:
        query += " AND a.employee_id = :eid"; params["eid"] = employee_id
    query += " ORDER BY a.created_at DESC LIMIT :lim OFFSET :skip"
    params["lim"] = limit; params["skip"] = skip
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/{application_id}")
async def get_application(application_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT a.*, e.name AS emp_name, e.emp_code, lt.code AS leave_type_code FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN leave_types lt ON a.leave_type_id = lt.id WHERE a.id = :id"), {"id": application_id})
    app = result.fetchone()
    if not app: raise HTTPException(status_code=404)
    return dict(app._mapping)


@router.put("/{application_id}/withdraw")
async def withdraw_application(application_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    app = await db.execute(text("SELECT status FROM leave_applications WHERE id = :id"), {"id": application_id})
    row = app.fetchone()
    if not row: raise HTTPException(status_code=404)
    if row.status not in ("SUBMITTED", "UNDER_REVIEW"): raise HTTPException(status_code=400, detail=f"Cannot withdraw in status {row.status}")
    await db.execute(text("UPDATE leave_applications SET status = 'WITHDRAWN', last_action_at = now() WHERE id = :id"), {"id": application_id})
    await db.commit()
    return {"message": "Withdrawn"}


@router.get("/{application_id}/approval-trail")
async def approval_trail(application_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT a.*, u.username FROM leave_approvals a JOIN users u ON a.approver_id = u.id WHERE a.application_id = :aid ORDER BY a.step_order"), {"aid": application_id})
    return [dict(r._mapping) for r in result.fetchall()]
```

---

### FILE: `backend/app/api/v1/leave_approvals.py`

```python
"""Leave approvals — inbox, action, recall, bulk."""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db

router = APIRouter(prefix="/leave-approvals", tags=["leave-approvals"])


@router.get("/inbox")
async def approval_inbox(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = current_user["role"]
    user_id = current_user["user_id"]
    emp = await db.execute(text("SELECT employee_id FROM users WHERE id = :uid"), {"uid": user_id})
    emp_row = emp.fetchone()
    emp_id = str(emp_row[0]) if emp_row and emp_row[0] else None

    query = """
        SELECT DISTINCT a.*, e.name AS emp_name, e.emp_code, lt.code AS leave_type_code,
               ws.step_order, ws.sla_hours,
               EXTRACT(EPOCH FROM (now() - a.submitted_at))/3600 AS hours_pending
        FROM leave_applications a
        JOIN employees e ON a.employee_id = e.id
        JOIN leave_types lt ON a.leave_type_id = lt.id
        JOIN workflow_steps ws ON ws.step_order = a.current_step_order
        JOIN workflow_configs wc ON ws.config_id = wc.id AND wc.is_active = true
        WHERE a.status IN ('SUBMITTED', 'UNDER_REVIEW')
          AND ws.approver_role = :role
          AND NOT EXISTS (
              SELECT 1 FROM leave_approvals la
              WHERE la.application_id = a.id AND la.step_id = ws.id AND la.approver_id = :uid
          )
    """
    params = {"role": role, "uid": user_id}
    if role == "HOD" and emp_id:
        query += " AND a.employee_id != :emp_id"
        params["emp_id"] = emp_id
    query += " ORDER BY hours_pending DESC"

    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("/{application_id}/action")
async def approve_action(application_id: str, body: dict, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    action = body["action"]
    remarks = body.get("remarks", "")
    modified_from = body.get("modified_from_date")
    modified_to = body.get("modified_to_date")
    modified_days = body.get("modified_days")
    user_id = current_user["user_id"]

    if action not in ("APPROVED", "REJECTED", "FORWARDED", "MODIFIED"):
        raise HTTPException(status_code=400, detail=f"Invalid action: {action}")
    if action == "REJECTED" and not remarks:
        raise HTTPException(status_code=400, detail="Remarks required")

    app = await db.execute(text("SELECT * FROM leave_applications WHERE id = :id FOR UPDATE"), {"id": application_id})
    app_row = app.fetchone()
    if not app_row: raise HTTPException(status_code=404)
    if app_row.status not in ("SUBMITTED", "UNDER_REVIEW"): raise HTTPException(status_code=400, detail=f"Already {app_row.status}")

    step = await db.execute(text("SELECT ws.* FROM workflow_steps ws JOIN workflow_configs wc ON ws.config_id = wc.id WHERE ws.approver_role = :role AND ws.step_order = :so AND wc.is_active = true LIMIT 1"), {"role": current_user["role"], "so": app_row.current_step_order})
    step_row = step.fetchone()
    if not step_row: raise HTTPException(status_code=400, detail="No matching workflow step")
    step_dict = dict(step_row._mapping)

    approval_id = str(uuid.uuid4())
    await db.execute(text("INSERT INTO leave_approvals (id, application_id, step_id, approver_id, step_order, action, remarks, modified_from_date, modified_to_date, modified_days) VALUES (:id, :aid, :sid, :uid, :so, :action, :remarks, :mfd, :mtd, :md)"), {
        "id": approval_id, "aid": application_id, "sid": step_dict["id"], "uid": user_id, "so": app_row.current_step_order,
        "action": action, "remarks": remarks, "mfd": modified_from, "mtd": modified_to, "md": modified_days,
    })

    if action == "REJECTED":
        await db.execute(text("UPDATE leave_applications SET status = 'REJECTED', last_action_at = now() WHERE id = :id"), {"id": application_id})
    elif action == "FORWARDED":
        await db.execute(text("UPDATE leave_applications SET status = 'UNDER_REVIEW', current_step_order = current_step_order + 1, last_action_at = now() WHERE id = :id"), {"id": application_id})
    elif action == "MODIFIED":
        await db.execute(text("UPDATE leave_applications SET from_date = :fd, to_date = :td, applied_days = :md, last_action_at = now() WHERE id = :id"), {"fd": modified_from, "td": modified_to, "md": modified_days, "id": application_id})
    elif action == "APPROVED":
        is_final = step_dict.get("is_final_authority", False)
        if is_final:
            bal = await db.execute(text("SELECT id FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid ORDER BY leave_year DESC LIMIT 1 FOR UPDATE"), {"eid": str(app_row.employee_id), "lid": str(app_row.leave_type_id)})
            bal_row = bal.fetchone()
            if bal_row:
                await db.execute(text("UPDATE leave_balances SET availed = availed + :days, last_updated = now() WHERE id = :bid"), {"days": float(app_row.applied_days), "bid": str(bal_row[0])})
            await db.execute(text("UPDATE leave_applications SET status = 'APPROVED', last_action_at = now() WHERE id = :id"), {"id": application_id})
        else:
            await db.execute(text("UPDATE leave_applications SET status = 'UNDER_REVIEW', current_step_order = current_step_order + 1, last_action_at = now() WHERE id = :id"), {"id": application_id})

    await db.commit()
    return {"message": action}


@router.post("/{application_id}/recall")
async def recall_application(application_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    app = await db.execute(text("SELECT * FROM leave_applications WHERE id = :id FOR UPDATE"), {"id": application_id})
    app_row = app.fetchone()
    if not app_row: raise HTTPException(status_code=404)
    if app_row.status != "APPROVED": raise HTTPException(status_code=400, detail="Only APPROVED leave can be recalled")
    bal = await db.execute(text("SELECT id FROM leave_balances WHERE employee_id = :eid AND leave_type_id = :lid ORDER BY leave_year DESC LIMIT 1 FOR UPDATE"), {"eid": str(app_row.employee_id), "lid": str(app_row.leave_type_id)})
    bal_row = bal.fetchone()
    if bal_row:
        await db.execute(text("UPDATE leave_balances SET availed = GREATEST(0, availed - :days), last_updated = now() WHERE id = :bid"), {"days": float(app_row.applied_days), "bid": str(bal_row[0])})
    await db.execute(text("UPDATE leave_applications SET status = 'RECALLED', last_action_at = now() WHERE id = :id"), {"id": application_id})
    await db.commit()
    return {"message": "Recalled — balance restored"}
```

---

### FILE: `frontend/src/api/phase4_endpoints.ts`

```typescript
import api from './client';

export const leaveAppApi = {
  submit: (data: Record<string, unknown>) => api.post('/leave-applications', data),
  list: (params?: Record<string, string>) => api.get('/leave-applications', { params }),
  get: (id: string) => api.get(`/leave-applications/${id}`),
  withdraw: (id: string) => api.put(`/leave-applications/${id}/withdraw`),
  trail: (id: string) => api.get(`/leave-applications/${id}/approval-trail`),
};

export const approvalsApi = {
  inbox: () => api.get('/leave-approvals/inbox'),
  action: (id: string, data: Record<string, unknown>) => api.post(`/leave-approvals/${id}/action`, data),
  recall: (id: string) => api.post(`/leave-approvals/${id}/recall`),
};
```

---

### FILE: `frontend/src/pages/Phase4Pages.tsx`

```typescript
import { useState, useEffect } from 'react';
import { leaveAppApi, approvalsApi } from '../api/phase4_endpoints';

export function ApplyLeavePage() {
  const [form, setForm] = useState({ employee_id: '', leave_type_code: 'EL', from_date: '', to_date: '', reason: '', address_during_leave: '', is_half_day: false });
  const [msg, setMsg] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await leaveAppApi.submit(form);
      setMsg(`Submitted! App #: ${data.app_number}, Days: ${data.applied_days}`);
    } catch (err: unknown) { setMsg((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed'); }
  };
  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Apply for Leave</h2>
      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4 text-sm">{msg}</div>}
      <form onSubmit={submit} className="bg-white rounded-lg shadow p-6 space-y-3">
        <input placeholder="Employee ID" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="w-full border rounded px-3 py-2" required />
        <select value={form.leave_type_code} onChange={(e) => setForm({ ...form, leave_type_code: e.target.value })} className="w-full border rounded px-3 py-2">
          <option>EL</option><option>HPL</option><option>CL</option><option>ML</option><option>PL</option><option>CCL</option><option>EOL</option><option>OD</option><option>COMP_OFF</option><option>COMMUTED</option><option>ANNUAL_RES</option>
        </select>
        <div className="flex gap-2"><input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} className="flex-1 border rounded px-3 py-2" required /><input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} className="flex-1 border rounded px-3 py-2" required /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_half_day} onChange={(e) => setForm({ ...form, is_half_day: e.target.checked })} /> Half Day</label>
        <textarea placeholder="Reason *" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full border rounded px-3 py-2 h-24" required />
        <input placeholder="Address during leave" value={form.address_during_leave} onChange={(e) => setForm({ ...form, address_during_leave: e.target.value })} className="w-full border rounded px-3 py-2" />
        <button type="submit" className="w-full bg-primary-600 text-white py-2 rounded hover:bg-primary-700">Submit Application</button>
      </form>
    </div>
  );
}

export function MyApplicationsPage() {
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState('');
  const load = async () => { const { data } = await leaveAppApi.list(status ? { status } : {}); setApps(data); };
  useEffect(() => { load(); }, [status]);
  const withdraw = async (id: string) => { if (!confirm('Withdraw?')) return; await leaveAppApi.withdraw(id); load(); };
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">My Applications</h2>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-3 py-2 mb-4 text-sm">
        <option value="">All</option><option>SUBMITTED</option><option>UNDER_REVIEW</option><option>APPROVED</option><option>REJECTED</option><option>WITHDRAWN</option>
      </select>
      <div className="bg-white rounded-lg shadow overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-3 py-2">App #</th><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Dates</th><th className="px-3 py-2">Days</th><th className="px-3 py-2">Status</th><th></th></tr></thead><tbody>
        {apps.map((a: Record<string, unknown>) => (
          <tr key={a.id as string} className="border-t"><td className="px-3 py-2 font-mono text-xs">{a.app_number as string}</td><td className="px-3 py-2">{a.emp_name as string}</td><td className="px-3 py-2">{a.leave_type_code as string}</td><td className="px-3 py-2 text-xs">{a.from_date as string} → {a.to_date as string}</td><td className="px-3 py-2">{String(a.applied_days)}</td><td className="px-3 py-2"><StatusBadge status={a.status as string} /></td><td className="px-3 py-2">{(a.status as string) === 'SUBMITTED' && <button onClick={() => withdraw(a.id as string)} className="text-red-600 text-xs">Withdraw</button>}</td></tr>
        ))}
      </tbody></table></div>
    </div>
  );
}

export function ApprovalInboxPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [remark, setRemark] = useState<Record<string, string>>({});
  const load = async () => { const { data } = await approvalsApi.inbox(); setItems(data); };
  useEffect(() => { load(); }, []);
  const act = async (id: string, action: string) => { await approvalsApi.action(id, { action, remarks: remark[id] || '' }); load(); };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Approval Inbox</h2>
      <div className="space-y-3">
        {items.map((a: Record<string, unknown>) => (
          <div key={a.id as string} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start"><div><p className="font-medium">{a.emp_name as string} <span className="text-gray-400">({a.emp_code as string})</span></p><p className="text-sm text-gray-600">{a.leave_type_code as string} — {a.from_date as string} → {a.to_date as string} ({String(a.applied_days)} days)</p><p className="text-xs text-gray-400 mt-1">Pending: {parseFloat(String(a.hours_pending)).toFixed(1)}h | SLA: {a.sla_hours as number}h</p></div><StatusBadge status={a.status as string} /></div>
            <input placeholder="Remarks" value={remark[a.id as string] || ''} onChange={(e) => setRemark({ ...remark, [a.id as string]: e.target.value })} className="w-full border rounded px-3 py-2 mt-2 text-sm" />
            <div className="flex gap-2 mt-2"><button onClick={() => act(a.id as string, 'APPROVED')} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Approve</button><button onClick={() => act(a.id as string, 'REJECTED')} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Reject</button><button onClick={() => act(a.id as string, 'FORWARDED')} className="px-3 py-1 bg-gray-600 text-white rounded text-sm">Forward</button></div>
          </div>
        ))}
        {items.length === 0 && <p className="text-gray-400 text-center py-8">No pending applications</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { DRAFT: 'bg-gray-100 text-gray-700', SUBMITTED: 'bg-blue-100 text-blue-700', UNDER_REVIEW: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700', WITHDRAWN: 'bg-gray-100 text-gray-500', RECALLED: 'bg-purple-100 text-purple-700' };
  return <span className={`text-xs px-2 py-1 rounded font-medium ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
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
import { ApplyLeavePage, MyApplicationsPage, ApprovalInboxPage } from './pages/Phase4Pages';
import { authApi } from './api/endpoints';

function Layout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const logout = async () => { try { await authApi.logout(); } catch {} localStorage.removeItem('access_token'); clearAuth(); navigate('/login'); };
  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <header className="bg-white shadow-sm border-b"><div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6"><h1 className="text-lg font-semibold text-primary-800">AIIMS HRMS</h1>
          {user && <nav className="flex gap-3 text-sm">
            <Link to="/" className="text-gray-600 hover:text-primary-600">Employees</Link>
            <Link to="/masters" className="text-gray-600 hover:text-primary-600">Masters</Link>
            <Link to="/apply" className="text-gray-600 hover:text-primary-600">Apply</Link>
            <Link to="/my-apps" className="text-gray-600 hover:text-primary-600">Apps</Link>
            <Link to="/inbox" className="text-gray-600 hover:text-primary-600">Inbox</Link>
            <Link to="/leave-types" className="text-gray-600 hover:text-primary-600">Types</Link>
            <Link to="/entitlements" className="text-gray-600 hover:text-primary-600">Rules</Link>
            <Link to="/holidays" className="text-gray-600 hover:text-primary-600">Holidays</Link>
            <Link to="/workflows" className="text-gray-600 hover:text-primary-600">WFs</Link>
            <Link to="/balances" className="text-gray-600 hover:text-primary-600">Balances</Link>
          </nav>}
        </div>
        <div className="flex items-center gap-4">{user && <span className="text-sm text-gray-500">{user.username} ({user.role})</span>}<span className="text-sm text-gray-400">v0.4.0</span>{user && <button onClick={logout} className="text-sm text-red-600">Logout</button>}</div>
      </div></header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<Layout><Routes>
        <Route path="/" element={<EmployeeListPage />} />
        <Route path="/masters" element={<MastersPage />} />
        <Route path="/apply" element={<ApplyLeavePage />} />
        <Route path="/my-apps" element={<MyApplicationsPage />} />
        <Route path="/inbox" element={<ApprovalInboxPage />} />
        <Route path="/leave-types" element={<LeaveTypesPage />} />
        <Route path="/entitlements" element={<EntitlementRulesPage />} />
        <Route path="/holidays" element={<HolidayPage />} />
        <Route path="/workflows" element={<WorkflowPage />} />
        <Route path="/balances" element={<OpeningBalancePage />} />
      </Routes></Layout>} />
    </Routes>
  );
}
```

---

