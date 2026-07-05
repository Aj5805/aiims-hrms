"""Nodal offices — administrative units for category-based leave routing."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db

router = APIRouter(prefix="/nodal-offices", tags=["nodal-offices"])

_ADMIN_ROLES = ("ADMIN",)
_VALID_SCHEMES = ("CCS", "RESIDENCY")


async def _user_id_for_employee(db: AsyncSession, employee_id: str) -> tuple[str, str]:
    result = await db.execute(
        text("""
            SELECT u.id, u.role
            FROM users u
            JOIN employees e ON e.id = u.employee_id
            WHERE e.id = :eid AND e.is_active = true AND u.is_active = true
        """),
        {"eid": employee_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(
            status_code=400,
            detail="Employee not found or has no active login — onboard the staff member first",
        )
    return str(row.id), row.role


def _officer_candidate_row(r) -> dict:
    return {
        "id": str(r.id),
        "username": r.username,
        "role": r.role,
        "employee_name": getattr(r, "employee_name", None),
        "emp_code": getattr(r, "emp_code", None),
        "assigned_office_code": getattr(r, "assigned_office_code", None),
        "is_standalone": r.employee_id is None,
    }


def _office_row(r) -> dict:
    return {
        "id": str(r.id),
        "code": r.code,
        "name": r.name,
        "leave_scheme": r.leave_scheme,
        "officer_user_id": str(r.officer_user_id) if r.officer_user_id else None,
        "officer_username": getattr(r, "officer_username", None),
        "officer_employee_id": str(r.officer_employee_id) if getattr(r, "officer_employee_id", None) else None,
        "officer_employee_name": getattr(r, "officer_employee_name", None),
        "is_active": bool(r.is_active),
        "clerical_count": int(getattr(r, "clerical_count", 0) or 0),
    }


@router.get("")
async def list_nodal_offices(
    include_inactive: bool = False,
    _: dict = Depends(require_role(*_ADMIN_ROLES, "NODAL_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    inactive_clause = "" if include_inactive else " AND no.is_active = true"
    result = await db.execute(
        text(f"""
            SELECT no.id, no.code, no.name, no.leave_scheme, no.officer_user_id, no.is_active,
                   u.username AS officer_username,
                   e.id AS officer_employee_id,
                   e.name AS officer_employee_name,
                   (SELECT COUNT(*) FROM users cu
                    WHERE cu.role = 'NODAL_OFFICE' AND cu.is_active = true
                      AND (cu.nodal_office_id = no.id OR cu.parent_nodal_user_id = no.officer_user_id)
                   ) AS clerical_count
            FROM nodal_offices no
            LEFT JOIN users u ON u.id = no.officer_user_id
            LEFT JOIN employees e ON e.id = u.employee_id
            WHERE 1=1{inactive_clause}
            ORDER BY no.code
        """)
    )
    return [_office_row(r) for r in result.fetchall()]


@router.post("", status_code=201)
async def create_nodal_office(
    body: dict,
    _: dict = Depends(require_role(*_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    code = (body.get("code") or "").strip().upper()
    name = (body.get("name") or "").strip()
    leave_scheme = (body.get("leave_scheme") or "").strip().upper()
    if not code or not name:
        raise HTTPException(status_code=400, detail="code and name are required")
    if leave_scheme not in _VALID_SCHEMES:
        raise HTTPException(status_code=400, detail=f"leave_scheme must be one of {_VALID_SCHEMES}")

    oid = str(uuid.uuid4())
    try:
        await db.execute(
            text("""
                INSERT INTO nodal_offices (id, code, name, leave_scheme, is_active)
                VALUES (:id, :code, :name, :scheme, true)
            """),
            {"id": oid, "code": code, "name": name, "scheme": leave_scheme},
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Nodal office code '{code}' already exists")

    return {"id": oid, "message": "Nodal office created"}


@router.put("/{office_id}")
async def update_nodal_office(
    office_id: str,
    body: dict,
    _: dict = Depends(require_role(*_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    office = await db.execute(
        text("SELECT id, leave_scheme FROM nodal_offices WHERE id = :id"),
        {"id": office_id},
    )
    row = office.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Nodal office not found")

    updates: dict = {}
    if "name" in body and body["name"] is not None:
        updates["name"] = str(body["name"]).strip()
    if "is_active" in body and body["is_active"] is not None:
        updates["is_active"] = bool(body["is_active"])
    if "officer_user_id" in body or "officer_employee_id" in body:
        officer_id = body.get("officer_user_id")
        if body.get("officer_employee_id"):
            emp_user_id, emp_role = await _user_id_for_employee(db, body["officer_employee_id"])
            officer_id = emp_user_id
            if emp_role != "NODAL_OFFICER":
                await db.execute(
                    text("UPDATE users SET role = 'NODAL_OFFICER' WHERE id = :uid"),
                    {"uid": officer_id},
                )
        elif officer_id:
            user_row = await db.execute(
                text("SELECT role FROM users WHERE id = :uid AND is_active = true"),
                {"uid": officer_id},
            )
            u = user_row.fetchone()
            if not u:
                raise HTTPException(status_code=400, detail="Officer user not found or inactive")
            if u.role != "NODAL_OFFICER":
                await db.execute(
                    text("UPDATE users SET role = 'NODAL_OFFICER' WHERE id = :uid"),
                    {"uid": officer_id},
                )
        if officer_id:
            await db.execute(
                text("UPDATE nodal_offices SET officer_user_id = NULL WHERE officer_user_id = :uid AND id != :oid"),
                {"uid": officer_id, "oid": office_id},
            )
            await db.execute(
                text("UPDATE users SET nodal_office_id = :oid WHERE id = :uid"),
                {"oid": office_id, "uid": officer_id},
            )
        updates["officer_user_id"] = officer_id

    if "leave_scheme" in body and body["leave_scheme"]:
        scheme = str(body["leave_scheme"]).strip().upper()
        if scheme not in _VALID_SCHEMES:
            raise HTTPException(status_code=400, detail=f"leave_scheme must be one of {_VALID_SCHEMES}")
        updates["leave_scheme"] = scheme

    if updates:
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        updates["oid"] = office_id
        await db.execute(text(f"UPDATE nodal_offices SET {set_clause} WHERE id = :oid"), updates)
        await db.commit()

    result = await db.execute(
        text("""
            SELECT no.id, no.code, no.name, no.leave_scheme, no.officer_user_id, no.is_active,
                   u.username AS officer_username,
                   e.id AS officer_employee_id,
                   e.name AS officer_employee_name,
                   0 AS clerical_count
            FROM nodal_offices no
            LEFT JOIN users u ON u.id = no.officer_user_id
            LEFT JOIN employees e ON e.id = u.employee_id
            WHERE no.id = :id
        """),
        {"id": office_id},
    )
    r = result.fetchone()
    return _office_row(r)


@router.get("/eligible-staff")
async def list_eligible_nodal_staff(
    _: dict = Depends(require_role(*_ADMIN_ROLES, "NODAL_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    """Active employees with login accounts — all staff, for nodal officer assignment."""
    result = await db.execute(
        text("""
            SELECT e.id, e.emp_code, e.name, c.leave_scheme,
                   d.name AS department_name, des.name AS designation_name,
                   u.id AS user_id, u.role AS user_role
            FROM employees e
            JOIN employee_categories c ON e.category_id = c.id
            JOIN departments d ON e.department_id = d.id
            JOIN designations des ON e.designation_id = des.id
            JOIN users u ON u.employee_id = e.id AND u.is_active = true
            WHERE e.is_active = true
              AND u.role IN ('STAFF', 'HOD', 'NODAL_OFFICER')
            ORDER BY e.name
        """),
    )
    return [dict(r._mapping) for r in result.fetchall()]


@router.get("/eligible-officers")
async def list_eligible_officers(
    _: dict = Depends(require_role(*_ADMIN_ROLES, "NODAL_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT u.id, u.username, u.role, u.employee_id, e.name AS employee_name, e.emp_code,
                   no.code AS assigned_office_code
            FROM users u
            LEFT JOIN employees e ON e.id = u.employee_id
            LEFT JOIN nodal_offices no ON no.officer_user_id = u.id AND no.is_active = true
            WHERE u.role = 'NODAL_OFFICER' AND u.is_active = true
            ORDER BY u.role, u.username
        """)
    )
    return [_officer_candidate_row(r) for r in result.fetchall()]


