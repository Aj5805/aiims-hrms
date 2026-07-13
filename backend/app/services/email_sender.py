"""APScheduler job: polls notification_queue every 2 min for EMAIL items."""

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text

from app.core.database import async_session_factory
from app.services.email_config import EmailConfig, load_email_config

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


def send_email_message_sync(config: EmailConfig, to_email: str, subject: str, body: str) -> None:
    if not config.sending_enabled or not config.from_email or not config.app_password:
        raise RuntimeError("SMTP sending is disabled or credentials are missing")

    message = EmailMessage()
    message["From"] = config.from_email
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body, subtype="plain")

    with smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=20) as smtp:
        smtp.starttls()
        smtp.login(config.from_email, config.app_password)
        smtp.send_message(message)


async def send_email_batch():
    """Process up to 5 PENDING EMAIL notifications per poll with advisory-lock protection."""
    async with async_session_factory() as db:
        config = await load_email_config(db)
        if not config.sending_enabled:
            return

        lock_result = await db.execute(text("SELECT pg_try_advisory_lock(123456789)"))
        if not lock_result.scalar_one():
            return
        try:
            result = await db.execute(
                text(
                    "SELECT * FROM notification_queue WHERE channel = 'EMAIL' AND status = 'PENDING' AND retry_count < 3 ORDER BY created_at LIMIT 5"
                )
            )
            rows = result.fetchall()
            for idx, row in enumerate(rows):
                try:
                    recipient_email = await db.execute(
                        text(
                            "SELECT email FROM employees e JOIN users u ON u.employee_id = e.id WHERE u.id = :uid"
                        ),
                        {"uid": str(row.recipient_id)},
                    )
                    email_row = recipient_email.fetchone()
                    if not email_row or not email_row[0]:
                        await db.execute(
                            text("UPDATE notification_queue SET status = 'FAILED', error_message = 'No recipient email' WHERE id = :id"),
                            {"id": str(row.id)},
                        )
                        continue
                    await asyncio.to_thread(
                        send_email_message_sync,
                        config,
                        str(email_row[0]),
                        row.subject or "HRMS Notification",
                        row.body or "",
                    )
                    await db.execute(
                        text("UPDATE notification_queue SET status = 'SENT', sent_at = now(), error_message = NULL WHERE id = :id"),
                        {"id": str(row.id)},
                    )
                except Exception as exc:
                    await db.execute(
                        text(
                            "UPDATE notification_queue SET retry_count = retry_count + 1, status = 'PENDING', error_message = :err WHERE id = :id"
                        ),
                        {"id": str(row.id), "err": str(exc)},
                    )
                if idx < len(rows) - 1:
                    await asyncio.sleep(6)
            await db.commit()
        finally:
            await db.execute(text("SELECT pg_advisory_unlock(123456789)"))
            await db.commit()


def start_email_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(send_email_batch, "interval", minutes=2, id="email_sender")
    scheduler.start()
