"""Unit tests for HPL commutation."""

import pytest
from fastapi import HTTPException

from app.services.leave_hpl import balance_debit_days


def test_balance_debit_normal_hpl():
    assert balance_debit_days(5, "HPL", is_commuted=False) == 5


def test_balance_debit_commuted_hpl_doubles():
    assert balance_debit_days(5, "HPL", is_commuted=True) == 10


def test_balance_debit_commuted_only_for_hpl():
    assert balance_debit_days(5, "EL", is_commuted=True) == 5


def test_validate_retrospective_no_day_limit():
    from datetime import date, timedelta

    from app.services.leave_validation import validate_retrospective_dates

    today = date.today()
    from_d = today - timedelta(days=400)
    to_d = today - timedelta(days=395)
    validate_retrospective_dates(from_d, to_d, {}, mc_attached=False)
