"""Tests for leave balance bootstrap credit amounts."""

from datetime import date

from app.services.leave_balance_bootstrap import onboarding_credited_amount


def test_ccs_el_join_mid_year():
    rule = {
        "year_ref": "CALENDAR",
        "days_per_year": 30,
        "prorata_rate": 2.5,
    }
    # Joined July 2026 → 6 months (Jul–Dec) × 2.5 = 15
    assert onboarding_credited_amount(rule, date(2026, 7, 1), date(2026, 7, 1)) == 15.0


def test_resident_annual_join_mid_year():
    rule = {
        "year_ref": "CALENDAR",
        "days_per_year": 30,
        "prorata_rate": 2.5,
    }
    # Same annual pro-rata as CCS — join July → 15 days for remainder of year
    assert onboarding_credited_amount(rule, date(2026, 7, 15), date(2026, 10, 1)) == 15.0


def test_tenure_ml_pool():
    rule = {
        "year_ref": "TENURE",
        "max_in_tenure": 180,
    }
    assert onboarding_credited_amount(rule, date(2026, 1, 1)) == 180.0
