"""Create realistic six-month demo activity for visual testing.

This script is intentionally focused on a rich UI/demo experience:
- Creates role users for approvals (HOD, NODAL_OFFICER, office chain)
- Seeds staff across multiple departments/categories
- Generates leave applications over the past six months in mixed states
- Updates balances so reports and dashboards look populated

Safe-guarded: refuses to run when APP_ENV=production.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.auth.jwt import hash_password
from app.core.config import settings


@dataclass
class SeedStats:
    staff_created: int = 0
    apps_created: int = 0
    approved: int = 0
    rejected: int = 0
    withdrawn: int = 0
    submitted: int = 0
    under_review: int = 0


def _guard() -> None:
    if settings.APP_ENV == "production" or os.environ.get("APP_ENV") == "production":
        raise SystemExit("Refusing to seed demo data in production.")


def _ensure_user(
    session: Session,
    *,
    username: str,
    role: str,
    employee_id: str | None,
    password: str = "password",
) -> str:
    row = session.execute(
        text("SELECT id FROM users WHERE username = :u"),
        {"u": username},
    ).fetchone()
    if row:
        uid = str(row[0])
        session.execute(
            text(
                """
                UPDATE users
                SET role = :role,
                    employee_id = :eid,
                    is_active = true,
                    password_hash = :ph,
                    must_change_password = false,
                    failed_login_attempts = 0,
                    locked_until = NULL,
                    tokens_valid_from = now()
                WHERE id = :id
                """
            ),
            {"id": uid, "role": role, "eid": employee_id, "ph": hash_password(password)},
        )
        return uid

    uid = str(uuid.uuid4())
    session.execute(
        text(
            """
            INSERT INTO users
                (id, username, password_hash, role, employee_id, is_active, must_change_password,
                 failed_login_attempts, locked_until, tokens_valid_from)
            VALUES
                (:id, :u, :ph, :role, :eid, true, false, 0, NULL, now())
            """
        ),
        {"id": uid, "u": username, "ph": hash_password(password), "role": role, "eid": employee_id},
    )
    return uid


def _pick_designation_for_category(session: Session, category_code: str) -> tuple[str, str]:
    row = session.execute(
        text(
            """
            SELECT d.id, d.name
            FROM designations d
            JOIN employee_categories c ON c.id = d.category_id
            WHERE c.code = :cc
            ORDER BY d.name
            LIMIT 1
            """
        ),
        {"cc": category_code},
    ).fetchone()
    if not row:
        raise RuntimeError(f"No designation found for category {category_code}")
    return str(row[0]), str(row[1])


def _pick_departments(session: Session, limit: int = 12) -> list[dict[str, str]]:
    rows = session.execute(
        text(
            """
            SELECT id, code, name
            FROM departments
            ORDER BY name
            LIMIT :lim
            """
        ),
        {"lim": limit},
    ).fetchall()
    if not rows:
        raise RuntimeError("No departments found. Run core seeds first.")
    return [{"id": str(r[0]), "code": str(r[1]), "name": str(r[2])} for r in rows]


def _ensure_hod_assignment(session: Session, *, department_id: str, hod_user_id: str) -> None:
    session.execute(
        text("UPDATE dept_hod_assignments SET is_active = false WHERE department_id = :did AND is_active = true"),
        {"did": department_id},
    )
    exists = session.execute(
        text(
            """
            SELECT id FROM dept_hod_assignments
            WHERE department_id = :did AND hod_user_id = :uid
            """
        ),
        {"did": department_id, "uid": hod_user_id},
    ).fetchone()
    if exists:
        session.execute(
            text("UPDATE dept_hod_assignments SET is_active = true WHERE id = :id"),
            {"id": str(exists[0])},
        )
        return
    session.execute(
        text(
            """
            INSERT INTO dept_hod_assignments (id, department_id, hod_user_id, is_active)
            VALUES (:id, :did, :uid, true)
            """
        ),
        {"id": str(uuid.uuid4()), "did": department_id, "uid": hod_user_id},
    )


def _ensure_nodal_office_officer(session: Session, *, office_code: str, nodal_user_id: str) -> None:
    session.execute(
        text(
            """
            UPDATE nodal_offices
            SET officer_user_id = :uid
            WHERE code = :code AND is_active = true
            """
        ),
        {"uid": nodal_user_id, "code": office_code},
    )
    session.execute(
        text("UPDATE users SET nodal_office_id = (SELECT id FROM nodal_offices WHERE code = :code) WHERE id = :uid"),
        {"code": office_code, "uid": nodal_user_id},
    )


def _ensure_employee(
    session: Session,
    *,
    emp_code: str,
    name: str,
    gender: str,
    doj: date,
    category_id: str,
    department_id: str,
    designation_id: str,
    email: str,
) -> str:
    row = session.execute(
        text("SELECT id FROM employees WHERE emp_code = :ec"),
        {"ec": emp_code},
    ).fetchone()
    if row:
        return str(row[0])

    eid = str(uuid.uuid4())
    session.execute(
        text(
            """
            INSERT INTO employees
                (id, emp_code, name, gender, doj, category_id, department_id, designation_id,
                 email, has_institutional_email, personal_email, is_active, address, permanent_address)
            VALUES
                (:id, :ec, :nm, :g, :doj, :cat, :dept, :des,
                 :em, true, :pem, true, :addr, :addr)
            """
        ),
        {
            "id": eid,
            "ec": emp_code,
            "nm": name,
            "g": gender,
            "doj": doj,
            "cat": category_id,
            "dept": department_id,
            "des": designation_id,
            "em": email,
            "pem": email.replace("@aiims-demo.local", "@example.com"),
            "addr": "AIIMS Demo Campus",
        },
    )
    return eid


def _ensure_opening_balances(session: Session, employee_ids: list[str], leave_year: int) -> None:
    for eid in employee_ids:
        cat = session.execute(
            text(
                """
                SELECT c.code
                FROM employees e
                JOIN employee_categories c ON c.id = e.category_id
                WHERE e.id = :eid
                """
            ),
            {"eid": eid},
        ).scalar()
        lt_code = "ANNUAL_RES" if cat in ("JR_ACAD", "SR_ACAD") else "EL"
        opening = 30 if lt_code == "ANNUAL_RES" else 24
        session.execute(
            text(
                """
                INSERT INTO leave_balances
                    (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited, availed, lop_days)
                SELECT gen_random_uuid(), :eid, lt.id, :yr, :ys, :ob, 0, 0, 0
                FROM leave_types lt
                WHERE lt.code = :ltc
                AND NOT EXISTS (
                    SELECT 1
                    FROM leave_balances lb
                    WHERE lb.employee_id = :eid
                      AND lb.leave_type_id = lt.id
                      AND lb.leave_year = :yr
                )
                """
            ),
            {"eid": eid, "yr": leave_year, "ys": date(leave_year, 1, 1), "ob": opening, "ltc": lt_code},
        )


def _build_leave_events(staff_ids: list[str], months_back: int, apps_per_staff: int, seed: int) -> list[dict[str, Any]]:
    random.seed(seed)
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=30 * months_back)
    statuses = (
        ["APPROVED"] * 60
        + ["REJECTED"] * 12
        + ["WITHDRAWN"] * 8
        + ["UNDER_REVIEW"] * 10
        + ["SUBMITTED"] * 10
    )
    events: list[dict[str, Any]] = []
    active_states = {"APPROVED", "SUBMITTED", "UNDER_REVIEW"}
    for eid in staff_ids:
        active_ranges: list[tuple[date, date]] = []
        for _ in range(apps_per_staff):
            status = random.choice(statuses)
            found_slot = False
            for _attempt in range(20):
                from_date = start + timedelta(days=random.randint(0, max((end - start).days, 1)))
                span = random.choice([1, 1, 2, 2, 3, 4])
                to_date = from_date + timedelta(days=span - 1)
                if to_date > end:
                    to_date = end
                if status in active_states:
                    overlaps = any(not (to_date < rs or from_date > re) for rs, re in active_ranges)
                    if overlaps:
                        continue
                found_slot = True
                break
            if not found_slot:
                continue
            days = float((to_date - from_date).days + 1)
            events.append(
                {
                    "employee_id": eid,
                    "from_date": from_date,
                    "to_date": to_date,
                    "days": days,
                    "status": status,
                }
            )
            if status in active_states:
                active_ranges.append((from_date, to_date))
    return events


def _seed_history(session: Session, events: list[dict[str, Any]], *, keep_existing: bool, stats: SeedStats) -> None:
    admin_id = session.execute(text("SELECT id FROM users WHERE username = 'admin'")).scalar()
    if not admin_id:
        raise RuntimeError("admin user not found. Run seed 007 first.")

    wf = session.execute(
        text(
            """
            SELECT id
            FROM workflow_configs
            WHERE is_active = true
            ORDER BY created_at
            LIMIT 1
            """
        )
    ).fetchone()
    if not wf:
        raise RuntimeError("No active workflow config found. Run seed 006 first.")
    config_id = str(wf[0])

    steps = session.execute(
        text(
            """
            SELECT id, step_order, is_final_authority
            FROM workflow_steps
            WHERE config_id = :cid
            ORDER BY step_order
            """
        ),
        {"cid": config_id},
    ).fetchall()
    if not steps:
        raise RuntimeError("Workflow has no steps.")

    first_step_id = str(steps[0][0])
    first_order = int(steps[0][1])
    final_step = next((s for s in steps if s[2]), steps[-1])
    final_step_id = str(final_step[0])
    final_order = int(final_step[1])

    if not keep_existing:
        session.execute(
            text(
                """
                DELETE FROM leave_approvals
                WHERE application_id IN (
                    SELECT a.id
                    FROM leave_applications a
                    JOIN employees e ON e.id = a.employee_id
                    WHERE e.emp_code LIKE 'DEMO%'
                )
                """
            )
        )
        session.execute(
            text(
                """
                DELETE FROM leave_applications
                WHERE employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'DEMO%')
                """
            )
        )
        session.execute(
            text(
                """
                UPDATE leave_balances
                SET availed = 0, lop_days = 0, last_updated = now()
                WHERE employee_id IN (SELECT id FROM employees WHERE emp_code LIKE 'DEMO%')
                """
            )
        )

    current_count = int(
        session.execute(
            text("SELECT COUNT(*) FROM leave_applications WHERE app_number LIKE :p"),
            {"p": f"HRMS/{date.today().year}/%"},
        ).scalar()
        or 0
    )

    for idx, ev in enumerate(events, start=1):
        current_count += 1
        app_id = str(uuid.uuid4())
        app_number = f"HRMS/{date.today().year}/{current_count:05d}"
        submitted_at = datetime.combine(ev["from_date"] - timedelta(days=3), datetime.min.time(), tzinfo=timezone.utc)
        if submitted_at > datetime.now(timezone.utc):
            submitted_at = datetime.now(timezone.utc) - timedelta(days=1)

        lt_code = session.execute(
            text(
                """
                SELECT CASE WHEN c.code IN ('JR_ACAD', 'SR_ACAD') THEN 'ANNUAL_RES' ELSE 'EL' END
                FROM employees e
                JOIN employee_categories c ON c.id = e.category_id
                WHERE e.id = :eid
                """
            ),
            {"eid": ev["employee_id"]},
        ).scalar()
        lt_id = session.execute(text("SELECT id FROM leave_types WHERE code = :c"), {"c": lt_code}).scalar()
        if not lt_id:
            continue

        status = ev["status"]
        current_step = first_order if status in ("SUBMITTED", "UNDER_REVIEW") else final_order
        session.execute(
            text(
                """
                INSERT INTO leave_applications
                    (id, app_number, config_id, employee_id, leave_type_id, from_date, to_date, applied_days,
                     is_half_day, reason, address_during_leave, status, current_step_order, submitted_at, last_action_at,
                     application_kind, mc_attached)
                VALUES
                    (:id, :an, :cid, :eid, :lt, :fd, :td, :days, false, :reason, :addr, :st, :step, :submitted, :acted,
                     'NEW', false)
                """
            ),
            {
                "id": app_id,
                "an": app_number,
                "cid": config_id,
                "eid": ev["employee_id"],
                "lt": str(lt_id),
                "fd": ev["from_date"],
                "td": ev["to_date"],
                "days": ev["days"],
                "reason": "Demo seeded history for visual testing",
                "addr": "Hyderabad",
                "st": status,
                "step": current_step,
                "submitted": submitted_at,
                "acted": submitted_at + timedelta(days=1),
            },
        )

        if status == "APPROVED":
            session.execute(
                text(
                    """
                    INSERT INTO leave_approvals
                        (id, application_id, step_id, approver_id, step_order, action, remarks, acted_at)
                    VALUES
                        (:id, :aid, :sid, :uid, :so, 'APPROVED', 'Demo HOD approval', :at)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "aid": app_id,
                    "sid": first_step_id,
                    "uid": str(admin_id),
                    "so": first_order,
                    "at": submitted_at + timedelta(hours=6),
                },
            )
            session.execute(
                text(
                    """
                    INSERT INTO leave_approvals
                        (id, application_id, step_id, approver_id, step_order, action, remarks, acted_at)
                    VALUES
                        (:id, :aid, :sid, :uid, :so, 'APPROVED', 'Demo final approval', :at)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "aid": app_id,
                    "sid": final_step_id,
                    "uid": str(admin_id),
                    "so": final_order,
                    "at": submitted_at + timedelta(days=1),
                },
            )
            session.execute(
                text(
                    """
                    UPDATE leave_balances
                    SET availed = availed + :days, last_updated = now()
                    WHERE employee_id = :eid
                      AND leave_year = :yr
                      AND leave_type_id = :lt
                    """
                ),
                {"days": ev["days"], "eid": ev["employee_id"], "yr": ev["from_date"].year, "lt": str(lt_id)},
            )
            stats.approved += 1
        elif status == "REJECTED":
            session.execute(
                text(
                    """
                    INSERT INTO leave_approvals
                        (id, application_id, step_id, approver_id, step_order, action, remarks, acted_at)
                    VALUES
                        (:id, :aid, :sid, :uid, :so, 'REJECTED', 'Demo rejection', :at)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "aid": app_id,
                    "sid": first_step_id,
                    "uid": str(admin_id),
                    "so": first_order,
                    "at": submitted_at + timedelta(hours=8),
                },
            )
            stats.rejected += 1
        elif status == "WITHDRAWN":
            stats.withdrawn += 1
        elif status == "UNDER_REVIEW":
            stats.under_review += 1
        else:
            stats.submitted += 1

        stats.apps_created += 1


