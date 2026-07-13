"""Leave application validation driven by leave-type and entitlement config."""

from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.working_days import is_non_working_day as _is_non_working_day
from app.services.working_days import is_weekend

CL_CODE = "CL"
DEFAULT_CL_INCOMPATIBLE = frozenset({"EL", "HPL", "EOL"})
DEFAULT_MAX_ABSENCE_SPAN = 8
DEFAULT_MAX_RETROSPECTIVE_DAYS = 30


def _parse_rules(raw: Any) -> dict:
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return {}


def is_non_working_day(d: date, holidays: set[date]) -> bool:
    return _is_non_working_day(d, holidays)


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
    if from_date == to_date:
        # Single-day absence: one debited unit (from and to on the same date).
        return 1.0
    total = 0
    d = from_date
    while d <= to_date:
        if count_holidays:
            if not is_weekend(d):
                total += 1
        elif not is_non_working_day(d, holidays):
            total += 1
        d += timedelta(days=1)
    return float(total)


def expand_absence_span(
    from_date: date,
    to_date: date,
    holidays: set[date],
) -> tuple[date, date, int]:
    """DoPT CL rule: calendar absence including attached weekends/holidays."""
    start = from_date
    while True:
        prev = start - timedelta(days=1)
        if is_non_working_day(prev, holidays):
            start = prev
        else:
            break

    end = to_date
    while True:
        nxt = end + timedelta(days=1)
        if is_non_working_day(nxt, holidays):
            end = nxt
        else:
            break

    return start, end, (end - start).days + 1


def check_max_absence_span(
    from_date: date,
    to_date: date,
    holidays: set[date],
    validation_rules: dict,
) -> str | None:
    max_span = validation_rules.get("max_absence_span")
    if max_span is None:
        return None
    _, _, span_days = expand_absence_span(from_date, to_date, holidays)
    if span_days > int(max_span):
        return (
            f"Total absence from duty (including attached weekends and holidays) "
            f"is {span_days} days; maximum allowed is {max_span} days at one time"
        )
    return None


def check_prefix_suffix(
    from_date: date,
    to_date: date,
    holidays: set[date],
    validation_rules: dict,
) -> str | None:
    """Block leave adjacent to holidays/weekends when configured (not used for CL under DoPT)."""
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
        if is_weekend(prev_day):
            return "Leave cannot be prefixed to a weekend"
        if is_weekend(next_day):
            return "Leave cannot be suffixed to a weekend"

    return None


def _gap_days_between(earlier_end: date, later_start: date) -> list[date]:
    if later_start <= earlier_end:
        return []
    gap: list[date] = []
    d = earlier_end + timedelta(days=1)
    while d < later_start:
        gap.append(d)
        d += timedelta(days=1)
    return gap


def _incompatible_types(validation_rules: dict, leave_type_code: str) -> frozenset[str]:
    configured = validation_rules.get("incompatible_types")
    if isinstance(configured, list) and configured:
        return frozenset(str(c).upper() for c in configured)
    if validation_rules.get("no_combination") or leave_type_code == CL_CODE:
        return DEFAULT_CL_INCOMPATIBLE
    return frozenset()


def _types_form_sandwich(
    code_a: str,
    code_b: str,
    incompatible: frozenset[str],
) -> bool:
    code_a = code_a.upper()
    code_b = code_b.upper()
    if code_a == CL_CODE and code_b in incompatible:
        return True
    if code_b == CL_CODE and code_a in incompatible:
        return True
    return False


async def load_holidays_in_range(
    db: AsyncSession, start: date, end: date
) -> set[date]:
    result = await db.execute(
        text("SELECT holiday_date FROM holiday_master WHERE holiday_date BETWEEN :f AND :t"),
        {"f": start, "t": end},
    )
    return {row[0] for row in result.fetchall()}


