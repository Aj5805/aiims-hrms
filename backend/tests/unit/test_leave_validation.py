"""Unit tests for leave validation rules."""

from datetime import date, timedelta

import pytest
from fastapi import HTTPException

from app.services.leave_validation import (
    check_prefix_suffix,
    count_leave_days,
    validate_retrospective_dates,
)


def test_count_working_days_excludes_weekends():
    holidays: set[date] = set()
    mon = date(2026, 6, 1)
    fri = date(2026, 6, 5)
    assert count_leave_days(mon, fri, holidays, count_holidays=False, is_half_day=False) == 5


def test_half_day_returns_point_five():
    d = date(2026, 6, 3)
    assert count_leave_days(d, d, set(), count_holidays=False, is_half_day=True) == 0.5


def test_prefix_weekend_blocked_when_configured():
    monday = date(2026, 6, 8)
    rules = {"no_prefix_suffix_weekends": True}
    err = check_prefix_suffix(monday, monday, set(), rules)
    assert err == "Leave cannot be prefixed to a weekend"


def test_cl_prefix_weekend_not_blocked_by_default():
    monday = date(2026, 6, 8)
    assert check_prefix_suffix(monday, monday, set(), {}) is None


def test_suffix_holiday_blocked_when_configured():
    wed = date(2026, 6, 10)
    thu = date(2026, 6, 11)
    holidays = {date(2026, 6, 12)}
    rules = {"no_prefix_suffix_holidays": True}
    err = check_prefix_suffix(wed, thu, holidays, rules)
    assert err == "Leave cannot be suffixed to a holiday"


def test_single_day_same_from_to_counts_one():
    sat = date(2026, 7, 4)  # Saturday
    assert count_leave_days(sat, sat, set(), count_holidays=True, is_half_day=False) == 1.0


def test_retrospective_no_mc_required():
    today = date.today()
    from_d = today - timedelta(days=3)
    to_d = today - timedelta(days=1)
    validate_retrospective_dates(from_d, to_d, {}, mc_attached=False)


def test_retrospective_rejects_future_end():
    today = date.today()
    from_d = today - timedelta(days=3)
    with pytest.raises(HTTPException) as exc:
        validate_retrospective_dates(from_d, today + timedelta(days=1), {}, mc_attached=True)
    assert "future" in exc.value.detail.lower()


def test_retrospective_allows_long_backdate():
    today = date.today()
    from_d = today - timedelta(days=400)
    to_d = today - timedelta(days=395)
    validate_retrospective_dates(from_d, to_d, {}, mc_attached=False)
