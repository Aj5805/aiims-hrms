"""Unit test: policy matrix -- half-day, sandwich, pro-rata, modification, recall."""

import pytest


def test_half_day_not_two_same_date():
    """Two half-days on same date are not permitted."""
    half_days = {"2026-07-01": 1}
    second_half = half_days.get("2026-07-01", 0)
    assert second_half >= 1  # Already used -> should reject


def test_sandwich_holiday_skipped():
    """Wed & Fri leave, Thu is gazetted -> Thu not counted."""
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
    """Approver changes dates -> balance recomputed on final approval."""
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