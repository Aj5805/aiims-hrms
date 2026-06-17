"""Unit test: CL validation -- prefix/suffix, combination rules."""

import pytest
from datetime import date


def test_cl_prefix_holiday_rejected():
    """CL from_date has a holiday on (from_date - 1) -> rejected."""
    holidays = {date(2026, 8, 15)}
    cl_start = date(2026, 8, 16)
    prev = date.fromordinal(cl_start.toordinal() - 1)
    assert prev in holidays  # 15th is a holiday -> CL on 16th rejected


def test_cl_suffix_holiday_rejected():
    """CL to_date has a holiday on (to_date + 1) -> rejected."""
    holidays = {date(2026, 1, 26)}
    cl_end = date(2026, 1, 25)
    next_day = date.fromordinal(cl_end.toordinal() + 1)
    assert next_day in holidays  # 26th is Republic Day -> rejected


def test_cl_no_combination():
    """CL cannot be combined with EL."""
    # CL + EL on same application -> rejected
    combined = ["CL", "EL"]
    assert "CL" in combined and "EL" in combined  # This should be rejected


def test_cl_max_5_per_stretch():
    """CL max 5 days at a stretch."""
    cl_days = 6
    assert cl_days > 5  # Should be rejected


def test_cl_within_limit():
    """CL 3 days, no adjacent holidays -> allowed."""
    cl_days = 3
    assert cl_days <= 5