"""Leave application validation driven by leave-type and entitlement config."""

from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _parse_rules(raw: Any) -> dict:
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return {}


def count_leave_days(
    from_date: date,
    to_date: date,
    holidays: set[date],
    *,
    count_holidays: bool,
    is_half_day: bool,
) -> float:
    if is_half_day:
        return 0.5
    total = 0
    d = from_date
    while d <= to_date:
        if count_holidays:
            if d.weekday() < 5:
                total += 1
        elif d.weekday() < 5 and d not in holidays:
            total += 1
        d += timedelta(days=1)
    return float(total)


async def load_holidays_in_range(
    db: AsyncSession, start: date, end: date
) -> set[date]:
    result = await db.execute(
        text("SELECT holiday_date FROM holiday_master WHERE holiday_date BETWEEN :f AND :t"),
        {"f": start, "t": end},
    )
    return {row[0] for row in result.fetchall()}


def check_prefix_suffix(
    from_date: date,
    to_date: date,
    holidays: set[date],
    validation_rules: dict,
) -> str | None:
    """CCS-style rule: block leave adjacent to holidays/weekends when configured."""
    block_holidays = validation_rules.get("no_prefix_suffix_holidays", False)
    block_weekends = validation_rules.get("no_prefix_suffix_weekends", block_holidays)

    if not block_holidays and not block_weekends:
        return None

    prev_day = from_date - timedelta(days=1)
    next_day = to_date + timedelta(days=1)

    if block_holidays:
        if prev_day in holidays:
            return "Leave cannot be prefixed to a holiday"
        if next_day in holidays:
            return "Leave cannot be suffixed to a holiday"

    if block_weekends:
        if prev_day.weekday() >= 5:
            return "Leave cannot be prefixed to a weekend"
        if next_day.weekday() >= 5:
            return "Leave cannot be suffixed to a weekend"

    return None


async def fetch_entitlement_for_type(
    db: AsyncSession, employee_id: str, leave_type_id: str
) -> dict | None:
    result = await db.execute(
        text("""
            SELECT ler.max_at_a_stretch, ler.max_in_tenure, ler.special_rules
            FROM leave_entitlement_rules ler
            JOIN employees e ON e.category_id = ler.category_id
            WHERE e.id = :eid AND ler.leave_type_id = :lid
            LIMIT 1
        """),
        {"eid": employee_id, "lid": leave_type_id},
    )
    row = result.fetchone()
    return dict(row._mapping) if row else None


async def validate_leave_application(
    db: AsyncSession,
    *,
    employee_id: str,
    leave_type: dict,
    from_date: date,
    to_date: date,
    is_half_day: bool,
    mc_attached: bool,
    application_kind: str = "NEW",
    parent_applied_days: float | None = None,
) -> float:
    """Run institutional validation rules. Returns computed applied_days."""
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="from_date must be <= to_date")

    validation_rules = _parse_rules(leave_type.get("validation_rules"))
    count_holidays = bool(leave_type.get("count_holidays"))

    pad_start = from_date - timedelta(days=1)
    pad_end = to_date + timedelta(days=1)
    holidays = await load_holidays_in_range(db, pad_start, pad_end)
    holidays.update(await load_holidays_in_range(db, from_date, to_date))

    applied_days = count_leave_days(
        from_date,
        to_date,
        holidays,
        count_holidays=count_holidays,
        is_half_day=is_half_day,
    )

    if application_kind == "CANCELLATION":
        return float(parent_applied_days or applied_days)

    prefix_suffix_error = check_prefix_suffix(from_date, to_date, holidays, validation_rules)
    if prefix_suffix_error:
        raise HTTPException(status_code=400, detail=prefix_suffix_error)

    max_stretch = validation_rules.get("max_per_stretch")
    entitlement = await fetch_entitlement_for_type(db, employee_id, str(leave_type["id"]))
    if entitlement and entitlement.get("max_at_a_stretch"):
        max_stretch = max_stretch or float(entitlement["max_at_a_stretch"])
    if max_stretch and not is_half_day and applied_days > float(max_stretch):
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {max_stretch} days at a stretch for this leave type",
        )

    min_notice = validation_rules.get("min_notice_days")
    if min_notice is not None:
        notice_days = (from_date - date.today()).days
        if notice_days < int(min_notice):
            raise HTTPException(
                status_code=400,
                detail=f"Minimum {min_notice} days advance notice required",
            )

    requires_mc = leave_type.get("requires_mc")
    min_days_for_mc = leave_type.get("min_days_for_mc")
    if requires_mc and min_days_for_mc is not None and applied_days > float(min_days_for_mc):
        if not mc_attached:
            raise HTTPException(
                status_code=400,
                detail=f"Medical certificate required for more than {min_days_for_mc} days",
            )

    if validation_rules.get("requires_attachment") and not mc_attached:
        raise HTTPException(status_code=400, detail="Supporting document attachment is required")

    return applied_days


async def validate_workflow_day_limits(
    db: AsyncSession,
    config_id: str,
    applied_days: float,
) -> None:
    result = await db.execute(
        text("SELECT min_days, max_days FROM workflow_configs WHERE id = :cid"),
        {"cid": config_id},
    )
    row = result.fetchone()
    if not row:
        return
    min_days, max_days = row[0], row[1]
    if min_days is not None and applied_days < float(min_days):
        raise HTTPException(
            status_code=400,
            detail=f"Minimum {min_days} days required for this workflow",
        )
    if max_days is not None and applied_days > float(max_days):
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {max_days} days allowed for this workflow",
        )
