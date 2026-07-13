"""Unit tests for staff number group resolution and prefixed formatting."""

import pytest

from app.data.staff_number_groups import format_staff_number, resolve_staff_group
from app.services.staff_number import (
    StaffNumberError,
    check_emp_code_available,
    parse_emp_code,
    validate_emp_code_for_group,
    validate_staff_group,
)


def test_format_staff_number_prefixes():
    assert format_staff_number("FAC", 1) == "FAC0001"
    assert format_staff_number("FAC", 42) == "FAC0042"
    assert format_staff_number("ADM", 1) == "ADM0001"
    assert format_staff_number("NUR", 1) == "NUR0001"
    assert format_staff_number("PGJR", 99) == "PGJR0099"
    assert format_staff_number("SRAC", 1234) == "SRAC1234"


def test_format_staff_number_rejects_out_of_range():
    with pytest.raises(ValueError):
        format_staff_number("FAC", 0)
    with pytest.raises(ValueError):
        format_staff_number("FAC", 10000)


def test_resolve_from_designation():
    assert resolve_staff_group(
        designation_name="Nursing Officer",
        category_code="NURSING",
        department_code="NURSING",
    ) == "NUR"
    assert resolve_staff_group(
        designation_name="Junior Resident (Academic)",
        category_code="JR_ACAD",
        department_code="GENMED",
    ) == "PGJR"
    assert resolve_staff_group(
        designation_name="Junior Resident (Non-Academic)",
        category_code="JR_NA",
        department_code="GENMED",
    ) == "PGNA"
    assert resolve_staff_group(
        designation_name="Senior Resident (Academic)",
        category_code="SR_ACAD",
        department_code="GENMED",
    ) == "SRAC"
    assert resolve_staff_group(
        designation_name="Senior Resident (Non-Academic)",
        category_code="SR_NA",
        department_code="GENMED",
    ) == "SRNA"
    # Legacy designation names
    assert resolve_staff_group(
        designation_name="P.G. Student",
        category_code="JR_ACAD",
        department_code="GENMED",
    ) == "PGJR"
    assert resolve_staff_group(
        designation_name="Junior Resident",
        category_code="JR_NA",
        department_code="GENMED",
    ) == "PGNA"
    assert resolve_staff_group(
        designation_name="Senior Resident",
        category_code="SR_NA",
        department_code="GENMED",
    ) == "SRNA"


def test_validate_staff_group_rejects_unknown():
    with pytest.raises(StaffNumberError):
        validate_staff_group("invalid")


def test_parse_emp_code_accepts_known_prefix():
    assert parse_emp_code("adm0007") == ("ADM", 7)
    assert parse_emp_code("FAC0042") == ("FAC", 42)


def test_parse_emp_code_rejects_unknown_prefix():
    with pytest.raises(StaffNumberError, match="known prefix"):
        parse_emp_code("HRMS004")


def test_validate_emp_code_for_group_matches_staff_group():
    assert validate_emp_code_for_group("ADM0003", "ADM") == "ADM0003"
    with pytest.raises(StaffNumberError, match="ADM"):
        validate_emp_code_for_group("FAC0003", "ADM")


@pytest.mark.asyncio
async def test_check_emp_code_available_detects_employee_duplicate():
    row = type("Row", (), {"emp_code": "ADM0001", "name": "EXISTING"})()
    result = type("Result", (), {"fetchone": lambda self: row})()
    db = __import__("unittest").mock.AsyncMock()
    db.execute.return_value = result

    ok, message = await check_emp_code_available(db, "ADM0001")
    assert ok is False
    assert "EXISTING" in (message or "")


@pytest.mark.asyncio
async def test_check_emp_code_available_ok_when_no_rows():
    empty = type("Result", (), {"fetchone": lambda self: None})()
    db = __import__("unittest").mock.AsyncMock()
    db.execute.return_value = empty

    ok, message = await check_emp_code_available(db, "ADM0099")
    assert ok is True
    assert message is None
