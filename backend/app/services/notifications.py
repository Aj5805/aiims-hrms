"""Notification service -- queue writer, event triggers."""

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