async def fetch_nearby_applications(
    db: AsyncSession,
    employee_id: str,
    from_date: date,
    to_date: date,
    *,
    exclude_application_ids: list[str] | None = None,
    window_days: int = 60,
) -> list[dict]:
    exclude_application_ids = exclude_application_ids or []
    lookback = from_date - timedelta(days=window_days)
    lookahead = to_date + timedelta(days=window_days)
    query = """
        SELECT a.id, a.from_date, a.to_date, a.is_half_day, a.half_day_session, lt.code AS leave_type_code
        FROM leave_applications a
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.employee_id = :eid
          AND a.status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')
          AND a.from_date <= :lookahead
          AND a.to_date >= :lookback
    """
    params: dict = {"eid": employee_id, "lookback": lookback, "lookahead": lookahead}
    if exclude_application_ids:
        query += " AND a.id != ALL(:exclude)"
        params["exclude"] = exclude_application_ids

    result = await db.execute(text(query), params)
    return [dict(row._mapping) for row in result.fetchall()]


async def _half_day_cl_on_date(
    db: AsyncSession,
    employee_id: str,
    on_date: date,
    *,
    exclude_application_ids: list[str] | None = None,
) -> bool:
    exclude_application_ids = exclude_application_ids or []
    query = """
        SELECT 1
        FROM leave_applications a
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.employee_id = :eid
          AND lt.code = :cl
          AND a.is_half_day = true
          AND a.from_date = :dt AND a.to_date = :dt
          AND a.status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')
    """
    params: dict = {"eid": employee_id, "cl": CL_CODE, "dt": on_date}
    if exclude_application_ids:
        query += " AND a.id != ALL(:exclude)"
        params["exclude"] = exclude_application_ids
    query += " LIMIT 1"
    result = await db.execute(text(query), params)
    return result.fetchone() is not None


def check_sandwich_with_existing(
    *,
    new_code: str,
    new_from: date,
    new_to: date,
    existing: dict,
    holidays: set[date],
    incompatible: frozenset[str],
    allow_emergency_continuation: bool,
) -> str | None:
    ex_code = str(existing["leave_type_code"]).upper()
    if not _types_form_sandwich(new_code, ex_code, incompatible):
        return None

    ex_from = existing["from_date"]
    ex_to = existing["to_date"]

    # Existing leave ends before new one starts.
    if ex_to < new_from:
        gap = _gap_days_between(ex_to, new_from)
        if gap and all(is_non_working_day(d, holidays) for d in gap):
            if allow_emergency_continuation and new_code != CL_CODE and ex_code == CL_CODE:
                return None
            return (
                f"Cannot combine {CL_CODE} with {ex_code} across weekends/holidays only "
                f"(sandwich rule). The only exception is half-day {CL_CODE} followed by "
                f"regular leave from the next calendar day (emergency/illness)."
            )

    # New leave ends before existing one starts.
    if new_to < ex_from:
        gap = _gap_days_between(new_to, ex_from)
        if gap and all(is_non_working_day(d, holidays) for d in gap):
            if allow_emergency_continuation and new_code == CL_CODE and ex_code != CL_CODE:
                return None
            return (
                f"Cannot combine {CL_CODE} with {ex_code} across weekends/holidays only "
                f"(sandwich rule)."
            )

    return None


async def check_leave_combination(
    db: AsyncSession,
    *,
    employee_id: str,
    leave_type_code: str,
    from_date: date,
    to_date: date,
    holidays: set[date],
    validation_rules: dict,
    emergency_regular_combo: bool = False,
    exclude_application_ids: list[str] | None = None,
) -> str | None:
    code = leave_type_code.upper()
    if code == CL_CODE:
        incompatible = _incompatible_types(validation_rules, CL_CODE)
    elif code in DEFAULT_CL_INCOMPATIBLE:
        incompatible = DEFAULT_CL_INCOMPATIBLE
    else:
        return None

    prior_half_day_cl = await _half_day_cl_on_date(
        db,
        employee_id,
        from_date - timedelta(days=1),
        exclude_application_ids=exclude_application_ids,
    )
    allow_emergency = prior_half_day_cl and code in DEFAULT_CL_INCOMPATIBLE

    nearby = await fetch_nearby_applications(
        db,
        employee_id,
        from_date,
        to_date,
        exclude_application_ids=exclude_application_ids,
    )
    for existing in nearby:
        err = check_sandwich_with_existing(
            new_code=code,
            new_from=from_date,
            new_to=to_date,
            existing=existing,
            holidays=holidays,
            incompatible=incompatible,
            allow_emergency_continuation=allow_emergency,
        )
        if err:
            return err
    return None


