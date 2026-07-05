"""Attendance pipeline: leave-derived rows now; biometric review and finalization later."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.leave_validation import load_holidays_in_range


async def _fetch_holidays(db: AsyncSession, start: date, end: date) -> set[date]:
    return await load_holidays_in_range(db, start, end)


async def _approved_leave_on_date(
    db: AsyncSession,
    employee_id: str,
    on_date: date,
) -> dict | None:
    result = await db.execute(
        text("""
            SELECT a.id, a.from_date, a.to_date, a.is_half_day, a.is_commuted, lt.code AS leave_type_code
            FROM leave_applications a
            JOIN leave_types lt ON a.leave_type_id = lt.id
            WHERE a.employee_id = :eid
              AND a.status = 'APPROVED'
              AND a.application_kind != 'CANCELLATION'
              AND a.from_date <= :d AND a.to_date >= :d
            ORDER BY a.from_date
            LIMIT 1
        """),
        {"eid": employee_id, "d": on_date},
    )
    row = result.fetchone()
    return dict(row._mapping) if row else None


def _default_final_status(on_date: date, holidays: set[date], on_leave: bool) -> str:
    if on_leave:
        return "ON_LEAVE"
    if on_date in holidays:
        return "HOLIDAY"
    if on_date.weekday() >= 5:
        return "WEEKEND"
    return "ON_DUTY"


async def sync_attendance_from_leave(
    db: AsyncSession,
    *,
    from_date: date,
    to_date: date,
    employee_ids: list[str] | None = None,
) -> dict:
    """Build or refresh leave-derived attendance rows for a date range."""
    if from_date > to_date:
        raise ValueError("from_date must be <= to_date")

    holidays = await _fetch_holidays(db, from_date, to_date)

    emp_query = "SELECT id FROM employees WHERE is_active = true"
    params: dict = {}
    if employee_ids:
        emp_query += " AND id = ANY(CAST(:eids AS uuid[]))"
        params["eids"] = employee_ids

    emp_result = await db.execute(text(emp_query), params)
    employees = [str(r[0]) for r in emp_result.fetchall()]

    rows_upserted = 0
    current = from_date
    while current <= to_date:
        for emp_id in employees:
            leave_row = await _approved_leave_on_date(db, emp_id, current)
            on_leave = leave_row is not None
            leave_derived = "ON_LEAVE" if on_leave else "ON_DUTY"
            final_status = _default_final_status(current, holidays, on_leave)

            existing = await db.execute(
                text("""
                    SELECT id, review_status, finalized_at
                    FROM attendance_daily
                    WHERE employee_id = :eid AND attendance_date = :d
                """),
                {"eid": emp_id, "d": current},
            )
            ex = existing.fetchone()

            if ex and ex.finalized_at is not None:
                continue

            row_id = str(ex.id) if ex else str(uuid.uuid4())
            await db.execute(
                text("""
                    INSERT INTO attendance_daily
                        (id, employee_id, attendance_date, leave_derived_status,
                         leave_type_code, leave_application_id, is_commuted,
                         review_status, final_status, updated_at)
                    VALUES
                        (:id, :eid, :d, :lds, :ltc, :laid, :ic,
                         'PENDING', :fs, now())
                    ON CONFLICT (employee_id, attendance_date) DO UPDATE SET
                        leave_derived_status = EXCLUDED.leave_derived_status,
                        leave_type_code = EXCLUDED.leave_type_code,
                        leave_application_id = EXCLUDED.leave_application_id,
                        is_commuted = EXCLUDED.is_commuted,
                        final_status = EXCLUDED.final_status,
                        updated_at = now()
                """),
                {
                    "id": row_id,
                    "eid": emp_id,
                    "d": current,
                    "lds": leave_derived,
                    "ltc": leave_row["leave_type_code"] if leave_row else None,
                    "laid": str(leave_row["id"]) if leave_row else None,
                    "ic": bool(leave_row["is_commuted"]) if leave_row else False,
                    "fs": final_status,
                },
            )
            rows_upserted += 1
        current += timedelta(days=1)

    return {
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "employees_processed": len(employees),
        "rows_upserted": rows_upserted,
        "pipeline_note": "Stage 1 (leave) complete. Biometric import and review are future stages.",
    }


async def fetch_attendance_report(
    db: AsyncSession,
    *,
    from_date: date,
    to_date: date,
    employee_ids: list[str] | None = None,
    department_id: str | None = None,
) -> list[dict]:
    query = """
        SELECT
            ad.attendance_date,
            e.id AS employee_id,
            e.emp_code,
            e.name AS employee_name,
            d.name AS department_name,
            ad.leave_derived_status,
            ad.leave_type_code,
            ad.is_commuted,
            ad.biometric_status,
            ad.review_status,
            ad.final_status,
            ad.finalized_at,
            ad.notes
        FROM attendance_daily ad
        JOIN employees e ON ad.employee_id = e.id
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE ad.attendance_date >= :fd AND ad.attendance_date <= :td
    """
    params: dict = {"fd": from_date, "td": to_date}
    if employee_ids:
        query += " AND e.id = ANY(CAST(:eids AS uuid[]))"
        params["eids"] = employee_ids
    if department_id:
        query += " AND e.department_id = CAST(:dept AS uuid)"
        params["dept"] = department_id
    query += " ORDER BY ad.attendance_date, e.emp_code"
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]