def seed_demo(*, staff_count: int, months_back: int, apps_per_staff: int, keep_existing: bool, seed: int) -> SeedStats:
    stats = SeedStats()
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with Session(engine) as session:
        categories = session.execute(
            text("SELECT id, code FROM employee_categories WHERE code IN ('ADMIN','NURSING','FACULTY','JR_ACAD','SR_ACAD')")
        ).fetchall()
        cat_map = {str(r[1]): str(r[0]) for r in categories}
        required = {"ADMIN", "NURSING", "FACULTY", "JR_ACAD", "SR_ACAD"}
        if not required.issubset(set(cat_map.keys())):
            raise RuntimeError("Missing categories. Run core seeds first.")

        departments = _pick_departments(session, limit=12)
        role_user_ids: dict[str, str] = {}
        for role_name in ("hod", "nodal_estab", "nodal_registrar", "director"):
            role_user_ids[role_name] = _ensure_user(
                session,
                username=role_name,
                role={
                    "hod": "HOD",
                    "nodal_estab": "NODAL_OFFICER",
                    "nodal_registrar": "NODAL_OFFICER",
                    "director": "DIRECTOR",
                }[role_name],
                employee_id=None,
            )

        _ensure_nodal_office_officer(session, office_code="ESTABLISHMENT", nodal_user_id=role_user_ids["nodal_estab"])
        _ensure_nodal_office_officer(session, office_code="REGISTRAR", nodal_user_id=role_user_ids["nodal_registrar"])

        for dept in departments:
            _ensure_hod_assignment(session, department_id=dept["id"], hod_user_id=role_user_ids["hod"])

        category_cycle = ["ADMIN", "NURSING", "FACULTY", "JR_ACAD", "SR_ACAD"]
        staff_ids: list[str] = []
        for i in range(1, staff_count + 1):
            cc = category_cycle[(i - 1) % len(category_cycle)]
            dept = departments[(i - 1) % len(departments)]
            des_id, _ = _pick_designation_for_category(session, cc)
            emp_code = f"DEMO{date.today().year % 100:02d}{i:04d}"
            eid = _ensure_employee(
                session,
                emp_code=emp_code,
                name=f"Demo Staff {i:03d}",
                gender="FEMALE" if i % 2 == 0 else "MALE",
                doj=date.today() - timedelta(days=365 * random.choice([1, 2, 3, 4])),
                category_id=cat_map[cc],
                department_id=dept["id"],
                designation_id=des_id,
                email=f"demo.staff{i:03d}@aiims-demo.local",
            )
            uid = _ensure_user(session, username=emp_code, role="STAFF", employee_id=eid)
            if str(uid):
                pass
            staff_ids.append(eid)
            if emp_code.endswith("0001"):
                stats.staff_created += 0

        current_demo_count = int(
            session.execute(text("SELECT COUNT(*) FROM employees WHERE emp_code LIKE 'DEMO%'")).scalar() or 0
        )
        stats.staff_created = current_demo_count

        _ensure_opening_balances(session, staff_ids, leave_year=date.today().year)
        events = _build_leave_events(staff_ids, months_back=months_back, apps_per_staff=apps_per_staff, seed=seed)
        _seed_history(session, events, keep_existing=keep_existing, stats=stats)
        session.commit()
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed six-month realistic demo activity")
    parser.add_argument("--staff", type=int, default=72, help="Number of demo staff to ensure (default: 72)")
    parser.add_argument("--months", type=int, default=6, help="How many months of history (default: 6)")
    parser.add_argument("--apps-per-staff", type=int, default=4, help="Historical applications per staff (default: 4)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for deterministic output")
    parser.add_argument(
        "--keep-existing",
        action="store_true",
        help="Keep existing DEMO* applications and append instead of reset",
    )
    return parser.parse_args()


def main() -> None:
    _guard()
    args = parse_args()
    stats = seed_demo(
        staff_count=args.staff,
        months_back=args.months,
        apps_per_staff=args.apps_per_staff,
        keep_existing=args.keep_existing,
        seed=args.seed,
    )
    print("Demo six-month seed complete.")
    print(
        f"staff={stats.staff_created} apps={stats.apps_created} approved={stats.approved} "
        f"under_review={stats.under_review} submitted={stats.submitted} "
        f"rejected={stats.rejected} withdrawn={stats.withdrawn}"
    )
    print("Logins: admin/password, hod/password, nodal/password, estab/password, registrar/password, director/password")
    print("Demo assigns hod + nodal to the first 12 departments for approval routing.")


if __name__ == "__main__":
    main()
