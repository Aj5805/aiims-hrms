"""Cross-employee uniqueness checks for staff master identifiers."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# field key -> (label, db columns to match)
_UNIQUE_CHECKS: dict[str, tuple[str, tuple[str, ...]]] = {
    "pan": ("PAN", ("pan",)),
    "aadhaar": ("Aadhaar", ("aadhaar",)),
    "nps_or_gpf_no": ("NPS number", ("nps_or_gpf_no",)),
    "pfms_code": ("PFMS code", ("pfms_code",)),
    "bank_account_no": ("Bank account", ("bank_account_no",)),
    "mobile": ("Mobile", ("mobile", "alt_mobile")),
    "alt_mobile": ("Alt mobile", ("mobile", "alt_mobile")),
    "email": ("Email", ("email", "personal_email")),
    "personal_email": ("Alt email", ("email", "personal_email")),
}


def _column_match(col: str, *, case_insensitive: bool) -> str:
    if case_insensitive:
        return f"(LOWER({col}) = :val AND {col} IS NOT NULL AND TRIM({col}) <> '')"
    return f"({col} = :val AND {col} IS NOT NULL AND TRIM({col}) <> '')"


async def find_duplicate_employee(
    db: AsyncSession,
    *,
    field: str,
    value: str | None,
    exclude_employee_id: str | None = None,
) -> tuple[str, str] | None:
    """Return (emp_code, name) if value is already used by another employee."""
    if not value or not str(value).strip():
        return None

    spec = _UNIQUE_CHECKS.get(field)
    if not spec:
        return None

    _label, columns = spec
    val = str(value).strip()
    case_insensitive = field in ("email", "personal_email")
    if case_insensitive:
        val = val.lower()

    conditions = [_column_match(col, case_insensitive=case_insensitive) for col in columns]
    where = f"({' OR '.join(conditions)})"
    params: dict = {"val": val}
    if exclude_employee_id:
        where += " AND id <> :exclude_id"
        params["exclude_id"] = exclude_employee_id

    result = await db.execute(
        text(f"SELECT emp_code, name FROM employees WHERE {where} LIMIT 1"),
        params,
    )
    row = result.fetchone()
    if not row:
        return None
    return str(row.emp_code), str(row.name)


async def assert_employee_fields_unique(
    db: AsyncSession,
    values: dict[str, str | None],
    *,
    exclude_employee_id: str | None = None,
) -> None:
    """Raise ValueError with a plain-language message if any identifier is duplicated."""
    for field in _UNIQUE_CHECKS:
        if field not in values:
            continue
        duplicate = await find_duplicate_employee(
            db,
            field=field,
            value=values.get(field),
            exclude_employee_id=exclude_employee_id,
        )
        if duplicate:
            emp_code, name = duplicate
            label = _UNIQUE_CHECKS[field][0]
            raise ValueError(f"{label} already registered to {emp_code} ({name})")