async def fetch_entitlement_for_type(
    db: AsyncSession, employee_id: str, leave_type_id: str
) -> dict | None:
    result = await db.execute(
        text("""
            SELECT ler.max_at_a_stretch, ler.max_in_tenure, ler.special_rules, ler.year_ref
            FROM leave_entitlement_rules ler
            JOIN employees e ON e.category_id = ler.category_id
            WHERE e.id = :eid AND ler.leave_type_id = :lid
            LIMIT 1
        """),
        {"eid": employee_id, "lid": leave_type_id},
    )
    row = result.fetchone()
    return dict(row._mapping) if row else None


async def count_approved_leave_occurrences(
    db: AsyncSession,
    employee_id: str,
    leave_type_code: str,
    *,
    exclude_application_ids: list[str] | None = None,
) -> int:
    """Count approved NEW applications — for max_times_in_service (ML, PL, etc.)."""
    exclude_application_ids = exclude_application_ids or []
    query = """
        SELECT COUNT(*)::int
        FROM leave_applications a
        JOIN leave_types lt ON a.leave_type_id = lt.id
        WHERE a.employee_id = :eid
          AND lt.code = :code
          AND a.status = 'APPROVED'
          AND a.application_kind = 'NEW'
    """
    params: dict = {"eid": employee_id, "code": leave_type_code.upper()}
    if exclude_application_ids:
        query += " AND a.id != ALL(:exclude)"
        params["exclude"] = exclude_application_ids
    result = await db.execute(text(query), params)
    row = result.fetchone()
    return int(row[0] or 0) if row else 0


async def check_times_in_service(
    db: AsyncSession,
    employee_id: str,
    leave_type_code: str,
    special_rules: dict,
    *,
    exclude_application_ids: list[str] | None = None,
) -> str | None:
    max_times = special_rules.get("max_times_in_service")
    if max_times is None:
        return None
    used = await count_approved_leave_occurrences(
        db,
        employee_id,
        leave_type_code,
        exclude_application_ids=exclude_application_ids,
    )
    if used >= int(max_times):
        return (
            f"Maximum {max_times} occasion(s) of {leave_type_code} allowed in entire service; "
            f"{used} already availed"
        )
    return None


def build_cl_projection_extras(
    from_date: date,
    to_date: date,
    holidays: set[date],
    applied_days: float,
    validation_rules: dict,
) -> dict:
    span_start, span_end, span_days = expand_absence_span(from_date, to_date, holidays)
    max_span = validation_rules.get("max_absence_span", DEFAULT_MAX_ABSENCE_SPAN)
    warnings: list[str] = []
    if span_days > int(max_span):
        warnings.append(
            f"Total absence span is {span_days} days (max {max_span} including weekends/holidays)."
        )
    return {
        "cl_debited_days": applied_days,
        "absence_span_start": span_start.isoformat(),
        "absence_span_end": span_end.isoformat(),
        "absence_span_days": span_days,
        "max_absence_span": int(max_span),
        "warnings": warnings,
        "cl_rules_hint": (
            "Weekends and holidays attached to CL are not debited from your balance. "
            "CL cannot be sandwiched with EL/HPL across holidays or weekends only."
        ),
    }


