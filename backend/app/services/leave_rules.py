"""Leave entitlement and credit calculation helpers."""

from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_ELIGIBLE_LEAVE_TYPES_SQL = """
    SELECT lt.id, lt.code, lt.name, lt.scheme, lt.is_half_day_allowed, lt.requires_mc,
           lt.min_days_for_mc, lt.count_holidays, lt.is_accumulating, lt.max_accumulation,
           lt.validation_rules,
           ler.year_ref, ler.days_per_year, ler.prorata_rate,
           ler.max_at_a_stretch, ler.max_in_tenure, ler.special_rules,
           c.code AS category_code, c.leave_scheme
    FROM employees e
    JOIN employee_categories c ON e.category_id = c.id
    JOIN leave_entitlement_rules ler ON ler.category_id = c.id
    JOIN leave_types lt ON lt.id = ler.leave_type_id
    WHERE e.id = :eid
      AND COALESCE(lt.is_active, true) = true
      AND (lt.scheme = 'BOTH' OR lt.scheme = c.leave_scheme)
    ORDER BY lt.code
"""


async def fetch_eligible_leave_types(db: AsyncSession, employee_id: str) -> list[dict]:
    result = await db.execute(text(_ELIGIBLE_LEAVE_TYPES_SQL), {"eid": employee_id})
    return [dict(row._mapping) for row in result.fetchall()]


async def is_leave_type_eligible(
    db: AsyncSession, employee_id: str, leave_type_code: str
) -> bool:
    eligible = await fetch_eligible_leave_types(db, employee_id)
    return any(row["code"] == leave_type_code for row in eligible)


def months_employed_in_calendar_year(doj: date, leave_year: int) -> int:
    """Whole calendar months from join month through December (inclusive) in leave_year."""
    if doj.year > leave_year:
        return 0
    if doj.year < leave_year:
        return 12
    return 13 - doj.month


def join_year_prorata_credit(
    days_per_year: float | Decimal | None,
    prorata_rate: float | Decimal | None,
    doj: date,
    leave_year: int,
) -> float:
    """Credit for an employee's first calendar year (partial months from DOJ)."""
    months = months_employed_in_calendar_year(doj, leave_year)
    if months <= 0:
        return 0.0
    if prorata_rate is not None and float(prorata_rate) > 0:
        return round(float(prorata_rate) * months, 2)
    if days_per_year is not None and float(days_per_year) > 0:
        return round(float(days_per_year) * months / 12, 2)
    return 0.0


def annual_calendar_credit(
    days_per_year: float | Decimal | None,
    prorata_rate: float | Decimal | None,
    doj: date,
    leave_year: int,
) -> float:
    """Full-year calendar credit on 1 Jan; join-year staff get month-proportional credit."""
    if doj.year == leave_year:
        return join_year_prorata_credit(days_per_year, prorata_rate, doj, leave_year)
    if days_per_year is not None and float(days_per_year) > 0:
        return float(days_per_year)
    if prorata_rate is not None and float(prorata_rate) > 0:
        return round(float(prorata_rate) * 12, 2)
    return 0.0


def monthly_prorata_credit(prorata_rate: float | Decimal | None) -> float:
    """One month's credit for resident-style monthly accrual."""
    if prorata_rate is None or float(prorata_rate) <= 0:
        return 0.0
    return float(prorata_rate)
