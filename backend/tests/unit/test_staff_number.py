"""Unit tests for staff number group resolution and 1000001-series formatting."""

import pytest

from app.data.staff_number_groups import (
    STAFF_NUMBER_MAX_SEQUENCE,
    format_staff_number,
    resolve_staff_group,
)
from app.services.staff_number import validate_staff_group, StaffNumberError


def test_format_staff_number_leading_one():
    assert format_staff_number(1) == "1000001"
    assert format_staff_number(42) == "1000042"
    assert format_staff_number(999999) == "1999999"


def test_format_staff_number_rejects_out_of_range():
    with pytest.raises(ValueError):
        format_staff_number(0)
    with pytest.raises(ValueError):
        format_staff_number(STAFF_NUMBER_MAX_SEQUENCE + 1)


def test_resolve_from_designation():
    assert resolve_staff_group(
        designation_name="Nursing Officer",
        category_code="NURSING",
        department_code="NURSING",
    ) == "nursingofficer"


def test_validate_staff_group_rejects_unknown():
    with pytest.raises(StaffNumberError):
        validate_staff_group("invalid")
