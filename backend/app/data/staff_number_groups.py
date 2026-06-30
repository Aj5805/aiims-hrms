"""Staff group labels and suggestion rules (numbering is global — see staff_number service)."""

from __future__ import annotations

from typing import TypedDict

# Uniform 7-digit institution-wide staff numbers (leading 1 + 6-digit sequence).
STAFF_NUMBER_WIDTH = 7
STAFF_NUMBER_BASE = 1_000_000  # sequence 1 → 1000001
STAFF_NUMBER_MAX_SEQUENCE = 999_999  # sequence 999999 → 1999999
GLOBAL_SEQUENCE_CODE = "GLOBAL"


class StaffGroupDef(TypedDict):
    label: str


# Staff group classifies the employee; it can change on promote/transfer without changing emp_code.
STAFF_NUMBER_GROUPS: dict[str, StaffGroupDef] = {
    "admin": {"label": "Administration"},
    "faculty": {"label": "Faculty"},
    "nursingofficer": {"label": "Nursing Officer"},
    "seniorNursingofficer": {"label": "Senior Nursing Officer"},
    "collegeOfNursing": {"label": "College of Nursing"},
    "SR": {"label": "Senior Resident"},
    "JR": {"label": "Junior Resident"},
    "PG": {"label": "P.G. Student"},
}

STAFF_GROUP_CODES = frozenset(STAFF_NUMBER_GROUPS)

COLLEGE_OF_NURSING_DEPT_CODE = "NURSCOLL"

DESIGNATION_STAFF_GROUP: dict[str, str] = {
    "P.G. Student": "PG",
    "Junior Resident": "JR",
    "Senior Resident": "SR",
    "SR (Academic)": "SR",
    "Nursing Officer": "nursingofficer",
    "Senior Nursing Officer": "seniorNursingofficer",
}

CATEGORY_STAFF_GROUP_FALLBACK: dict[str, str] = {
    "FACULTY": "faculty",
    "NURSING": "nursingofficer",
    "ADMIN": "admin",
    "JR_ACAD": "JR",
    "SR_ACAD": "SR",
    "JR_NA": "JR",
    "SR_NA": "SR",
}


def format_staff_number(sequence: int) -> str:
    """Format internal sequence as a 7-digit staff number (1000001, 1000002, …)."""
    if sequence < 1 or sequence > STAFF_NUMBER_MAX_SEQUENCE:
        raise ValueError(
            f"Staff number sequence must be between 1 and {STAFF_NUMBER_MAX_SEQUENCE}"
        )
    return str(STAFF_NUMBER_BASE + sequence)


def resolve_staff_group(
    *,
    designation_name: str | None,
    category_code: str | None,
    department_code: str | None,
) -> str | None:
    """Suggest staff group from designation, then department, then leave category."""
    if designation_name and designation_name in DESIGNATION_STAFF_GROUP:
        return DESIGNATION_STAFF_GROUP[designation_name]

    if department_code == COLLEGE_OF_NURSING_DEPT_CODE:
        return "collegeOfNursing"

    if category_code and category_code in CATEGORY_STAFF_GROUP_FALLBACK:
        return CATEGORY_STAFF_GROUP_FALLBACK[category_code]

    return None
