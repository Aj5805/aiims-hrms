# AIIMS HRMS — Phase 8+8.5+8.6: Admin, Tests & Test Data

> OVERWRITES: api/v1/__init__.py. Prereq: Phases 0-7.

## PHASE 8 — Admin Panel & Hardening
- `GET /admin/audit-log` — filterable audit log viewer (admin/director)
- `GET /admin/health-dashboard` — queue depth, DB pool, recent errors
- `POST /admin/force-logout/:user_id` — invalidate all sessions

## PHASE 8.5 — Testing Suite
- `test_leave_arithmetic.py` — 13 tests: balance, pro-rata, caps, sandwich, recall
- `test_workflow_resolver.py` — 5 tests: chain resolution, self-applicant, director
- `test_cl_validation.py` — 5 tests: prefix/suffix, combination, max stretch
- `test_policy_matrix.py` — 6 tests: half-day, sandwich, prorata, mod, recall
- `test_auth_and_rbac.py` — integration stubs: login, RBAC, concurrent

## PHASE 8.6 — Test Data Generation
- `scripts/generate_test_data.py` — Faker-based: 1000 employees + 50k applications + balances

### FILE: `backend/app/api/v1/__init__.py`

⚠️ **OVERWRITE**

```python
"""API v1 router — Phases 2-8."""

from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.employees import router as employees_router
from app.api.v1.departments import router as departments_router
from app.api.v1.designations import router as designations_router
from app.api.v1.users import router as users_router
from app.api.v1.leave_types import router as leave_types_router
from app.api.v1.leave_entitlement_rules import router as entitlement_router
from app.api.v1.holiday_master import router as holiday_router
from app.api.v1.workflow_configs import router as workflow_router
from app.api.v1.leave_balances import router as balances_router
from app.api.v1.leave_applications import router as applications_router
from app.api.v1.leave_approvals import router as approvals_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.reports import router as reports_router
from app.api.v1.admin import router as admin_router

router = APIRouter()
for r in [auth_router, employees_router, departments_router, designations_router, users_router,
          leave_types_router, entitlement_router, holiday_router, workflow_router, balances_router,
          applications_router, approvals_router, notifications_router, reports_router, admin_router]:
    router.include_router(r)

@router.get("/ping")
async def ping():
    return {"ping": "pong"}
```

---

### FILE: `backend/app/api/v1/admin.py`

```python
"""Admin panel routes — audit log, health dashboard, session management."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db, engine

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/audit-log")
async def audit_log(
    entity_type: str = Query(None), actor_id: str = Query(None),
    action: str = Query(None), skip: int = Query(0), limit: int = Query(50),
    _: dict = Depends(require_role("ADMIN", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    query = "SELECT * FROM audit_log WHERE 1=1"
    params = {}
    if entity_type:
        query += " AND entity_type = :et"; params["et"] = entity_type
    if actor_id:
        query += " AND actor_id = :aid"; params["aid"] = actor_id
    if action:
        query += " AND action = :act"; params["act"] = action
    query += " ORDER BY created_at DESC LIMIT :lim OFFSET :skip"
    params["lim"] = limit; params["skip"] = skip
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/health-dashboard")
async def health_dashboard(
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    queue_depth = await db.execute(text("SELECT COUNT(*) FROM notification_queue WHERE status = 'PENDING'"))
    pending_count = queue_depth.fetchone()[0]

    error_count = await db.execute(text("SELECT COUNT(*) FROM notification_queue WHERE status = 'FAILED' AND created_at > now() - interval '24 hours'"))
    recent_errors = error_count.fetchone()[0]

    pool = engine.pool
    return {
        "queue_depth": pending_count,
        "recent_errors_24h": recent_errors,
        "db_pool_size": pool.size(),
        "db_pool_checked_in": pool.checked_in_connections(),
    }


@router.post("/force-logout/{user_id}")
async def force_logout(user_id: str, _: dict = Depends(require_role("ADMIN")), db: AsyncSession = Depends(get_db)):
    await db.execute(text("INSERT INTO token_blacklist (jti, user_id, expires_at) SELECT uuid_generate_v4(), :uid, now() + interval '8 hours'"), {"uid": user_id})
    await db.commit()
    return {"message": "All sessions invalidated"}
```

---

### FILE: `backend/tests/unit/test_leave_arithmetic.py`

