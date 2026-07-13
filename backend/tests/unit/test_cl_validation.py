"""Unit tests for CCS/DoPT Casual Leave validation rules."""

from datetime import date

from app.services.leave_validation import (
    check_max_absence_span,
    check_prefix_suffix,
    check_sandwich_with_existing,
    count_leave_days,
    expand_absence_span,
    is_non_working_day,
)


def test_cl_weekend_prefix_allowed():
    """DoPT: CL may attach to a preceding weekend — not blocked."""
    monday = date(2026, 6, 8)
    holidays: set[date] = set()
    assert check_prefix_suffix(monday, monday, holidays, {}) is None


def test_el_prefix_weekend_still_blocked_when_configured():
    monday = date(2026, 6, 8)
    rules = {"no_prefix_suffix_weekends": True}
    err = check_prefix_suffix(monday, monday, set(), rules)
    assert err == "Leave cannot be prefixed to a weekend"


def test_cl_debited_days_exclude_weekends_and_holidays():
    holidays = {date(2026, 1, 26)}
    # Fri–Mon with Republic Day on Monday; Saturday is a working day at AIIMS
    fri = date(2026, 1, 23)
    mon = date(2026, 1, 26)
    assert count_leave_days(fri, mon, holidays, count_holidays=False, is_half_day=False) == 2


def test_cl_absence_span_includes_attached_weekend():
    sat = date(2026, 6, 6)
    holidays: set[date] = set()
    start, end, span = expand_absence_span(sat, sat, holidays)
    assert start == sat
    assert end == date(2026, 6, 7)  # Sunday after Saturday CL
    assert span == 2


def test_cl_max_absence_span_blocks_over_eight():
    holidays: set[date] = set()
    wed = date(2026, 7, 1)
    thu = date(2026, 7, 9)
    rules = {"max_absence_span": 8}
    err = check_max_absence_span(wed, thu, holidays, rules)
    assert err is not None
    assert "8" in err


def test_sandwich_cl_then_weekend_then_el_blocked():
    holidays: set[date] = set()
    existing = {
        "leave_type_code": "CL",
        "from_date": date(2026, 6, 6),
        "to_date": date(2026, 6, 6),
    }
    err = check_sandwich_with_existing(
        new_code="EL",
        new_from=date(2026, 6, 8),
        new_to=date(2026, 6, 10),
        existing=existing,
        holidays=holidays,
        incompatible=frozenset({"EL", "HPL", "EOL"}),
        allow_emergency_continuation=False,
    )
    assert err is not None
    assert "sandwich" in err.lower()


def test_sandwich_allowed_with_emergency_half_day_cl():
    holidays: set[date] = set()
    existing = {
        "leave_type_code": "CL",
        "from_date": date(2026, 6, 7),
        "to_date": date(2026, 6, 7),
    }
    err = check_sandwich_with_existing(
        new_code="EL",
        new_from=date(2026, 6, 8),
        new_to=date(2026, 6, 10),
        existing=existing,
        holidays=holidays,
        incompatible=frozenset({"EL", "HPL", "EOL"}),
        allow_emergency_continuation=True,
    )
    assert err is None


def test_working_day_between_cl_and_el_not_sandwich():
    holidays: set[date] = set()
    existing = {
        "leave_type_code": "CL",
        "from_date": date(2026, 6, 3),
        "to_date": date(2026, 6, 4),
    }
    # Gap: Fri working day between CL ending Thu and EL starting Mon
    err = check_sandwich_with_existing(
        new_code="EL",
        new_from=date(2026, 6, 8),
        new_to=date(2026, 6, 9),
        existing=existing,
        holidays=holidays,
        incompatible=frozenset({"EL", "HPL", "EOL"}),
        allow_emergency_continuation=False,
    )
    assert err is None


def test_is_non_working_day():
    sat = date(2026, 6, 6)
    sun = date(2026, 6, 7)
    hol = date(2026, 8, 15)
    assert not is_non_working_day(sat, set())
    assert is_non_working_day(sun, set())
    assert is_non_working_day(hol, {hol})
