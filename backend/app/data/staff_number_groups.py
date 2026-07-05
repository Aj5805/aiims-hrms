"""Staff group labels, prefix sequences, and suggestion rules."""

from __future__ import annotations

from typing import TypedDict


class StaffGroupDef(TypedDict):
    label: str
    prefix: str
    pad_width: int


# Per-group prefixed staff numbers (e.g. FAC0001, PGJR0042). Numbers are never reused.
STAFF_NUMBER_GROUPS: dict[str, StaffGroupDef] = {
    "FAC": {"label": "Faculty", "prefix": "FAC", "pad_width": 4},
    "NUR": {"label": "Nursing Officer", "prefix": "NUR", "pad_width": 4},
    "NFS": {"label": "Senior Nursing Officer", "prefix": "NFS", "pad_width": 4},
    "DEP": {"label": "Administration / Department", "prefix": "DEP", "pad_width": 4},
    "CON": {"label": "College of Nursing", "prefix": "CON", "pad_width": 4},
    "PGJR": {"label": "Junior Resident (Academic)", "prefix": "PGJR", "pad_width": 4},
    "PGNA": {"label": "Junior Resident (Non-Academic)", "prefix": "PGNA", "pad_width": 4},
    "SRAC": {"label": "Senior Resident (Academic)", "prefix": "SRAC", "pad_width": 4},
    "SRNA": {"label": "Senior Resident (Non-Academic)", "prefix": "SRNA", "pad_width": 4},
}

STAFF_GROUP_CODES = frozenset(STAFF_NUMBER_GROUPS)

COLLEGE_OF_NURSING_DEPT_CODE = "NURSCOLL"

DESIGNATION_STAFF_GROUP: dict[str, str] = {
    "Junior Resident (Academic)": "PGJR",
    "Junior Resident (Non-Academic)": "PGNA",
    "Senior Resident (Academic)": "SRAC",
    "Senior Resident (Non-Academic)": "SRNA",
    # Legacy designation names (pre-2026-07-04 resident rename)
    "P.G. Student": "PGJR",
    "Junior Resident": "PGNA",
    "Senior Resident": "SRAC",
    "SR (Academic)": "SRAC",
    "Nursing Officer": "NUR",
    "Senior Nursing Officer": "NFS",
}

CATEGORY_STAFF_GROUP_FALLBACK: dict[str, str] = {
    "FACULTY": "FAC",
    "NURSING": "NUR",
    "ADMIN": "DEP",
    "JR_ACAD": "PGJR",
    "SR_ACAD": "SRAC",
    "JR_NA": "PGNA",
    "SR_NA": "SRNA",
}


def format_staff_number(group_code: str, sequence: int) -> str:
    """Format a group sequence as a prefixed staff number (FAC0001, PGJR0042, …)."""
    spec = STAFF_NUMBER_GROUPS.get(group_code)
    if not spec:
        raise ValueError(f"Unknown staff group '{group_code}'")
    pad = spec["pad_width"]
    max_seq = 10**pad - 1
    if sequence < 1 or sequence > max_seq:
        raise ValueError(
            f"Staff number sequence for {group_code} must be between 1 and {max_seq}"
        )
    return f"{spec['prefix']}{sequence:0{pad}d}"


def resolve_staff_group(
    *,
    designation_name: str | None,
    category_code: str | None,
    department_code: str | None,
) -> str | None:
    """Suggest staff group from designation, then department, then leave category."""
    if designation_name and designation_name in DESIGNATION_STAFF_GROUP:
        suggested = DESIGNATION_STAFF_GROUP[designation_name]
        if designation_name == "Senior Resident" and category_code == "SR_NA":
            return "SRNA"
        return suggested

    if department_code == COLLEGE_OF_NURSING_DEPT_CODE:
        return "CON"

    if category_code and category_code in CATEGORY_STAFF_GROUP_FALLBACK:
        return CATEGORY_STAFF_GROUP_FALLBACK[category_code]

    return None
