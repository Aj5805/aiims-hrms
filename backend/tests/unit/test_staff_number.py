"""Unit tests for staff number group resolution and prefixed formatting."""

import pytest

from app.data.staff_number_groups import format_staff_number, resolve_staff_group
from app.services.staff_number import validate_staff_group, StaffNumberError


def test_format_staff_number_prefixes():
    assert format_staff_number("FAC", 1) == "FAC0001"
    assert format_staff_number("FAC", 42) == "FAC0042"
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
        designation_name="P.G. Student",
        category_code="JR_NA",
        department_code="GENMED",
    ) == "PGNA"


def test_validate_staff_group_rejects_unknown():
    with pytest.raises(StaffNumberError):
        validate_staff_group("invalid")
