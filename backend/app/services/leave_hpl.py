"""HPL commutation — full-pay medical leave debited at 2× from HPL balance."""

from __future__ import annotations

from datetime import date

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.leave_transaction import assert_sufficient_balance, get_effective_available_balance

HPL_CODE = "HPL"
COMMUTED_LIFETIME_CAP_DAYS = 180


def balance_debit_days(applied_days: float, leave_type_code: str, *, is_commuted: bool) -> float:
    """Calendar days debited from the leave balance bucket."""
    if leave_type_code.upper() == HPL_CODE and is_commuted:
        return float(applied_days) * 2
    return float(applied_days)


async def lifetime_commuted_calendar_days(
    db: AsyncSession,
    employee_id: str,
    *,
    exclude_application_ids: list[str] | None = None,
) -> float:
    """Sum approved commuted HPL calendar days over entire service."""
    exclude_application_ids = exclude_application_ids or []
    result = await db.execute(
        text("""
            SELECT COALESCE(SUM(a.applied_days), 0)
            FROM leave_applications a
            JOIN leave_types lt ON a.leave_type_id = lt.id
            WHERE a.employee_id = :eid
              AND lt.code = :hpl
              AND a.is_commuted = true
              AND a.status = 'APPROVED'
              AND (CARDINALITY(CAST(:exclude AS uuid[])) = 0 OR a.id != ALL(CAST(:exclude AS uuid[])))
        """),
        {"eid": employee_id, "hpl": HPL_CODE, "exclude": exclude_application_ids},
    )
    row = result.fetchone()
    return float(row[0] or 0) if row else 0.0


async def validate_hpl_commutation(
    db: AsyncSession,
    *,
    employee_id: str,
    leave_type_id: str,
    from_date: date,
    applied_days: float,
    is_commuted: bool,
    is_half_day: bool,
    mc_attached: bool,
    exclude_application_ids: list[str] | None = None,
) -> None:
    if not is_commuted:
        return

    if is_half_day:
        raise HTTPException(status_code=400, detail="Commuted HPL must be whole days (no half-day)")

    if not mc_attached:
        raise HTTPException(
            status_code=400,
            detail="Medical certificate is required when commuting HPL to full pay",
        )

    if applied_days <= 0:
        raise HTTPException(status_code=400, detail="Commuted HPL requires at least one whole day")

    lifetime = await lifetime_commuted_calendar_days(
        db, employee_id, exclude_application_ids=exclude_application_ids
    )
    if lifetime + applied_days > COMMUTED_LIFETIME_CAP_DAYS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Commuted HPL lifetime limit is {COMMUTED_LIFETIME_CAP_DAYS} calendar days "
                f"({lifetime:.0f} already availed, {applied_days:.0f} requested)"
            ),
        )

    debit = balance_debit_days(applied_days, HPL_CODE, is_commuted=True)
    available = await get_effective_available_balance(
        db,
        employee_id,
        leave_type_id,
        from_date,
        exclude_application_id=(exclude_application_ids[0] if exclude_application_ids else None),
    )
    max_commuted_calendar = available / 2
    if applied_days > max_commuted_calendar:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Commuted HPL cannot exceed half of available HPL balance "
                f"({max_commuted_calendar:.1f} calendar day(s) at full pay, "
                f"{available:.1f} HPL day(s) available)"
            ),
        )

    await assert_sufficient_balance(
        db,
        employee_id,
        leave_type_id,
        from_date,
        debit,
        exclude_application_id=(exclude_application_ids[0] if exclude_application_ids else None),
    )
