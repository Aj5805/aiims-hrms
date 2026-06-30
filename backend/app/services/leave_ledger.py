"""Append-only leave balance ledger writer."""

import json
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def _balance_snapshot(db: AsyncSession, balance_id: str) -> dict:
    row = await db.execute(
        text("""
            SELECT opening_balance, credited, availed, lop_days, closing_balance
            FROM leave_balances WHERE id = :bid
        """),
        {"bid": balance_id},
    )
    snap = row.fetchone()
    if not snap:
        return {}
    return {
        "opening_balance": float(snap.opening_balance or 0),
        "credited": float(snap.credited or 0),
        "availed": float(snap.availed or 0),
        "lop_days": float(snap.lop_days or 0),
        "closing_balance": float(snap.closing_balance or 0),
    }


async def record_leave_ledger(
    db: AsyncSession,
    *,
    balance_id: str,
    employee_id: str,
    leave_type_id: str,
    leave_year: int,
    txn_type: str,
    amount: float,
    field_affected: str,
    reference_type: str | None = None,
    reference_id: str | None = None,
    reason: str | None = None,
    actor_id: str | None = None,
    impersonated_by: str | None = None,
) -> None:
    snapshot = await _balance_snapshot(db, balance_id)
    await db.execute(
        text("""
            INSERT INTO leave_balance_ledger (
                id, balance_id, employee_id, leave_type_id, leave_year,
                txn_type, amount, field_affected, reference_type, reference_id,
                reason, actor_id, impersonated_by, snapshot
            ) VALUES (
                :id, :bid, :eid, :lid, :ly,
                :txn, :amt, :field, :ref_type, :ref_id,
                :reason, :actor, :imp, CAST(:snap AS jsonb)
            )
        """),
        {
            "id": str(uuid.uuid4()),
            "bid": balance_id,
            "eid": employee_id,
            "lid": leave_type_id,
            "ly": leave_year,
            "txn": txn_type,
            "amt": amount,
            "field": field_affected,
            "ref_type": reference_type,
            "ref_id": reference_id,
            "reason": reason,
            "actor": actor_id,
            "imp": impersonated_by,
            "snap": json.dumps(snapshot),
        },
    )
