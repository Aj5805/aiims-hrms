"""Create leave balance rows when an employee is onboarded or rejoins."""

import uuid
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.leave_ledger import record_leave_ledger
from app.services.leave_rules import annual_calendar_credit, fetch_eligible_leave_types


def onboarding_credited_amount(rule: dict, doj: date, as_of: date | None = None) -> float:
    """Initial credited balance for the current calendar year at onboarding."""
    as_of = as_of or date.today()
    leave_year = as_of.year
    year_ref = rule.get("year_ref")

    if year_ref == "TENURE":
        max_tenure = rule.get("max_in_tenure")
        return float(max_tenure) if max_tenure is not None else 0.0

    if year_ref != "CALENDAR":
        return 0.0

    if doj.year > leave_year:
        return 0.0
    return annual_calendar_credit(
        rule.get("days_per_year"),
        rule.get("prorata_rate"),
        doj,
        leave_year,
    )


async def bootstrap_leave_balances(
    db: AsyncSession,
    employee_id: str,
    doj: date,
    *,
    as_of: date | None = None,
    actor_id: str | None = None,
    impersonated_by: str | None = None,
) -> dict:
    """Idempotent: create balance rows for all entitled leave types in the current calendar year."""
    as_of = as_of or date.today()
    leave_year = as_of.year
    year_start = date(leave_year, 1, 1)
    eligible = await fetch_eligible_leave_types(db, employee_id)
    rows_created = 0

    for rule in eligible:
        lt_id = str(rule["id"])
        existing = await db.execute(
            text("""
                SELECT id FROM leave_balances
                WHERE employee_id = :eid AND leave_type_id = :lid AND leave_year = :ly
            """),
            {"eid": employee_id, "lid": lt_id, "ly": leave_year},
        )
        if existing.fetchone():
            continue

        credited = onboarding_credited_amount(rule, doj, as_of)
        balance_id = str(uuid.uuid4())
        await db.execute(
            text("""
                INSERT INTO leave_balances
                    (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
                VALUES (:id, :eid, :lid, :ly, :ys, 0, :credited)
            """),
            {
                "id": balance_id,
                "eid": employee_id,
                "lid": lt_id,
                "ly": leave_year,
                "ys": year_start,
                "credited": credited,
            },
        )

        if credited > 0:
            await record_leave_ledger(
                db,
                balance_id=balance_id,
                employee_id=employee_id,
                leave_type_id=lt_id,
                leave_year=leave_year,
                txn_type="ONBOARDING_CREDIT",
                amount=credited,
                field_affected="credited",
                reference_type="onboarding",
                reference_id=employee_id,
                reason="Initial leave credit on registration",
                actor_id=actor_id,
                impersonated_by=impersonated_by,
            )

        rows_created += 1

    return {"rows_created": rows_created, "leave_year": leave_year, "leave_types": len(eligible)}
