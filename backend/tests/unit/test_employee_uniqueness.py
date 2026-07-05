"""Unit tests for cross-employee identifier uniqueness checks."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.employee_uniqueness import assert_employee_fields_unique, find_duplicate_employee


@pytest.mark.asyncio
async def test_find_duplicate_returns_none_when_empty():
    db = AsyncMock()
    assert await find_duplicate_employee(db, field="pan", value=None) is None
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_find_duplicate_returns_match():
    row = MagicMock()
    row.emp_code = "FAC0001"
    row.name = "DR TEST"
    result = MagicMock()
    result.fetchone.return_value = row
    db = AsyncMock()
    db.execute.return_value = result

    match = await find_duplicate_employee(db, field="pan", value="ABCDE1234F")
    assert match == ("FAC0001", "DR TEST")
    sql = str(db.execute.call_args[0][0])
    assert "pan = :val" in sql


@pytest.mark.asyncio
async def test_find_duplicate_email_case_insensitive():
    row = MagicMock()
    row.emp_code = "NUR0002"
    row.name = "NURSE ONE"
    result = MagicMock()
    result.fetchone.return_value = row
    db = AsyncMock()
    db.execute.return_value = result

    match = await find_duplicate_employee(db, field="email", value="User@AIIMS.edu")
    assert match == ("NUR0002", "NURSE ONE")
    params = db.execute.call_args[0][1]
    assert params["val"] == "user@aiims.edu"


@pytest.mark.asyncio
async def test_assert_fields_unique_raises():
    row = MagicMock()
    row.emp_code = "FAC0003"
    row.name = "EXISTING"
    result = MagicMock()
    result.fetchone.return_value = row
    db = AsyncMock()
    db.execute.return_value = result

    with pytest.raises(ValueError, match="PAN already registered to FAC0003"):
        await assert_employee_fields_unique(db, {"pan": "ABCDE1234F"})


@pytest.mark.asyncio
async def test_assert_fields_unique_skips_unknown_keys():
    db = AsyncMock()
    await assert_employee_fields_unique(db, {"unknown_field": "x"})
    db.execute.assert_not_called()
