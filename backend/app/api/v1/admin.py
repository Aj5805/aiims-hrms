"""Admin panel routes -- audit log, health dashboard, session management."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db, engine

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/audit-log")
async def audit_log(
    entity_type: str = Query(None), actor_id: str = Query(None),
    action: str = Query(None), skip: int = Query(0), limit: int = Query(50),
    _: dict = Depends(require_role("ADMIN", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    query = "SELECT * FROM audit_log WHERE 1=1"
    params = {}
    if entity_type:
        query += " AND entity_type = :et"; params["et"] = entity_type
    if actor_id:
        query += " AND actor_id = :aid"; params["aid"] = actor_id
    if action:
        query += " AND action = :act"; params["act"] = action
    query += " ORDER BY created_at DESC LIMIT :lim OFFSET :skip"
    params["lim"] = limit; params["skip"] = skip
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/health-dashboard")
async def health_dashboard(
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    queue_depth = await db.execute(text("SELECT COUNT(*) FROM notification_queue WHERE status = 'PENDING'"))
    pending_count = queue_depth.fetchone()[0]

    error_count = await db.execute(text("SELECT COUNT(*) FROM notification_queue WHERE status = 'FAILED' AND created_at > now() - interval '24 hours'"))
    recent_errors = error_count.fetchone()[0]

    pool = engine.pool
    return {
        "queue_depth": pending_count,
        "recent_errors_24h": recent_errors,
        "db_pool_size": pool.size(),
        "db_pool_checked_in": pool.checked_in_connections(),
    }


@router.post("/force-logout/{user_id}")
async def force_logout(user_id: str, _: dict = Depends(require_role("ADMIN")), db: AsyncSession = Depends(get_db)):
    await db.execute(text("INSERT INTO token_blacklist (jti, user_id, expires_at) SELECT uuid_generate_v4(), :uid, now() + interval '8 hours'"), {"uid": user_id})
    await db.commit()
    return {"message": "All sessions invalidated"}