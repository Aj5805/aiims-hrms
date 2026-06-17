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
                # Local-dev stub: this scheduler does not send real email yet.
                # Keep queue flow moving in development by marking the item as sent.
                await db.execute(text("UPDATE notification_queue SET status = 'SENT', sent_at = now() WHERE id = :id"), {"id": str(row.id)})
            except Exception:
                await db.execute(text("UPDATE notification_queue SET retry_count = retry_count + 1, error_message = 'SMTP unavailable' WHERE id = :id"), {"id": str(row.id)})
        await db.commit()


def start_email_scheduler():
    scheduler.add_job(send_email_batch, "interval", minutes=2, id="email_sender")
    scheduler.start()
