"""Tests for leave transaction helpers."""

from datetime import date

from app.services.leave_transaction import leave_year_for_date


def test_leave_year_calendar():
    assert leave_year_for_date(date(2026, 3, 15)) == 2026
    assert leave_year_for_date(date(2026, 12, 31)) == 2026