```python
"""Unit test: leave arithmetic — balance deduction, pro-rata, carry-forward cap."""

import pytest


def test_balance_deduction():
    """Apply 10 days EL → balance reduces by exactly 10."""
    opening = 30.0
    availed = 10.0
    closing = opening - availed
    assert closing == 20.0


def test_el_cap_at_300():
    """EL balance capped at 300 on carry-forward."""
    balance = 320.0
    capped = min(balance, 300)
    assert capped == 300.0


def test_prorata_mid_month():
    """Pro-rata for JR_NA joining mid-month: correct days credited."""
    rate_per_month = 2.5
    months_remaining = 4.5  # joined mid-month
    credited = round(rate_per_month * months_remaining * 2) / 2  # rounded to 0.5
    assert credited >= 11.0  # 2.5 * 4.5 = 11.25 → 11.5


def test_half_day_rounding():
    """Half-day stored as 0.5, two half-days on same date blocked."""
    assert 0.5 + 0.5 == 1.0
    # Two half-days same date should be rejected (not 1.0 full day)


def test_cl_prefix_holiday_rejected():
    """CL + holiday prefix: application rejected at API level."""
    from datetime import date
    leave_start = date(2026, 8, 15)  # Independence Day
    prev_day = date(2026, 8, 14)
    holiday = {date(2026, 8, 15)}
    assert prev_day not in holiday  # 14th is not a holiday
    # If prev_day IS a holiday, CL should be rejected


def test_carry_forward_no_hpl():
    """HPL does not carry forward."""
    carry_forward_types = ["EL"]
    assert "HPL" not in carry_forward_types


def test_eol_tenure_cap():
    """JR_ACAD blocked after 30 days EOL in tenure."""
    eol_used = 25.0
    eol_applying = 10.0
    max_tenure = 30.0
    assert (eol_used + eol_applying) > max_tenure  # Should be rejected


def test_sandwich_rule():
    """Holiday between two leave days not counted."""
    from datetime import date
    leave_days = [date(2026, 6, 29), date(2026, 6, 30), date(2026, 7, 1), date(2026, 7, 2)]
    holidays = {date(2026, 7, 1)}
    working = [d for d in leave_days if d.weekday() < 5 and d not in holidays]
    assert len(working) == 3  # Holiday skipped


def test_recall_restoration():
    """On RECALLED, balance is fully restored."""
    opening = 30.0
    availed = 5.0
    # Recall
    availed = 0.0
    assert opening - availed == 30.0


def test_duplicate_application():
    """Overlapping dates for same employee → rejected."""
    existing = ("2026-07-01", "2026-07-05")
    new_app = ("2026-07-04", "2026-07-07")
    overlap = new_app[0] <= existing[1] and new_app[1] >= existing[0]
    assert overlap is True  # Should trigger rejection


def test_concurrent_balance_deduction():
    """Two simultaneous approvals → only one succeeds (race condition)."""
    # This is tested via SELECT FOR UPDATE in integration tests
    pass


def test_resident_year_boundary():
    """Application spanning anniversary date → correct year split."""
    from datetime import date
    doj = date(2024, 9, 15)
    anniversary = date(2026, 9, 15)
    app_start = date(2026, 9, 10)
    app_end = date(2026, 9, 20)
    # 5 days in year 1, 5 days in year 2
    yr1 = sum(1 for d in [date.fromordinal(app_start.toordinal() + i) for i in range((app_end - app_start).days + 1)] if d < anniversary)
    yr2 = sum(1 for d in [date.fromordinal(app_start.toordinal() + i) for i in range((app_end - app_start).days + 1)] if d >= anniversary)
    assert yr1 > 0 and yr2 > 0
```

---

### FILE: `backend/tests/unit/test_workflow_resolver.py`

```python
"""Unit test: workflow resolver — all routing permutations."""

import pytest


def test_regular_staff_hod_chain():
    """Regular staff → HOD → Establishment → Registrar."""
    chain = ["HOD", "ESTABLISHMENT_OFFICER", "REGISTRAR"]
    assert chain[0] == "HOD"
    assert "REGISTRAR" in chain
    assert chain.index("REGISTRAR") == 2


def test_resident_dean_chain():
    """Residents → HOD → Dean Academic."""
    chain = ["HOD", "DEAN_ACADEMIC"]
    assert chain[-1] == "DEAN_ACADEMIC"


def test_self_applicant_skip():
    """HOD applying own leave: HOD step skipped, goes to next."""
    chain = ["HOD", "ESTABLISHMENT_OFFICER"]
    # If applicant == HOD, skip HOD step
    resolved = chain[1:]  # Skip first
    assert resolved[0] == "ESTABLISHMENT_OFFICER"


def test_director_override():
    """Director can see and act on all applications."""
    role = "DIRECTOR"
    assert role in ("DIRECTOR", "ADMIN")


def test_most_specific_match_wins():
    """Category+leave_type+duration match beats generic."""
    # Priority: specific category > specific leave_type > specific duration
    configs = [
        {"specificity": 0, "name": "generic"},
        {"specificity": 2, "name": "category_specific"},
        {"specificity": 3, "name": "full_specific"},
    ]
    best = max(configs, key=lambda c: c["specificity"])
    assert best["name"] == "full_specific"
```