@router.post("/{office_id}/clerical-logins", status_code=201)
async def create_clerical_login(
    office_id: str,
    body: dict,
    _: dict = Depends(require_role(*_ADMIN_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    from app.auth.jwt import hash_password

    office = await db.execute(
        text("SELECT id, officer_user_id FROM nodal_offices WHERE id = :id AND is_active = true"),
        {"id": office_id},
    )
    o = office.fetchone()
    if not o:
        raise HTTPException(status_code=404, detail="Nodal office not found")
    if not o.officer_user_id:
        raise HTTPException(status_code=400, detail="Assign a nodal officer to this office first")

    username = (body.get("username") or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    password = body.get("password") or username

    uid = str(uuid.uuid4())
    try:
        await db.execute(
            text("""
                INSERT INTO users (id, username, password_hash, role, is_active, must_change_password,
                                   parent_nodal_user_id, nodal_office_id)
                VALUES (:id, :username, :ph, 'NODAL_OFFICE', true, true, :parent, :office_id)
            """),
            {
                "id": uid,
                "username": username,
                "ph": hash_password(password),
                "parent": str(o.officer_user_id),
                "office_id": office_id,
            },
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Username already exists")

    return {"id": uid, "message": "Clerical login created"}


@router.get("/{office_id}/clerical-logins")
async def list_clerical_logins(
    office_id: str,
    _: dict = Depends(require_role(*_ADMIN_ROLES, "NODAL_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT u.id, u.username, u.is_active, u.last_login,
                   pn.username AS parent_nodal_username
            FROM users u
            LEFT JOIN users pn ON pn.id = u.parent_nodal_user_id
            WHERE u.role = 'NODAL_OFFICE'
              AND (u.nodal_office_id = :oid
                   OR u.parent_nodal_user_id IN (SELECT officer_user_id FROM nodal_offices WHERE id = :oid))
            ORDER BY u.username
        """),
        {"oid": office_id},
    )
    return [dict(r._mapping) for r in result.fetchall()]
