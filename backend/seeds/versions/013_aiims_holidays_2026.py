"""Seed 013 — AIIMS Bibinagar gazetted and restricted holidays for 2026."""

import uuid

from sqlalchemy import text

from seeds.data.aiims_holidays_2026 import AIIMS_HOLIDAYS_2026, HOLIDAY_YEAR


def run(session):
    inserted = 0
    skipped = 0
    updated = 0

    # Bakrid was rescheduled in OO/867; remove stale annexure date if present.
    stale = session.execute(
        text("""
            SELECT id FROM holiday_master
            WHERE year = :year AND holiday_date = '2026-05-27'
              AND holiday_type = 'GAZETTED'
              AND holiday_name ILIKE '%zuha%'
        """),
        {"year": HOLIDAY_YEAR},
    ).fetchone()
    if stale:
        session.execute(
            text("DELETE FROM holiday_master WHERE id = :id"),
            {"id": str(stale[0])},
        )
        updated += 1

    for holiday_date, name, holiday_type in AIIMS_HOLIDAYS_2026:
        existing = session.execute(
            text("""
                SELECT id, holiday_name FROM holiday_master
                WHERE holiday_date = :dt AND holiday_type = :type
            """),
            {"dt": holiday_date, "type": holiday_type},
        ).fetchone()
        if existing:
            if existing[1] != name:
                session.execute(
                    text("""
                        UPDATE holiday_master
                        SET holiday_name = :name, year = :year
                        WHERE id = :id
                    """),
                    {"id": str(existing[0]), "name": name, "year": HOLIDAY_YEAR},
                )
                updated += 1
            else:
                skipped += 1
            continue

        session.execute(
            text("""
                INSERT INTO holiday_master
                    (id, year, holiday_date, holiday_name, holiday_type, applicable_to)
                VALUES (:id, :year, :dt, :name, :type, 'ALL')
            """),
            {
                "id": str(uuid.uuid4()),
                "year": HOLIDAY_YEAR,
                "dt": holiday_date,
                "name": name,
                "type": holiday_type,
            },
        )
        inserted += 1

    print(
        f"AIIMS holidays {HOLIDAY_YEAR}: {inserted} added, {updated} updated, "
        f"{skipped} unchanged ({len(AIIMS_HOLIDAYS_2026)} in master list)."
    )
