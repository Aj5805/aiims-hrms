"""Unit tests for approval trail access rules."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.approval_trail import can_view_trail


def _fetchone_result(value):
    result = MagicMock()
    result.fetchone.return_value = value
    return result


def _step_row(approver_role: str, specific_id=None):
    row = MagicMock()
    row.approver_role = approver_role
    row.specific_approver_id = specific_id
    return row


@pytest.mark.asyncio
async def test_hod_inbox_match_can_view_trail_without_resolved_hod():
    """HOD who sees an item in the approval inbox must also see the movement trail."""
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _fetchone_result(None),  # applicant user lookup
            _fetchone_result(None),  # acted in leave_approvals
            _fetchone_result(_step_row("HOD")),  # current workflow step
            _fetchone_result(("emp-hod",)),  # HOD actor employee_id (not applicant)
        ]
    )

    allowed = await can_view_trail(
        db,
        user_id="hod-user-1",
        role="HOD",
        application_id="app-1",
        employee_id="emp-applicant",
        config_id="cfg-1",
        current_step_order=1,
        status="SUBMITTED",
    )

    assert allowed is True


@pytest.mark.asyncio
async def test_applicant_can_view_trail():
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _fetchone_result(("staff-user-1",)),  # applicant user lookup
        ]
    )

    allowed = await can_view_trail(
        db,
        user_id="staff-user-1",
        role="STAFF",
        application_id="app-1",
        employee_id="emp-staff",
        config_id="cfg-1",
        current_step_order=1,
        status="SUBMITTED",
    )

    assert allowed is True


@pytest.mark.asyncio
async def test_nodal_officer_in_scope_can_view_approved_trail():
    """Nodal officer viewing staff ledger can see movement trail for scoped employees."""
    db = AsyncMock()

    allowed = await can_view_trail(
        db,
        user_id="nodal-user-1",
        role="NODAL_OFFICER",
        application_id="app-1",
        employee_id="emp-staff",
        config_id="cfg-1",
        current_step_order=2,
        status="APPROVED",
        employee_scope={"scope": "nodal_office", "employee_ids": ["emp-staff", "emp-other"]},
    )

    assert allowed is True


@pytest.mark.asyncio
async def test_hod_out_of_scope_cannot_view_trail():
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _fetchone_result(None),  # applicant user lookup
            _fetchone_result(None),  # acted in leave_approvals
        ]
    )

    allowed = await can_view_trail(
        db,
        user_id="hod-user-1",
        role="HOD",
        application_id="app-1",
        employee_id="emp-other-dept",
        config_id="cfg-1",
        current_step_order=1,
        status="APPROVED",
        employee_scope={"scope": "department", "employee_ids": ["emp-hod-dept"]},
    )

    assert allowed is False
