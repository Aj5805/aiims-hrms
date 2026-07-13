"""Unit tests for employee lifecycle action normalization."""

from app.services.employee_lifecycle import normalize_lifecycle_action


def test_normalize_lifecycle_action_aliases():
    assert normalize_lifecycle_action("resign") == "deactivate"
    assert normalize_lifecycle_action("rejoin") == "reactivate"
    assert normalize_lifecycle_action("promote") == "change_designation"
    assert normalize_lifecycle_action("demote") == "change_designation"


def test_normalize_lifecycle_action_canonical():
    assert normalize_lifecycle_action("deactivate") == "deactivate"
    assert normalize_lifecycle_action("transfer") == "transfer"