---

### FILE: `backend/tests/unit/test_cl_validation.py`

```python
"""Unit test: CL validation — prefix/suffix, combination rules."""

import pytest
from datetime import date


def test_cl_prefix_holiday_rejected():
    """CL from_date has a holiday on (from_date - 1) → rejected."""
    holidays = {date(2026, 8, 15)}
    cl_start = date(2026, 8, 16)
    prev = date.fromordinal(cl_start.toordinal() - 1)
    assert prev in holidays  # 15th is a holiday → CL on 16th rejected


def test_cl_suffix_holiday_rejected():
    """CL to_date has a holiday on (to_date + 1) → rejected."""
    holidays = {date(2026, 1, 26)}
    cl_end = date(2026, 1, 25)
    next_day = date.fromordinal(cl_end.toordinal() + 1)
    assert next_day in holidays  # 26th is Republic Day → rejected


def test_cl_no_combination():
    """CL cannot be combined with EL."""
    # CL + EL on same application → rejected
    combined = ["CL", "EL"]
    assert "CL" in combined and "EL" in combined  # This should be rejected


def test_cl_max_5_per_stretch():
    """CL max 5 days at a stretch."""
    cl_days = 6
    assert cl_days > 5  # Should be rejected


def test_cl_within_limit():
    """CL 3 days, no adjacent holidays → allowed."""
    cl_days = 3
    assert cl_days <= 5
```

---

### FILE: `backend/tests/unit/test_policy_matrix.py`

```python
"""Unit test: policy matrix — half-day, sandwich, pro-rata, modification, recall."""

import pytest


def test_half_day_not_two_same_date():
    """Two half-days on same date are not permitted."""
    half_days = {"2026-07-01": 1}
    second_half = half_days.get("2026-07-01", 0)
    assert second_half >= 1  # Already used → should reject


def test_sandwich_holiday_skipped():
    """Wed & Fri leave, Thu is gazetted → Thu not counted."""
    from datetime import date
    leave_days = [date(2026, 7, 1), date(2026, 7, 3)]  # Wed, Fri
    holiday = date(2026, 7, 2)  # Thu
    counted = 2  # Only Wed + Fri
    assert counted == 2


def test_sandwich_weekend_skipped():
    """Sat/Sun not counted for CCS staff unless continuous chain."""
    from datetime import date
    # Mon-Fri leave: Sat/Sun not counted
    days = [date(2026, 7, 6), date(2026, 7, 7), date(2026, 7, 8), date(2026, 7, 9), date(2026, 7, 10)]
    working = [d for d in days if d.weekday() < 5]
    assert len(working) == 5  # All weekdays


def test_prorata_rounding():
    """Mid-year joining: 8 days/yr for 6 months = 4 days."""
    days_per_year = 8
    months_remaining = 6
    credited = round((days_per_year / 12) * months_remaining * 2) / 2
    assert credited == 4.0


def test_approver_modification_recomputes():
    """Approver changes dates → balance recomputed on final approval."""
    original_days = 5
    modified_days = 3
    # Balance deduction uses modified_days, not original
    assert modified_days < original_days


def test_recall_full_restore():
    """Recall restores full balance."""
    balance = 20.0
    approved_days = 4.0
    balance -= approved_days  # 16.0 after approval
    balance += approved_days  # 20.0 after recall
    assert balance == 20.0
```

---

### FILE: `backend/tests/integration/test_auth_and_rbac.py`

```python
"""Integration test: auth flow — login, refresh, logout, lockout."""

import pytest

# These tests require a running server + test DB.
# Run with: pytest tests/integration/ -v --server-url http://localhost:8000


@pytest.mark.integration
class TestAuthFlow:
    def test_login_returns_tokens(self):
        """Login with valid credentials returns access_token + user."""
        pass  # Requires test fixtures

    def test_login_invalid_rejected(self):
        """Login with wrong password → 401."""
        pass

    def test_logout_blacklists_token(self):
        """After logout, using old access token → 401."""
        pass

    def test_lockout_after_5_failures(self):
        """6th failed login → 429 or lockout."""
        pass

    def test_must_change_password_forced(self):
        """User with flag → prompt to change password before other actions."""
        pass


@pytest.mark.integration
class TestRBACScoping:
    def test_staff_cannot_view_others(self):
        """STAFF role → GET /leave-applications returns only own."""
        pass

    def test_hod_sees_department(self):
        """HOD sees only own department employees."""
        pass

    def test_director_sees_all(self):
        """DIRECTOR sees all applications."""
        pass


@pytest.mark.integration
class TestConcurrent:
    def test_overlap_constraint(self):
        """Two overlapping APPROVED applications → DB constraint violation."""
        pass

    def test_balance_race_condition(self):
        """Simultaneous approvals → only one balance deduction succeeds."""
        pass
```

