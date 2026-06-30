"""Shared leave credit logic (manual API + scheduled job).

Credit frequency (leave_entitlement_rules.credit_frequency):
  ANNUAL       — full days_per_year once per calendar year (H1 run)
  HALF_YEARLY  — half of days_per_year at start of each calendar half (Jan 1 + Jul 1)
  MONTHLY      — prorata_rate each month (handled via prorata_rate; annual job skips)
"""

from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_clear

# credit_period: 1 = Jan/Jan–Jun half, 2 = Jul/second half
_CREDIT_AMOUNT_EXPR = """
    CASE
        WHEN COALESCE(ler.credit_frequency, 'ANNUAL') = 'HALF_YEARLY' THEN
            ROUND(COALESCE(ler.days_per_year, 0) / 2.0, 2)
        WHEN EXTRACT(YEAR FROM e.doj)::int = :ly THEN
            ROUND(COALESCE(
                ler.prorata_rate * (13 - EXTRACT(MONTH FROM e.doj)::int),
                ler.days_per_year * (13 - EXTRACT(MONTH FROM e.doj)::int) / 12.0,
                0
            )::numeric, 2)
        ELSE COALESCE(ler.days_per_year, 0)
    END
"""

_CALENDAR_CREDIT_FILTER = """
    ler.year_ref = 'CALENDAR'
    AND (
        COALESCE(ler.days_per_year, 0) > 0
        OR COALESCE(ler.prorata_rate, 0) > 0
    )
    AND COALESCE(ler.credit_frequency, 'ANNUAL') != 'MONTHLY'
"""

_FREQUENCY_FOR_PERIOD = """
    (
        (:period = 1 AND COALESCE(ler.credit_frequency, 'ANNUAL') IN ('ANNUAL', 'HALF_YEARLY'))
        OR (:period = 2 AND COALESCE(ler.credit_frequency, 'ANNUAL') = 'HALF_YEARLY')
    )
"""

# H1: new row or zero credit. H2: half-yearly with first half already credited.
_ELIGIBLE_FOR_CREDIT = """
    (
        (:period = 1 AND COALESCE(lb.credited, 0) = 0)
        OR (
            :period = 2
            AND COALESCE(ler.credit_frequency, 'ANNUAL') = 'HALF_YEARLY'
            AND COALESCE(lb.credited, 0) > 0
            AND COALESCE(lb.credited, 0) < COALESCE(ler.days_per_year, 0)
        )
    )
"""


async def run_annual_credit(
    db: AsyncSession,
    *,
    leave_year: int,
    year_start: date | None = None,
    credit_period: int = 1,
) -> int:
    """Credit calendar-year entitlements for one half (1=Jan, 2=Jul).

    Idempotent per period: H1 skips rows already credited; H2 only tops up half-yearly rows.
    """
    if credit_period not in (1, 2):
        raise ValueError("credit_period must be 1 (Jan) or 2 (Jul)")
    if year_start is None:
        year_start = date(leave_year, 1 if credit_period == 1 else 7, 1)

    updated = await db.execute(
        text(f"""
            UPDATE leave_balances lb
            SET credited = CASE
                    WHEN :period = 2 THEN COALESCE(lb.credited, 0) + ({_CREDIT_AMOUNT_EXPR})
                    ELSE ({_CREDIT_AMOUNT_EXPR})
                END,
                last_updated = now()
            FROM employees e
            JOIN employee_categories c ON e.category_id = c.id
            JOIN leave_entitlement_rules ler ON ler.category_id = c.id
            JOIN leave_types lt ON ler.leave_type_id = lt.id
            WHERE lb.employee_id = e.id
              AND lb.leave_type_id = lt.id
              AND lb.leave_year = :ly
              AND {_CALENDAR_CREDIT_FILTER}
              AND {_FREQUENCY_FOR_PERIOD}
              AND {_ELIGIBLE_FOR_CREDIT}
        """),
        {"ly": leave_year, "period": credit_period},
    )
    inserted = await db.execute(
        text(f"""
            INSERT INTO leave_balances (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
            SELECT uuid_generate_v4(), e.id, lt.id, :ly, CAST(:ys AS date),
                   COALESCE((
                       SELECT closing_balance
                       FROM leave_balances
                       WHERE employee_id = e.id AND leave_type_id = lt.id AND leave_year = :ly - 1
                   ), 0),
                   ({_CREDIT_AMOUNT_EXPR})
            FROM employees e
            JOIN employee_categories c ON e.category_id = c.id
            JOIN leave_entitlement_rules ler ON ler.category_id = c.id
            JOIN leave_types lt ON ler.leave_type_id = lt.id
            WHERE {_CALENDAR_CREDIT_FILTER}
              AND {_FREQUENCY_FOR_PERIOD}
              AND :period = 1
              AND NOT EXISTS (
                  SELECT 1
                  FROM leave_balances lb2
                  WHERE lb2.employee_id = e.id AND lb2.leave_type_id = lt.id AND lb2.leave_year = :ly
              )
        """),
        {"ly": leave_year, "ys": year_start, "period": credit_period},
    )
    await db.commit()
    cache_clear()
    return (updated.rowcount or 0) + (inserted.rowcount or 0)
