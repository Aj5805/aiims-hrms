"""Unit tests for leave validation rules."""

from datetime import date

from app.services.leave_validation import check_prefix_suffix, count_leave_days


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
