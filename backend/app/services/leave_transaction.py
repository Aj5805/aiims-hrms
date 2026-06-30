"""Atomic leave balance movements tied to applications."""

from datetime import date

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.leave_ledger import record_leave_ledger


class LeaveBalanceError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


async def _fetch_balance_row(
    db: AsyncSession,
    employee_id: str,
    leave_type_id: str,
    leave_year: int,
    *,
    for_update: bool,
) -> dict | None:
    lock = "FOR UPDATE" if for_update else ""
    result = await db.execute(
        text(f"""
            SELECT id, employee_id, leave_type_id, leave_year,
                   opening_balance, credited, availed, closing_balance
            FROM leave_balances
            WHERE employee_id = :eid AND leave_type_id = :lid AND leave_year = :ly
            {lock}
        """),
        {"eid": employee_id, "lid": leave_type_id, "ly": leave_year},
    )
    row = result.fetchone()
    return dict(row._mapping) if row else None


def leave_year_for_date(from_date: date) -> int:
    """Calendar-year balance bucket (owner policy)."""
    return from_date.year


async def get_pending_committed_days(
    db: AsyncSession,
    employee_id: str,
    leave_type_id: str,
    leave_year: int,
    *,
    exclude_application_id: str | None = None,
) -> float:
    """Sum days reserved by in-flight applications (accounts for simultaneous requests)."""
    result = await db.execute(
        text("""
            SELECT COALESCE(SUM(
                CASE
                    WHEN a.application_kind = 'MODIFICATION' AND p.id IS NOT NULL THEN
                        GREATEST(a.applied_days - p.applied_days, 0)
                    WHEN a.application_kind = 'CANCELLATION' THEN 0
                    ELSE a.applied_days
                END
            ), 0) AS pending_days
            FROM leave_applications a
            LEFT JOIN leave_applications p ON a.parent_application_id = p.id
            WHERE a.employee_id = :eid
              AND a.leave_type_id = :lid
              AND EXTRACT(YEAR FROM a.from_date)::int = :ly
              AND a.status IN ('SUBMITTED', 'UNDER_REVIEW')
              AND (:exclude IS NULL OR a.id != CAST(:exclude AS uuid))
        """),
        {
            "eid": employee_id,
            "lid": leave_type_id,
            "ly": leave_year,
            "exclude": exclude_application_id,
        },
    )
    row = result.fetchone()
    return float(row[0] or 0) if row else 0.0


async def get_effective_available_balance(
    db: AsyncSession,
    employee_id: str,
    leave_type_id: str,
    from_date: date,
    *,
    exclude_application_id: str | None = None,
) -> float:
    leave_year = leave_year_for_date(from_date)
    row = await _fetch_balance_row(db, employee_id, leave_type_id, leave_year, for_update=False)
    closing = float(row["closing_balance"] or 0) if row else 0.0
    pending = await get_pending_committed_days(
        db,
        employee_id,
        leave_type_id,
        leave_year,
        exclude_application_id=exclude_application_id,
    )
    return max(0.0, closing - pending)


async def get_available_balance(
    db: AsyncSession,
    employee_id: str,
    leave_type_id: str,
    from_date: date,
) -> float:
    return await get_effective_available_balance(db, employee_id, leave_type_id, from_date)


async def assert_sufficient_balance(
    db: AsyncSession,
    employee_id: str,
    leave_type_id: str,
    from_date: date,
    days: float,
    *,
    exclude_application_id: str | None = None,
) -> None:
    if days <= 0:
        return
    available = await get_effective_available_balance(
        db,
        employee_id,
        leave_type_id,
        from_date,
        exclude_application_id=exclude_application_id,
    )
    if days > available:
        pending = await get_pending_committed_days(
            db,
            employee_id,
            leave_type_id,
            leave_year_for_date(from_date),
            exclude_application_id=exclude_application_id,
        )
        detail = f"Insufficient balance: {available} available after pending commitments"
        if pending > 0:
            detail += f" ({pending} days held by other in-flight applications)"
        detail += f", {days} requested"
        raise HTTPException(status_code=400, detail=detail)


async def _deduction_exists(db: AsyncSession, application_id: str) -> bool:
    result = await db.execute(
        text("""
            SELECT 1 FROM leave_balance_ledger
            WHERE reference_type = 'application'
              AND reference_id = :aid
              AND txn_type = 'AVAIL'
            LIMIT 1
        """),
        {"aid": application_id},
    )
    return result.fetchone() is not None


