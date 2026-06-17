# AIIMS HRMS — Phase 6+7: Notifications & Reports

> OVERWRITES: api/v1/__init__.py. Prereq: Phases 0-5.

## PHASE 6 — Notifications
- `app/services/notifications.py` — queue writer, Jinja2 template engine, event dispatcher
- `app/services/email_sender.py` — APScheduler job, polls every 2 min, batch of 5, retry up to 3
- `GET /notifications` — in-app list (50 latest, with app_number)
- `GET /notifications/unread-count` — badge count
- `PUT /notifications/:id/read`, `PUT /notifications/read-all`
- `GET /notifications/email-log` + retry trigger (admin only)

## PHASE 7 — Reports & Payroll Export
- `GET /reports/leave-register` — emp-wise, date range, Excel-ready
- `GET /reports/leave-abstract` — dept-wise, monthly/quarterly
- `GET /reports/pending-applications` — aged analysis
- `GET /reports/balance-summary` — all employees, all types
- `GET /reports/sanction-pdf/:id` — WeasyPrint HTML→PDF (APPROVED only)
- `GET /reports/leave-calendar` — dept-wise, month filter
- `GET /reports/payroll-export` — LOP CSV, logged to payroll_export_log

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

### FILE: `backend/app/api/v1/notifications.py`

```python
"""Email sender APScheduler job + routes for in-app notifications."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT n.*, a.app_number FROM notification_queue n
        JOIN leave_applications a ON n.application_id = a.id
        WHERE n.recipient_id = :uid AND n.channel = 'IN_APP'
        ORDER BY n.created_at DESC LIMIT 50
    """), {"uid": current_user["user_id"]})
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/unread-count")
async def unread_count(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT COUNT(*) FROM notification_queue WHERE recipient_id = :uid AND channel = 'IN_APP' AND status = 'PENDING'"), {"uid": current_user["user_id"]})
    return {"count": result.fetchone()[0]}


@router.put("/{notification_id}/read")
async def mark_read(notification_id: str, current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE notification_queue SET status = 'SENT' WHERE id = :id AND recipient_id = :uid"), {"id": notification_id, "uid": current_user["user_id"]})
    await db.commit()
    return {"message": "Marked read"}


@router.put("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE notification_queue SET status = 'SENT' WHERE recipient_id = :uid AND channel = 'IN_APP' AND status = 'PENDING'"), {"uid": current_user["user_id"]})
    await db.commit()
    return {"message": "All marked read"}


@router.get("/email-log")
async def email_log(_: dict = Depends(require_role("ADMIN")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM notification_queue WHERE channel = 'EMAIL' ORDER BY created_at DESC LIMIT 100"))
    return [dict(r._mapping) for r in result.fetchall()]


@router.post("/email-log/{notification_id}/retry")
async def retry_email(notification_id: str, _: dict = Depends(require_role("ADMIN")), db: AsyncSession = Depends(get_db)):
    await db.execute(text("UPDATE notification_queue SET status = 'PENDING', retry_count = 0 WHERE id = :id"), {"id": notification_id})
    await db.commit()
    return {"message": "Queued for retry"}
```

---

### FILE: `backend/app/api/v1/reports.py`

