"""Notification service -- queue writer, event triggers."""

from jinja2 import Template
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# When both applicant and approver are notified, approver gets this event instead.
_APPROVER_EVENT_MAP = {
    "APP_SUBMITTED": "APPROVAL_REQUEST",
}

# Applicant already knows they submitted — notify approver only.
_APPLICANT_SKIP_EVENTS = frozenset({"APP_SUBMITTED"})


async def _resolve_display_name(db: AsyncSession, user_id: str) -> str:
    result = await db.execute(
        text("""
            SELECT COALESCE(e.name, u.username, 'Sir/Madam') AS name
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.id = :uid
        """),
        {"uid": user_id},
    )
    row = result.fetchone()
    return str(row.name) if row else "Sir/Madam"


async def enqueue_notification(db: AsyncSession, application_id: str, recipient_id: str, channel: str, subject: str, body: str):
    """Write to notification_queue. EMAIL channel skips if user has no institutional email."""
    if channel == "EMAIL":
        has_email = await db.execute(
            text(
                "SELECT has_institutional_email FROM users u JOIN employees e ON u.employee_id = e.id WHERE u.id = :uid"
            ),
            {"uid": recipient_id},
        )
        row = has_email.fetchone()
        if not row:
            return
        if isinstance(row, (tuple, list)):
            has_institutional_email = bool(row[0])
        else:
            has_institutional_email = bool(row)
        if not has_institutional_email:
            return
    await db.execute(
        text(
            """
            INSERT INTO notification_queue (id, application_id, recipient_id, channel, subject, body)
            VALUES (uuid_generate_v4(), :aid, :rid, :ch, :subj, :body)
            """
        ),
        {"aid": application_id, "rid": recipient_id, "ch": channel, "subj": subject, "body": body},
    )


async def _notify_recipient(
    db: AsyncSession,
    event_code: str,
    application_id: str,
    context: dict,
    recipient_id: str,
):
    tmpl = await db.execute(
        text("SELECT * FROM email_templates WHERE event_code = :ec AND is_active = true"),
        {"ec": event_code},
    )
    template_row = tmpl.fetchone()
    if not template_row:
        return

    approver_name = context.get("approver_name")
    if event_code == "APPROVAL_REQUEST" and not approver_name:
        approver_name = await _resolve_display_name(db, recipient_id)

    template_context = {
        "app_number": context.get("app_number"),
        "employee_name": context.get("employee_name") or context.get("applicant_name"),
        "applicant_name": context.get("applicant_name") or context.get("employee_name"),
        "approver_name": approver_name,
        "leave_type": context.get("leave_type"),
        "from_date": context.get("from_date"),
        "to_date": context.get("to_date"),
        "days": context.get("days"),
        "status": context.get("status"),
        "reason": context.get("reason"),
        "remarks": context.get("remarks") or context.get("reason"),
        "emp_code": context.get("emp_code"),
        "original_from": context.get("original_from"),
        "original_to": context.get("original_to"),
        "modified_from": context.get("modified_from"),
        "modified_to": context.get("modified_to"),
        "pending_hours": context.get("pending_hours"),
        "sla_hours": context.get("sla_hours"),
        "balance": context.get("balance"),
    }
    subject = Template(template_row.subject_template).render(template_context)
    body = Template(template_row.body_template).render(template_context)
    await enqueue_notification(db, application_id, recipient_id, "IN_APP", subject, body)
    await enqueue_notification(db, application_id, recipient_id, "EMAIL", subject, body)


async def notify_event(db: AsyncSession, event_code: str, application_id: str, context: dict):
    """Trigger notifications for a workflow event based on email_templates."""
    recipient_id = context.get("recipient_id")
    approver_id = context.get("approver_id")
    approver_event = context.get("approver_event") or _APPROVER_EVENT_MAP.get(event_code, event_code)

    if recipient_id and event_code not in _APPLICANT_SKIP_EVENTS:
        await _notify_recipient(db, event_code, application_id, context, recipient_id)
    if approver_id and approver_id != recipient_id:
        await _notify_recipient(db, approver_event, application_id, context, approver_id)
