"""Unit tests for attendance status derivation."""

from datetime import date

from app.services.attendance_report import _default_final_status


def test_weekend_status():
    assert _default_final_status(date(2026, 7, 4), set(), False) == "ON_DUTY"  # Saturday — working day
    assert _default_final_status(date(2026, 7, 5), set(), False) == "WEEKEND"  # Sunday


def test_holiday_status():
    holiday = date(2026, 8, 15)
    assert _default_final_status(holiday, {holiday}, False) == "HOLIDAY"


def test_on_leave_overrides_weekday():
    assert _default_final_status(date(2026, 7, 6), set(), True) == "ON_LEAVE"


def test_weekday_on_duty():
    assert _default_final_status(date(2026, 7, 6), set(), False) == "ON_DUTY"