async def deduct_on_final_approval(
    db: AsyncSession,
    *,
    employee_id: str,
    leave_type_id: str,
    from_date: date,
    days: float,
    application_id: str,
    actor_id: str,
    impersonated_by: str | None = None,
) -> str | None:
    """Lock balance, verify funds (incl. pending), deduct availed, append ledger."""
    if days <= 0:
        raise LeaveBalanceError("Applied days must be greater than zero")

    if await _deduction_exists(db, application_id):
        return None

    leave_year = leave_year_for_date(from_date)
    bal = await _fetch_balance_row(db, employee_id, leave_type_id, leave_year, for_update=True)
    if not bal:
        raise LeaveBalanceError(
            f"No leave balance for year {leave_year}. Run onboarding bootstrap or annual credit first."
        )

    pending = await get_pending_committed_days(
        db,
        employee_id,
        leave_type_id,
        leave_year,
        exclude_application_id=application_id,
    )
    available = float(bal["closing_balance"] or 0) - pending
    if days > available:
        raise LeaveBalanceError(
            f"Insufficient balance at approval: {available} available after pending commitments, {days} requested"
        )

    balance_id = str(bal["id"])
    await db.execute(
        text("""
            UPDATE leave_balances
            SET availed = COALESCE(availed, 0) + :days, last_updated = now()
            WHERE id = :bid
        """),
        {"days": days, "bid": balance_id},
    )
    await record_leave_ledger(
        db,
        balance_id=balance_id,
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        leave_year=leave_year,
        txn_type="AVAIL",
        amount=days,
        field_affected="availed",
        reference_type="application",
        reference_id=application_id,
        reason="Leave approved",
        actor_id=actor_id,
        impersonated_by=impersonated_by,
    )
    return balance_id


async def adjust_balance_delta(
    db: AsyncSession,
    *,
    employee_id: str,
    leave_type_id: str,
    from_date: date,
    delta_days: float,
    application_id: str,
    actor_id: str,
    reason: str,
    impersonated_by: str | None = None,
) -> str | None:
    """Apply a positive (deduct) or negative (restore) balance change."""
    if delta_days == 0:
        return None
    if delta_days > 0:
        return await deduct_on_final_approval(
            db,
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            from_date=from_date,
            days=delta_days,
            application_id=application_id,
            actor_id=actor_id,
            impersonated_by=impersonated_by,
        )
    leave_year = leave_year_for_date(from_date)
    bal = await _fetch_balance_row(db, employee_id, leave_type_id, leave_year, for_update=True)
    if not bal:
        raise LeaveBalanceError(f"No leave balance for year {leave_year}")
    restore_amount = abs(delta_days)
    balance_id = str(bal["id"])
    await db.execute(
        text("""
            UPDATE leave_balances
            SET availed = GREATEST(0, COALESCE(availed, 0) - :days), last_updated = now()
            WHERE id = :bid
        """),
        {"days": restore_amount, "bid": balance_id},
    )
    await record_leave_ledger(
        db,
        balance_id=balance_id,
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        leave_year=leave_year,
        txn_type="REVERSAL",
        amount=restore_amount,
        field_affected="availed",
        reference_type="application",
        reference_id=application_id,
        reason=reason,
        actor_id=actor_id,
        impersonated_by=impersonated_by,
    )
    return balance_id


async def restore_on_recall(
    db: AsyncSession,
    *,
    employee_id: str,
    leave_type_id: str,
    from_date: date,
    days: float,
    application_id: str,
    actor_id: str,
    impersonated_by: str | None = None,
) -> str | None:
    """Reverse an approval deduction. Idempotent if no prior AVAIL ledger entry."""
    if not await _deduction_exists(db, application_id):
        return None

    reversal_exists = await db.execute(
        text("""
            SELECT 1 FROM leave_balance_ledger
            WHERE reference_type = 'application'
              AND reference_id = :aid
              AND txn_type = 'REVERSAL'
            LIMIT 1
        """),
        {"aid": application_id},
    )
    if reversal_exists.fetchone():
        return None

    return await adjust_balance_delta(
        db,
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        from_date=from_date,
        delta_days=-days,
        application_id=application_id,
        actor_id=actor_id,
        reason="Leave recalled",
        impersonated_by=impersonated_by,
    )
