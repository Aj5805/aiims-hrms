"""Central working-day rules — AIIMS uses a six-day week (Monday–Saturday)."""

from datetime import date


def is_weekend(d: date) -> bool:
    """Sunday is the weekly off-day."""
    return d.weekday() == 6


def is_non_working_day(d: date, holidays: set[date]) -> bool:
    return is_weekend(d) or d in holidays


def is_working_day(d: date, holidays: set[date]) -> bool:
    return not is_non_working_day(d, holidays)
