"""Unit tests for staff-group resolution used in onboarding."""

from app.data.staff_number_groups import resolve_staff_group


def test_faculty_designation_resolves_fac():
    assert resolve_staff_group(designation_name="Professor", category_code="FACULTY", department_code=None) == "FAC"


def test_jr_academic_designation_resolves_pgjr():
    assert resolve_staff_group(
        designation_name="Junior Resident (Academic)", category_code="JR_ACAD", department_code=None
    ) == "PGJR"


def test_category_fallback_when_designation_unknown():
    assert resolve_staff_group(designation_name="Unknown Title", category_code="ADMIN", department_code=None) == "DEP"


def test_college_of_nursing_department_overrides():
    assert resolve_staff_group(
        designation_name="Accounts Officer",
        category_code="ADMIN",
        department_code="NURSCOLL",
    ) == "CON"
