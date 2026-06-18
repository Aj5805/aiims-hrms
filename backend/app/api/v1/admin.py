"""Admin panel routes -- audit log, health dashboard, session management."""

from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.config import settings
from app.core.database import engine, get_db

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/audit-log")
async def audit_log(
    entity_type: str | None = Query(None),
    actor_id: str | None = Query(None),
    action: str | None = Query(None),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    skip: int = Query(0),
    limit: int = Query(50),
    _: dict = Depends(require_role("ADMIN", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    query = "SELECT * FROM audit_log WHERE 1=1"
    params: dict[str, object] = {"skip": skip, "limit": limit}

    if entity_type:
        query += " AND entity_type = :entity_type"
        params["entity_type"] = entity_type
    if actor_id:
        query += " AND actor_id = :actor_id"
        params["actor_id"] = actor_id
    if action:
        query += " AND action = :action"
        params["action"] = action
    if from_date:
        query += " AND created_at >= :from_ts"
        params["from_ts"] = datetime.combine(date.fromisoformat(from_date), datetime.min.time())
    if to_date:
        query += " AND created_at < :to_ts"
        params["to_ts"] = datetime.combine(date.fromisoformat(to_date), datetime.min.time()) + timedelta(days=1)

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :skip"
    result = await db.execute(text(query), params)
    return [dict(row._mapping) for row in result.fetchall()]


@router.get("/health-dashboard")
async def health_dashboard(
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    queue_depth = await db.execute(text("SELECT COUNT(*) FROM notification_queue WHERE status = 'PENDING'"))
    pending_count = int(queue_depth.scalar() or 0)

    error_count = await db.execute(
        text("SELECT COUNT(*) FROM notification_queue WHERE status = 'FAILED' AND created_at > now() - interval '24 hours'")
    )
    recent_errors = int(error_count.scalar() or 0)

    total_recent = await db.execute(text("SELECT COUNT(*) FROM notification_queue WHERE created_at > now() - interval '24 hours'"))
    total_recent_notifications = int(total_recent.scalar() or 0)
    error_rate = round(recent_errors / total_recent_notifications, 4) if total_recent_notifications else 0.0

    backup_dir = Path(settings.BACKUP_DIR)
    last_backup = None
    if backup_dir.exists() and backup_dir.is_dir():
        backup_files = [path for path in backup_dir.iterdir() if path.is_file()]
        if backup_files:
            latest = max(backup_files, key=lambda item: item.stat().st_mtime)
            last_backup = datetime.fromtimestamp(latest.stat().st_mtime).isoformat()

    pool = engine.pool
    return {
        "queue_depth": pending_count,
        "recent_errors_24h": recent_errors,
        "error_rate": error_rate,
        "db_pool_size": pool.size(),
        "db_pool_checked_in": pool.checkedin(),
        "last_backup": last_backup,
    }


@router.post("/force-logout/{user_id}")
async def force_logout(user_id: str, _: dict = Depends(require_role("ADMIN")), db: AsyncSession = Depends(get_db)):
    await db.execute(
        text("INSERT INTO token_blacklist (jti, user_id, expires_at) SELECT uuid_generate_v4(), :user_id, now() + interval '8 hours'"),
        {"user_id": user_id},
    )
    await db.commit()
    return {"message": "All sessions invalidated"}
