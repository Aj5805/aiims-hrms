"""Canonical system roles for RBAC — keep in sync with frontend/src/constants/roles.ts."""

from typing import TypedDict

# Removed roles — rejected on assign; mapped on read for stale tokens until re-login
DEPRECATED_ROLE_MAP: dict[str, str] = {
    "ESTABLISHMENT": "NODAL_OFFICER",
    "ESTABLISHMENT_OFFICER": "NODAL_OFFICER",
    "REGISTRAR": "NODAL_OFFICER",
    "DEAN_ACADEMIC": "STAFF",
}


class RoleMeta(TypedDict):
    code: str
    label: str
    description: str


SYSTEM_ROLES: list[RoleMeta] = [
    {
        "code": "ADMIN",
        "label": "Super Admin",
        "description": "Full system access, admin console, impersonation, all masters",
    },
    {
        "code": "DIRECTOR",
        "label": "Executive Director",
        "description": "Read-only institutional view across all staff and reports",
    },
    {
        "code": "NODAL_OFFICER",
        "label": "Nodal Officer",
        "description": "Final leave approver for staff in assigned nodal office (Establishment/CCS or Registrar/residents)",
    },
    {
        "code": "NODAL_OFFICE",
        "label": "Nodal Office (Clerical)",
        "description": "Clerical staff under a nodal officer — onboarding, directory, reports, profile edit, manual leave entries; no leave approval",
    },
    {
        "code": "HOD",
        "label": "Head of Department",
        "description": "First-stage leave approver for own department",
    },
    {
        "code": "STAFF",
        "label": "Staff",
        "description": "Apply leave, view own balances and profile, edit non-critical personal fields",
    },
]

SYSTEM_ROLE_CODES = frozenset(r["code"] for r in SYSTEM_ROLES)
ASSIGNABLE_ROLE_CODES = SYSTEM_ROLE_CODES

WORKFLOW_APPROVER_ROLES = frozenset({"HOD", "NODAL_OFFICER", "SPECIFIC_USER"})

# Common RBAC groupings
MASTER_ADMIN_ROLES = frozenset({"ADMIN"})
MASTER_VIEW_ROLES = frozenset({"ADMIN", "DIRECTOR", "HOD", "NODAL_OFFICER", "NODAL_OFFICE", "STAFF"})
HR_EDITOR_ROLES = frozenset({"ADMIN", "NODAL_OFFICER", "NODAL_OFFICE"})
REPORT_ROLES = frozenset({"ADMIN", "DIRECTOR", "NODAL_OFFICER", "NODAL_OFFICE"})
APPROVER_ROLES = frozenset({"ADMIN", "HOD", "NODAL_OFFICER"})
NODAL_DESK_ROLES = frozenset({"HOD", "NODAL_OFFICER"})


def normalize_role(role: str) -> str:
    return DEPRECATED_ROLE_MAP.get(role, role)


def is_assignable_role(role: str) -> bool:
    return role in ASSIGNABLE_ROLE_CODES
