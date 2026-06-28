from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/broadcasts", tags=["broadcasts"])

class BroadcastCreate(BaseModel):
    message: str
    type: str = "info"
    is_active: bool = True
    expires_at: Optional[datetime] = None

class BroadcastUpdate(BaseModel):
    message: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None
    expires_at: Optional[datetime] = None

@router.get("/active")
async def get_active_broadcasts(db: AsyncSession = Depends(get_db)):
    """Public endpoint to fetch active broadcasts."""
    res = await db.execute(text("""
        SELECT id, message, type, expires_at 
        FROM system_broadcasts 
        WHERE is_active = true 
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC
    """))
    return [dict(row._mapping) for row in res.fetchall()]

@router.get("/")
async def get_all_broadcasts(
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Admin endpoint to fetch all broadcasts."""
    res = await db.execute(text("SELECT * FROM system_broadcasts ORDER BY created_at DESC"))
    return [dict(row._mapping) for row in res.fetchall()]

@router.post("/")
async def create_broadcast(
    data: BroadcastCreate,
    admin: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Admin endpoint to create a broadcast."""
    res = await db.execute(
        text("""
            INSERT INTO system_broadcasts (message, type, is_active, expires_at, created_by)
            VALUES (:message, :type, :is_active, :expires_at, :created_by)
            RETURNING *
        """),
        {
            "message": data.message,
            "type": data.type,
            "is_active": data.is_active,
            "expires_at": data.expires_at,
            "created_by": admin["user_id"]
        }
    )
    await db.commit()
    return dict(res.fetchone()._mapping)

@router.put("/{broadcast_id}")
async def update_broadcast(
    broadcast_id: str,
    data: BroadcastUpdate,
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db)
):
    """Admin endpoint to update a broadcast (e.g. toggle active)."""
    updates = []
    params = {"id": broadcast_id}
    if data.message is not None:
        updates.append("message = :message")
        params["message"] = data.message
    if data.type is not None:
        updates.append("type = :type")
        params["type"] = data.type
    if data.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = data.is_active
    if data.expires_at is not None:
        updates.append("expires_at = :expires_at")
        params["expires_at"] = data.expires_at
        
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
        
    query = f"UPDATE system_broadcasts SET {', '.join(updates)} WHERE id = :id RETURNING *"
    res = await db.execute(text(query), params)
    updated = res.fetchone()
    if not updated:
        raise HTTPException(status_code=404, detail="Broadcast not found")
        
    await db.commit()
    return dict(updated._mapping)
