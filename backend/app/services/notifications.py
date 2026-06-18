"""Notification service -- queue writer, event triggers."""

from jinja2 import Template
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


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


async def notify_event(db: AsyncSession, event_code: str, application_id: str, context: dict):
    """Trigger notifications for a workflow event based on email_templates."""
    tmpl = await db.execute(
        text("SELECT * FROM email_templates WHERE event_code = :ec AND is_active = true"),
        {"ec": event_code},
    )
    template_row = tmpl.fetchone()
    if not template_row:
        return

    template_context = {
        "app_number": context.get("app_number"),
        "employee_name": context.get("employee_name") or context.get("applicant_name"),
        "applicant_name": context.get("applicant_name") or context.get("employee_name"),
        "approver_name": context.get("approver_name"),
        "leave_type": context.get("leave_type"),
        "from_date": context.get("from_date"),
        "to_date": context.get("to_date"),
        "days": context.get("days"),
        "status": context.get("status"),
        "reason": context.get("reason"),
        "remarks": context.get("remarks"),
        "emp_code": context.get("emp_code"),
        "original_from": context.get("original_from"),
        "original_to": context.get("original_to"),
        "modified_from": context.get("modified_from"),
        "modified_to": context.get("modified_to"),
        "pending_hours": context.get("pending_hours"),
        "sla_hours": context.get("sla_hours"),
        "balance": context.get("balance"),
    }
    subject_template = Template(template_row.subject_template)
    body_template = Template(template_row.body_template)
    subject = subject_template.render(template_context)
    body = body_template.render(template_context)

    recipients = []
    if context.get("recipient_id"):
        recipients.append(context["recipient_id"])
    if context.get("approver_id"):
        recipients.append(context["approver_id"])
    for recipient_id in dict.fromkeys(recipients):
        await enqueue_notification(db, application_id, recipient_id, "IN_APP", subject, body)
        await enqueue_notification(db, application_id, recipient_id, "EMAIL", subject, body)