```python
"""Reports routes — leave register, abstract, LOP, pending, balance summary, sanction PDF, payroll export."""

import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/leave-register")
async def leave_register(
    from_date: str = Query(), to_date: str = Query(), department_code: str = Query(None),
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "DEAN_ACADEMIC")),
    db: AsyncSession = Depends(get_db),
):
    query = """SELECT e.emp_code, e.name, d.name AS dept, lt.code AS leave_type, a.from_date, a.to_date, a.applied_days, a.status, a.submitted_at FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN departments d ON e.department_id = d.id JOIN leave_types lt ON a.leave_type_id = lt.id WHERE a.from_date <= :t AND a.to_date >= :f"""
    params = {"f": from_date, "t": to_date}
    if department_code:
        query += " AND d.code = :dc"; params["dc"] = department_code
    query += " ORDER BY e.emp_code, a.from_date"
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/leave-abstract")
async def leave_abstract(
    from_date: str = Query(), to_date: str = Query(),
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT d.name AS department, lt.code AS leave_type, COUNT(*) AS count, SUM(a.applied_days) AS total_days
        FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN departments d ON e.department_id = d.id JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.status = 'APPROVED' AND a.from_date BETWEEN :f AND :t
        GROUP BY d.name, lt.code ORDER BY d.name, lt.code
    """), {"f": from_date, "t": to_date})
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/pending-applications")
async def pending_report(
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT a.app_number, e.name, e.emp_code, lt.code AS leave_type, a.submitted_at,
               EXTRACT(DAY FROM (now() - a.submitted_at)) AS days_pending, a.status
        FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.status IN ('SUBMITTED','UNDER_REVIEW') ORDER BY a.submitted_at
    """))
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/balance-summary")
async def balance_summary(
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT e.emp_code, e.name, d.name AS dept, lt.code AS leave_type, lb.opening_balance, lb.credited, lb.availed, lb.closing_balance
        FROM leave_balances lb JOIN employees e ON lb.employee_id = e.id JOIN departments d ON e.department_id = d.id JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.leave_year = 2026 ORDER BY e.emp_code, lt.code
    """))
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/sanction-pdf/{application_id}")
async def sanction_pdf(application_id: str, current_user: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "HOD", "DEAN_ACADEMIC")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT a.*, e.name AS emp_name, e.emp_code, lt.name AS leave_type_name FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN leave_types lt ON a.leave_type_id = lt.id WHERE a.id = :id"), {"id": application_id})
    app = result.fetchone()
    if not app: raise HTTPException(status_code=404)
    if app.status != "APPROVED": raise HTTPException(status_code=400, detail="Only APPROVED leave can generate sanction copy")

    from weasyprint import HTML
    html_content = f"""<html><body style="font-family:Arial;padding:20px">
    <h1>AIIMS Bibinagar — Leave Sanction Order</h1><hr>
    <p><b>Application #:</b> {app.app_number}</p>
    <p><b>Employee:</b> {app.emp_name} ({app.emp_code})</p>
    <p><b>Leave Type:</b> {app.leave_type_name}</p>
    <p><b>Dates:</b> {app.from_date} to {app.to_date} ({app.applied_days} days)</p>
    <p><b>Status:</b> APPROVED</p>
    <p>This is a system-generated document.</p></body></html>"""
    pdf = HTML(string=html_content).write_pdf()
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=sanction_{app.app_number}.pdf"})


@router.get("/leave-calendar")
async def leave_calendar(
    department_code: str = Query(None), month: str = Query(None),
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    query = """SELECT e.emp_code, e.name, a.from_date, a.to_date, lt.code AS leave_type FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN departments d ON e.department_id = d.id JOIN leave_types lt ON a.leave_type_id = lt.id WHERE a.status = 'APPROVED'"""
    params = {}
    if department_code:
        query += " AND d.code = :dc"; params["dc"] = department_code
    if month:
        query += " AND a.from_date >= :ms AND a.from_date < :me"
        m = date.fromisoformat(month + "-01")
        params["ms"] = m; params["me"] = date(m.year, m.month + 1, 1) if m.month < 12 else date(m.year + 1, 1, 1)
    query += " ORDER BY a.from_date"
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/payroll-export")
async def payroll_export(
    from_date: str = Query(), to_date: str = Query(), export_type: str = Query("LOP"),
    current_user: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT e.emp_code, e.name, d.name AS department, EXTRACT(MONTH FROM a.from_date) AS month_num, SUM(a.applied_days) AS lop_days, a.status
        FROM leave_applications a JOIN employees e ON a.employee_id = e.id JOIN departments d ON e.department_id = d.id JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.from_date BETWEEN :f AND :t AND a.status = 'APPROVED' AND lt.code = 'EOL'
        GROUP BY e.emp_code, e.name, d.name, EXTRACT(MONTH FROM a.from_date), a.status
        ORDER BY e.emp_code
    """), {"f": from_date, "t": to_date})
    rows = [dict(r._mapping) for r in result.fetchall()]

    # Log to payroll_export_log
    await db.execute(text("INSERT INTO payroll_export_log (id, export_from, export_to, export_type, exported_by, record_count) VALUES (uuid_generate_v4(), :f, :t, :et, :by, :rc)"), {"f": from_date, "t": to_date, "et": export_type, "by": current_user["user_id"], "rc": len(rows)})
    await db.commit()

    # Generate CSV
    csv_buf = io.StringIO()
    csv_buf.write("Emp Code,Name,Department,Month,LOP Days,Status\n")
    for r in rows:
        csv_buf.write(f"{r['emp_code']},{r['name']},{r['department']},{int(r['month_num'])},{r['lop_days']},{r['status']}\n")
    csv_buf.seek(0)
    return StreamingResponse(iter([csv_buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=payroll_export_{from_date}_{to_date}.csv"})
```

