"""Unit tests for employee registration field validation."""

import pytest
from datetime import date

from app.utils.employee_validation import (
    normalize_address_field,
    validate_email_optional,
    validate_employee_dates,
)


def test_validate_email_requires_single_at():
    assert validate_email_optional("user@aiims.edu") == "user@aiims.edu"
    with pytest.raises(ValueError):
        validate_email_optional("user@@aiims.edu")
    with pytest.raises(ValueError):
        validate_email_optional("user@aiims@edu")


def test_validate_email_requires_dot_in_domain():
    assert validate_email_optional("user@aiims.edu") == "user@aiims.edu"
    with pytest.raises(ValueError):
        validate_email_optional("notanemail")
    with pytest.raises(ValueError):
        validate_email_optional("user@localhost")


def test_normalize_address_json_pin():
    raw = '{"flat":"12A","street":"MAIN ROAD","city":"HYDERABAD","state":"TELANGANA","pin":"500001"}'
    out = normalize_address_field(raw)
    assert out is not None
    assert '"pin": "500001"' in out


def test_normalize_address_rejects_bad_pin():
    raw = '{"flat":"12A","street":"MAIN","city":"HYD","state":"TS","pin":"50001"}'
    with pytest.raises(ValueError):
        normalize_address_field(raw)


def test_invalid_calendar_date_rejected_by_python():
    with pytest.raises(ValueError):
        date(2023, 2, 30)


def test_validate_employee_dates_order():
    validate_employee_dates(dob=date(1990, 1, 1), doj=date(2020, 7, 1))
    with pytest.raises(ValueError):
        validate_employee_dates(dob=date(2020, 1, 1), doj=date(1990, 1, 1))