def validate_retrospective_dates(
    from_date: date,
    to_date: date,
    validation_rules: dict,
    *,
    mc_attached: bool,
) -> None:
    """Past-dated leave — allowed by default; only guard obviously invalid ranges."""
    today = date.today()
    if from_date >= today:
        raise HTTPException(
            status_code=400,
            detail="Retrospective leave must start before today",
        )
    if to_date > today:
        raise HTTPException(
            status_code=400,
            detail="Retrospective leave cannot extend into the future",
        )


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
    emergency_regular_combo: bool = False,
    retrospective: bool = False,
    is_commuted: bool = False,
    exclude_application_ids: list[str] | None = None,
) -> float:
    """Run institutional validation rules. Returns computed applied_days."""
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="from_date must be <= to_date")

    leave_type_code = str(leave_type.get("code", "")).upper()
    validation_rules = _parse_rules(leave_type.get("validation_rules"))
    count_holidays = bool(leave_type.get("count_holidays"))

    pad_start = from_date - timedelta(days=14)
    pad_end = to_date + timedelta(days=14)
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

    if retrospective and application_kind == "NEW":
        validate_retrospective_dates(
            from_date, to_date, validation_rules, mc_attached=mc_attached
        )

    prefix_suffix_error = check_prefix_suffix(from_date, to_date, holidays, validation_rules)
    if prefix_suffix_error:
        raise HTTPException(status_code=400, detail=prefix_suffix_error)

    if leave_type_code == CL_CODE or validation_rules.get("max_absence_span"):
        span_error = check_max_absence_span(from_date, to_date, holidays, validation_rules)
        if span_error:
            raise HTTPException(status_code=400, detail=span_error)

    combo_error = await check_leave_combination(
        db,
        employee_id=employee_id,
        leave_type_code=leave_type_code,
        from_date=from_date,
        to_date=to_date,
        holidays=holidays,
        validation_rules=validation_rules,
        emergency_regular_combo=emergency_regular_combo,
        exclude_application_ids=exclude_application_ids,
    )
    if combo_error:
        raise HTTPException(status_code=400, detail=combo_error)

    max_stretch = validation_rules.get("max_per_stretch")
    entitlement = await fetch_entitlement_for_type(db, employee_id, str(leave_type["id"]))
    entitlement_rules = _parse_rules(entitlement.get("special_rules")) if entitlement else {}
    if entitlement and entitlement.get("max_at_a_stretch"):
        max_stretch = max_stretch or float(entitlement["max_at_a_stretch"])
    if max_stretch and not is_half_day and applied_days > float(max_stretch):
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {max_stretch} days at a stretch for this leave type",
        )

    if application_kind == "NEW":
        times_err = await check_times_in_service(
            db,
            employee_id,
            leave_type_code,
            entitlement_rules,
            exclude_application_ids=exclude_application_ids,
        )
        if times_err:
            raise HTTPException(status_code=400, detail=times_err)

    # Advance notice applies to new applications only — not changes to approved leave.
    skip_min_notice = application_kind == "MODIFICATION" or retrospective
    min_notice = validation_rules.get("min_notice_days")
    if min_notice is not None and not skip_min_notice:
        notice_days = (from_date - date.today()).days
        if notice_days < int(min_notice):
            raise HTTPException(
                status_code=400,
                detail=f"Minimum {min_notice} days advance notice required",
            )

    if is_commuted and leave_type_code != "HPL":
        raise HTTPException(status_code=400, detail="Commutation is only available for Half Pay Leave (HPL)")

    if leave_type_code == "HPL" and is_commuted and application_kind != "CANCELLATION":
        from app.services.leave_hpl import validate_hpl_commutation

        await validate_hpl_commutation(
            db,
            employee_id=employee_id,
            leave_type_id=str(leave_type["id"]),
            from_date=from_date,
            applied_days=applied_days,
            is_commuted=True,
            is_half_day=is_half_day,
            mc_attached=mc_attached,
            exclude_application_ids=exclude_application_ids,
        )

    return applied_days


async def validate_workflow_day_limits(
    db: AsyncSession,
    config_id: str,
    applied_days: float,
    *,
    is_half_day: bool = False,
) -> None:
    result = await db.execute(
        text("SELECT min_days, max_days FROM workflow_configs WHERE id = :cid"),
        {"cid": config_id},
    )
    row = result.fetchone()
    if not row:
        return
    min_days, max_days = row[0], row[1]
    effective_min = float(min_days) if min_days is not None else 0.0
    if is_half_day:
        effective_min = min(effective_min, 0.5)
    if applied_days < effective_min:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum {effective_min:g} days required for this workflow",
        )
    if max_days is not None and applied_days > float(max_days):
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {max_days} days allowed for this workflow",
        )