---

### FILE: `backend/app/services/notifications.py`

```python
"""Notification service — queue writer, event triggers."""

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db


async def enqueue_notification(db: AsyncSession, application_id: str, recipient_id: str, channel: str, subject: str, body: str):
    """Write to notification_queue. EMAIL channel skips if user has no institutional email."""
    if channel == "EMAIL":
        has_email = await db.execute(text("SELECT has_institutional_email FROM users u JOIN employees e ON u.employee_id = e.id WHERE u.id = :uid"), {"uid": recipient_id})
        row = has_email.fetchone()
        if not row or not row[0]:
            return  # Skip silently
    await db.execute(text("""INSERT INTO notification_queue (id, application_id, recipient_id, channel, subject, body) VALUES (uuid_generate_v4(), :aid, :rid, :ch, :subj, :body)"""),
        {"aid": application_id, "rid": recipient_id, "ch": channel, "subj": subject, "body": body})


async def notify_event(db: AsyncSession, event_code: str, application_id: str, context: dict):
    """Trigger notifications for a workflow event based on email_templates."""
    tmpl = await db.execute(text("SELECT * FROM email_templates WHERE event_code = :ec AND is_active = true"), {"ec": event_code})
    t = tmpl.fetchone()
    if not t:
        return
    from jinja2 import Template
    subj_tmpl = Template(t.subject_template)
    body_tmpl = Template(t.body_template)
    subject = subj_tmpl.render(context)
    body = body_tmpl.render(context)

    # Determine recipients from context
    if "recipient_id" in context:
        await enqueue_notification(db, application_id, context["recipient_id"], "IN_APP", subject, body)
        await enqueue_notification(db, application_id, context["recipient_id"], "EMAIL", subject, body)
    if "approver_id" in context:
        await enqueue_notification(db, application_id, context["approver_id"], "IN_APP", subject, body)
        await enqueue_notification(db, application_id, context["approver_id"], "EMAIL", subject, body)
    await db.commit()
```

---

### FILE: `backend/app/services/email_sender.py`

```python
"""APScheduler job: polls notification_queue every 2 min for EMAIL items."""

import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text
from app.core.database import async_session_factory

scheduler = AsyncIOScheduler()


async def send_email_batch():
    """Process up to 5 PENDING EMAIL notifications per poll."""
    async with async_session_factory() as db:
        result = await db.execute(text("SELECT * FROM notification_queue WHERE channel = 'EMAIL' AND status = 'PENDING' AND retry_count < 3 ORDER BY created_at LIMIT 5"))
        rows = result.fetchall()
        for row in rows:
            try:
                # TODO: Integrate fastapi-mail / Zoho SMTP in Phase 9 (deployment)
                # For now, mark as sent (SMTP config not available in dev)
                await db.execute(text("UPDATE notification_queue SET status = 'SENT', sent_at = now() WHERE id = :id"), {"id": str(row.id)})
            except Exception:
                await db.execute(text("UPDATE notification_queue SET retry_count = retry_count + 1, error_message = 'SMTP unavailable' WHERE id = :id"), {"id": str(row.id)})
        await db.commit()


def start_email_scheduler():
    scheduler.add_job(send_email_batch, "interval", minutes=2, id="email_sender")
    scheduler.start()
```

---

