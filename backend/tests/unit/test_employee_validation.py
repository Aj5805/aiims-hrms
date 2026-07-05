"""Unit tests for employee registration field validation."""

import pytest
from datetime import date

from app.utils.employee_validation import (
    normalize_address_field,
    parse_iso_date_string,
    suggest_next_increment_date,
    validate_bank_account_optional,
    validate_calendar_date,
    validate_email_optional,
    validate_employee_dates,
    validate_ifsc_optional,
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


def test_validate_calendar_date_year_range():
    assert validate_calendar_date(date(2000, 6, 15)) == date(2000, 6, 15)
    with pytest.raises(ValueError):
        validate_calendar_date(date(1899, 1, 1))
    with pytest.raises(ValueError):
        validate_calendar_date(date(2100, 1, 1))


def test_parse_iso_date_string_rules():
    assert parse_iso_date_string("2000-02-29") == date(2000, 2, 29)
    assert parse_iso_date_string("2001-02-28") == date(2001, 2, 28)
    assert parse_iso_date_string("2023-04-30") == date(2023, 4, 30)
    with pytest.raises(ValueError):
        parse_iso_date_string("2023-02-30")
    with pytest.raises(ValueError):
        parse_iso_date_string("2023-13-01")
    with pytest.raises(ValueError):
        parse_iso_date_string("2023-00-15")
    with pytest.raises(ValueError):
        parse_iso_date_string("1899-12-31")
    with pytest.raises(ValueError):
        parse_iso_date_string("2100-01-01")
    with pytest.raises(ValueError):
        parse_iso_date_string("01-02-2023")


def test_validate_ifsc_normalizes_spaces_and_o():
    assert validate_ifsc_optional("SBIN0001234") == "SBIN0001234"
    assert validate_ifsc_optional("sbin 0001234") == "SBIN0001234"
    assert validate_ifsc_optional("SBINO001234") == "SBIN0001234"
    with pytest.raises(ValueError):
        validate_ifsc_optional("SBIN000123")
    with pytest.raises(ValueError):
        validate_ifsc_optional("12340001234")


def test_validate_bank_account():
    assert validate_bank_account_optional("123456789") == "123456789"
    assert validate_bank_account_optional("1234 5678 9012 3456") == "1234567890123456"
    with pytest.raises(ValueError):
        validate_bank_account_optional("12345678")
    with pytest.raises(ValueError):
        validate_bank_account_optional("1234567890123456789")
    with pytest.raises(ValueError):
        validate_bank_account_optional("12345abc9")


def test_suggest_next_increment_date_jul_cycle():
    assert suggest_next_increment_date(date(2024, 7, 2)) == date(2025, 7, 1)
    assert suggest_next_increment_date(date(2024, 12, 31)) == date(2025, 7, 1)
    assert suggest_next_increment_date(date(2025, 1, 1)) == date(2025, 7, 1)


def test_suggest_next_increment_date_jan_cycle():
    assert suggest_next_increment_date(date(2024, 1, 2)) == date(2025, 1, 1)
    assert suggest_next_increment_date(date(2024, 7, 1)) == date(2025, 1, 1)
