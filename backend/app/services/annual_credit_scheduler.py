"""Scheduled calendar leave credits — Jan 1 (H1) and Jul 1 (H2)."""

import logging
from datetime import date

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_session_factory
from app.services.leave_annual_credit import run_annual_credit

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()
_ANNUAL_CREDIT_LOCK = 987654321


async def _credit_already_ran(db, leave_year: int, credit_period: int) -> bool:
    key = f"leave_credit_last_{leave_year}_H{credit_period}"
    result = await db.execute(
        text("SELECT value FROM system_settings WHERE key = :key"),
        {"key": key},
    )
    row = result.fetchone()
    return bool(row)


async def _mark_credit_ran(db, leave_year: int, credit_period: int) -> None:
    key = f"leave_credit_last_{leave_year}_H{credit_period}"
    await db.execute(
        text("""
            INSERT INTO system_settings (key, value, updated_at)
            VALUES (:key, CAST(:val AS jsonb), now())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        """),
        {"key": key, "val": f'{{"year": {leave_year}, "period": {credit_period}}}'},
    )


async def run_scheduled_leave_credit():
    if not settings.ANNUAL_CREDIT_SCHEDULER_ENABLED:
        return

    today = date.today()
    if today.month == 1 and today.day == 1:
        credit_period = 1
    elif today.month == 7 and today.day == 1:
        credit_period = 2
    else:
        return

    leave_year = today.year
    async with async_session_factory() as db:
        lock_result = await db.execute(text(f"SELECT pg_try_advisory_lock({_ANNUAL_CREDIT_LOCK})"))
        if not lock_result.scalar_one():
            return
        try:
            if await _credit_already_ran(db, leave_year, credit_period):
                logger.info("Leave credit H%s already ran for %s", credit_period, leave_year)
                return
            rows = await run_annual_credit(
                db,
                leave_year=leave_year,
                year_start=date(leave_year, 1 if credit_period == 1 else 7, 1),
                credit_period=credit_period,
            )
            await _mark_credit_ran(db, leave_year, credit_period)
            await db.commit()
            logger.info(
                "Scheduled leave credit H%s completed for %s (%s rows)",
                credit_period,
                leave_year,
                rows,
            )
        except Exception:
            await db.rollback()
            logger.exception("Scheduled leave credit H%s failed for %s", credit_period, leave_year)
        finally:
            await db.execute(text(f"SELECT pg_advisory_unlock({_ANNUAL_CREDIT_LOCK})"))
            await db.commit()


def start_annual_credit_scheduler():
    if not settings.ANNUAL_CREDIT_SCHEDULER_ENABLED:
        return
    if scheduler.running:
        return
    scheduler.add_job(
        run_scheduled_leave_credit,
        "cron",
        hour=0,
        minute=5,
        id="scheduled_leave_credit",
    )
    scheduler.start()
