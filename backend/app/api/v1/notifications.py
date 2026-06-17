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