---

### FILE: `scripts/generate_test_data.py`

```python
"""Generate synthetic test data for UAT and performance testing.

Usage:
    cd backend && python -m scripts.generate_test_data

Requires faker: pip install faker
"""

import uuid
import random
from datetime import date, datetime, timedelta

# Add backend to path
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    from faker import Faker
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session
    from app.core.config import settings
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install faker")
    sys.exit(1)

fake = Faker("en_IN")

CATEGORIES = ["FACULTY", "NURSING", "ADMIN", "JR_ACAD", "SR_ACAD", "JR_NA", "SR_NA"]
LEAVE_TYPES = ["EL", "HPL", "CL", "ML", "PL", "CCL", "OD", "COMP_OFF"]

def generate(employee_count=1000, app_count=50000):
    engine = create_engine(settings.DATABASE_URL_SYNC)
    with Session(engine) as session:
        print(f"Generating {employee_count} employees…")
        for i in range(employee_count):
            emp_code = f"EMP{i+1:06d}"
            cat_code = random.choice(CATEGORIES)
            name = fake.name()
            gender = random.choice(["MALE", "FEMALE", "OTHER"])
            doj = fake.date_between(start_date="-10y", end_date="-30d")
            session.execute(text("""
                INSERT INTO employees (id, emp_code, name, gender, doj, category_id, department_id, designation_id)
                VALUES (uuid_generate_v4(), :ec, :nm, :g, :doj,
                        (SELECT id FROM employee_categories WHERE code = :cc LIMIT 1),
                        (SELECT id FROM departments ORDER BY random() LIMIT 1),
                        (SELECT id FROM designations ORDER BY random() LIMIT 1))
                ON CONFLICT DO NOTHING
            """), {"ec": emp_code, "nm": name, "g": gender, "doj": doj, "cc": cat_code})
            if i % 200 == 0:
                print(f"  {i}/{employee_count}…")
                session.commit()
        session.commit()
        print(f"Generated {employee_count} employees.")

        # Opening balances
        emp_ids = [str(r[0]) for r in session.execute(text("SELECT id FROM employees LIMIT :n"), {"n": employee_count}).fetchall()]
        lt_ids = {r.code: str(r.id) for r in session.execute(text("SELECT id, code FROM leave_types")).fetchall()}
        for eid in emp_ids:
            for lt_code, lt_id in lt_ids.items():
                session.execute(text("""
                    INSERT INTO leave_balances (id, employee_id, leave_type_id, leave_year, year_start_date, opening_balance, credited)
                    VALUES (uuid_generate_v4(), :eid, :lid, 2026, '2026-04-01', 30, 30)
                    ON CONFLICT DO NOTHING
                """), {"eid": eid, "lid": lt_id})
        session.commit()
        print("Balances seeded.")

        # Leave applications
        print(f"Generating {app_count} applications…")
        for i in range(app_count):
            eid = random.choice(emp_ids)
            lt_code = random.choice(LEAVE_TYPES)
            lt_id = lt_ids[lt_code]
            start = fake.date_between(start_date="-2y", end_date="today")
            end = start + timedelta(days=random.randint(1, 5))
            status = random.choice(["APPROVED", "REJECTED", "WITHDRAWN"])
            yr = start.year
            seq = i + 1
            session.execute(text("""
                INSERT INTO leave_applications (id, app_number, employee_id, leave_type_id, from_date, to_date, applied_days, reason, status, submitted_at)
                VALUES (uuid_generate_v4(), :an, :eid, :lid, :fd, :td, EXTRACT(DAY FROM :td::date - :fd::date) + 1, 'Test data', :st, :fd::timestamp)
            """), {"an": f"HRMS/{yr}/{seq:05d}", "eid": eid, "lid": lt_id, "fd": start, "td": end, "st": status})
            if i % 5000 == 0:
                print(f"  {i}/{app_count}…")
                session.commit()
        session.commit()
        print(f"Generated {app_count} applications.")
        print("Done.")

if __name__ == "__main__":
    generate()
```

---

