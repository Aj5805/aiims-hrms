"""Unit tests for canonical role helpers."""

import pytest

from app.auth.roles import (
    DEPRECATED_ROLE_MAP,
    SYSTEM_ROLE_CODES,
    is_assignable_role,
    normalize_role,
)


@pytest.mark.parametrize(
    "legacy,expected",
    [
        ("ESTABLISHMENT_OFFICER", "NODAL_OFFICER"),
        ("REGISTRAR", "NODAL_OFFICER"),
        ("DEAN_ACADEMIC", "STAFF"),
        ("HOD", "HOD"),
    ],
)
def test_normalize_role_maps_legacy(legacy, expected):
    assert normalize_role(legacy) == expected


def test_assignable_roles_exclude_legacy():
    for legacy in DEPRECATED_ROLE_MAP:
        assert legacy not in SYSTEM_ROLE_CODES
        assert not is_assignable_role(legacy)


def test_current_roles_assignable():
    for role in ("ADMIN", "DIRECTOR", "NODAL_OFFICER", "NODAL_OFFICE", "HOD", "STAFF"):
        assert is_assignable_role(role)
