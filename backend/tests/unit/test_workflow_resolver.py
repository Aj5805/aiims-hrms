"""Unit tests for workflow config matching (shared resolver logic)."""

from app.services.workflow_resolver import (
    days_in_workflow_range,
    normalize_code,
    pick_best_workflow_config,
    workflow_specificity_key,
)


def _cfg(
    name: str,
    *,
    category_code: str | None = None,
    leave_type_code: str | None = None,
    min_days: int = 1,
    max_days: int | None = None,
    is_active: bool = True,
) -> dict:
    return {
        "config_name": name,
        "category_id": "cat-id" if category_code else None,
        "category_code": category_code,
        "leave_type_id": "lt-id" if leave_type_code else None,
        "leave_type_code": leave_type_code,
        "min_days": min_days,
        "max_days": max_days,
        "is_active": is_active,
    }


def test_normalize_code_trims_and_uppercases():
    assert normalize_code(" faculty ") == "FACULTY"
    assert normalize_code("") is None
    assert normalize_code(None) is None


def test_days_in_workflow_range_respects_bounds():
    assert days_in_workflow_range(3, 1, 5) is True
    assert days_in_workflow_range(10, 1, 5) is False
    assert days_in_workflow_range(0.5, 1, None) is False
    assert days_in_workflow_range(1, 1, None) is True


def test_specificity_key_prefers_category_then_leave_type_then_min_days():
    generic = workflow_specificity_key(category_specific=False, leave_type_specific=False, min_days=1, config_name="A")
    faculty = workflow_specificity_key(category_specific=True, leave_type_specific=False, min_days=1, config_name="B")
    faculty_el = workflow_specificity_key(category_specific=True, leave_type_specific=True, min_days=1, config_name="C")
    assert faculty > generic
    assert faculty_el > faculty


def test_pick_best_prefers_category_specific_over_generic():
    configs = [
        _cfg("Regular Staff — Default", min_days=1, max_days=None),
        _cfg("Resident — JR_ACAD", category_code="JR_ACAD", min_days=1, max_days=None),
    ]
    match = pick_best_workflow_config(configs, category_code="JR_ACAD", leave_type_code="EL", days=3)
    assert match is not None
    assert match["config_name"] == "Resident — JR_ACAD"


def test_pick_best_prefers_leave_type_specific():
    configs = [
        _cfg("All EL", category_code="FACULTY", min_days=1, max_days=None),
        _cfg("Faculty EL short", category_code="FACULTY", leave_type_code="EL", min_days=1, max_days=5),
        _cfg("Faculty EL long", category_code="FACULTY", leave_type_code="EL", min_days=6, max_days=None),
    ]
    short = pick_best_workflow_config(configs, category_code="FACULTY", leave_type_code="EL", days=3)
    assert short is not None
    assert short["config_name"] == "Faculty EL short"

    long = pick_best_workflow_config(configs, category_code="FACULTY", leave_type_code="EL", days=10)
    assert long is not None
    assert long["config_name"] == "Faculty EL long"


def test_pick_best_returns_none_when_days_outside_all_ranges():
    configs = [
        _cfg("Faculty EL short", category_code="FACULTY", leave_type_code="EL", min_days=1, max_days=5),
    ]
    assert pick_best_workflow_config(configs, category_code="FACULTY", leave_type_code="EL", days=10) is None


def test_pick_best_ignores_inactive():
    configs = [
        _cfg("Inactive specific", category_code="FACULTY", leave_type_code="EL", is_active=False),
        _cfg("Active generic", min_days=1),
    ]
    match = pick_best_workflow_config(configs, category_code="FACULTY", leave_type_code="EL", days=2)
    assert match is not None
    assert match["config_name"] == "Active generic"


def test_entitlement_blocked_message_is_clear():
    from app.services.workflow_resolver import entitlement_blocked_message

    msg = entitlement_blocked_message("FACULTY", "ANNUAL_RES")
    assert "ANNUAL_RES" in msg
    assert "FACULTY" in msg
    assert "Entitlements" in msg


def test_simulation_requires_both_message():
    from app.services.workflow_resolver import simulation_requires_both_message

    msg = simulation_requires_both_message()
    assert "category" in msg.lower()
    assert "leave type" in msg.lower()
