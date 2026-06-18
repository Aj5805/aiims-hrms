"""Employee CRUD + CSV import routes."""

import csv
import io
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import hash_password
from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.core.upload_validation import validate_import_upload
from sqlalchemy.exc import IntegrityError
from app.schemas import (
    CsvImportResult,
    CsvImportRow,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
)

router = APIRouter(prefix="/employees", tags=["employees"])

_VIEWER_ROLES = ("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "HOD", "DEAN_ACADEMIC")
_EDITOR_ROLES = ("ADMIN", "ESTABLISHMENT_OFFICER")


async def _fetch_employee(db: AsyncSession, employee_id: str) -> EmployeeResponse:
    result = await db.execute(
        text("""
            SELECT e.id, e.emp_code, e.name, e.gender, e.dob, e.doj, e.email,
                   e.has_institutional_email, e.is_active,
                   c.code AS category_code, c.name AS category_name,
                   d.code AS department_code, d.name AS department_name,
                   des.name AS designation_name, u.id AS user_id
            FROM employees e
            JOIN employee_categories c ON e.category_id = c.id
            JOIN departments d ON e.department_id = d.id
            JOIN designations des ON e.designation_id = des.id
            LEFT JOIN users u ON u.employee_id = e.id
            WHERE e.id = :eid
        """),
        {"eid": employee_id},
    )
    r = result.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Employee not found")
    return EmployeeResponse(
        id=str(r.id), emp_code=r.emp_code, name=r.name, gender=r.gender,
        dob=r.dob, doj=r.doj,
        category_code=r.category_code, category_name=r.category_name,
        department_code=r.department_code, department_name=r.department_name,
        designation_name=r.designation_name,
        email=r.email, has_institutional_email=r.has_institutional_email,
        is_active=r.is_active, user_id=str(r.user_id) if r.user_id else None,
    )


@router.get("", response_model=list[EmployeeResponse])
async def list_employees(
    search: str = Query("", max_length=100),
    category_code: str = Query(None),
    department_code: str = Query(None),
    is_active: bool = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _: dict = Depends(require_role(*_VIEWER_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    query = """
        SELECT e.id, e.emp_code, e.name, e.gender, e.dob, e.doj, e.email,
               e.has_institutional_email, e.is_active,
               c.code AS category_code, c.name AS category_name,
               d.code AS department_code, d.name AS department_name,
               des.name AS designation_name, u.id AS user_id
        FROM employees e
        JOIN employee_categories c ON e.category_id = c.id
        JOIN departments d ON e.department_id = d.id
        JOIN designations des ON e.designation_id = des.id
        LEFT JOIN users u ON u.employee_id = e.id
        WHERE 1=1
    """
    params: dict = {}
    if search:
        query += " AND (e.name ILIKE :search OR e.emp_code ILIKE :search)"
        params["search"] = f"%{search}%"
    if category_code:
        query += " AND c.code = :cat"
        params["cat"] = category_code
    if department_code:
        query += " AND d.code = :dept"
        params["dept"] = department_code
    if is_active is not None:
        query += " AND e.is_active = :active"
        params["active"] = is_active
    query += " ORDER BY e.name LIMIT :lim OFFSET :skip"
    params["lim"] = limit
    params["skip"] = skip

    result = await db.execute(text(query), params)
    rows = result.fetchall()
    return [
        EmployeeResponse(
            id=str(r.id), emp_code=r.emp_code, name=r.name, gender=r.gender,
            dob=r.dob, doj=r.doj,
            category_code=r.category_code, category_name=r.category_name,
            department_code=r.department_code, department_name=r.department_name,
            designation_name=r.designation_name,
            email=r.email, has_institutional_email=r.has_institutional_email,
            is_active=r.is_active, user_id=str(r.user_id) if r.user_id else None,
        )
        for r in rows
    ]


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: str,
    _: dict = Depends(require_role(*_VIEWER_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    return await _fetch_employee(db, employee_id)


@router.post("", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    body: EmployeeCreate,
    _: dict = Depends(require_role(*_EDITOR_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    cat = await db.execute(text("SELECT id FROM employee_categories WHERE code = :c"), {"c": body.category_code})
    cat_row = cat.fetchone()
    if not cat_row:
        raise HTTPException(status_code=400, detail=f"Unknown category: {body.category_code}")

    dept = await db.execute(text("SELECT id FROM departments WHERE code = :c"), {"c": body.department_code})
    dept_row = dept.fetchone()
    if not dept_row:
        raise HTTPException(status_code=400, detail=f"Unknown department: {body.department_code}")

    des = await db.execute(text("SELECT id FROM designations WHERE name = :n"), {"n": body.designation_name})
    des_row = des.fetchone()
    if not des_row:
        raise HTTPException(status_code=400, detail=f"Unknown designation: {body.designation_name}")

    eid = str(uuid.uuid4())
    try:
        await db.execute(
            text("""
                INSERT INTO employees
                    (id, emp_code, name, gender, dob, doj, category_id, department_id,
                     designation_id, email, has_institutional_email, personal_email)
                VALUES
                    (:id, :ec, :nm, :g, :dob, :doj, :cat, :dept, :des, :em, :hie, :pe)
            """),
            {
                "id": eid, "ec": body.emp_code, "nm": body.name, "g": body.gender,
                "dob": body.dob, "doj": body.doj,
                "cat": str(cat_row[0]), "dept": str(dept_row[0]), "des": str(des_row[0]),
                "em": body.email, "hie": body.has_institutional_email, "pe": body.personal_email,
            },
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Employee with emp_code '{body.emp_code}' already exists")

    existing_user = await db.execute(
        text("SELECT id FROM users WHERE username = :un OR employee_id = :eid"),
        {"un": body.emp_code, "eid": eid},
    )
    if not existing_user.fetchone():
        await db.execute(
            text("""
                INSERT INTO users (id, username, password_hash, employee_id, role, is_active, must_change_password)
                VALUES (uuid_generate_v4(), :un, :ph, :eid, 'STAFF', true, true)
            """),
            {"un": body.emp_code, "ph": hash_password(body.emp_code), "eid": eid},
        )

    await db.commit()
    return await _fetch_employee(db, eid)


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    body: EmployeeUpdate,
    _: dict = Depends(require_role(*_EDITOR_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.department_code is not None:
        dept = await db.execute(text("SELECT id FROM departments WHERE code = :c"), {"c": body.department_code})
        dept_row = dept.fetchone()
        if not dept_row:
            raise HTTPException(status_code=400, detail=f"Unknown department: {body.department_code}")
        updates["department_id"] = str(dept_row[0])
    if body.designation_name is not None:
        des = await db.execute(text("SELECT id FROM designations WHERE name = :n"), {"n": body.designation_name})
        des_row = des.fetchone()
        if not des_row:
            raise HTTPException(status_code=400, detail=f"Unknown designation: {body.designation_name}")
        updates["designation_id"] = str(des_row[0])
    if body.email is not None:
        updates["email"] = body.email
    if body.is_active is not None:
        updates["is_active"] = body.is_active

    if updates:
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        updates["eid"] = employee_id
        await db.execute(text(f"UPDATE employees SET {set_clause} WHERE id = :eid"), updates)
        await db.commit()
    return await _fetch_employee(db, employee_id)


@router.post("/import", response_model=CsvImportResult)
async def import_csv(
    file: UploadFile,
    _: dict = Depends(require_role(*_EDITOR_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    """Import employees from CSV. Columns: emp_code, name, gender, doj, category, department, designation."""
    await validate_import_upload(
        file,
        allowed_extensions={".csv"},
        allowed_content_types={"text/csv", "application/csv"},
        label="Employee CSV import",
    )
    content = await file.read()
    text_content = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text_content))
    rows = []
    success = 0
    errors = 0

    for i, row in enumerate(reader, start=2):
        emp_code = row.get("emp_code", "").strip()
        try:
            name = row.get("name", "").strip()
            gender = row.get("gender", "MALE").strip()
            doj_str = row.get("doj", "").strip()
            cat_code = row.get("category", "").strip()
            dept_code = row.get("department", "").strip()
            des_name = row.get("designation", "").strip()

            if not all([emp_code, name, doj_str, cat_code, dept_code, des_name]):
                rows.append(CsvImportRow(row_number=i, emp_code=emp_code, status="error", message="Missing required fields"))
                errors += 1
                continue

            cat = await db.execute(text("SELECT id FROM employee_categories WHERE code = :c"), {"c": cat_code})
            if not cat.fetchone():
                rows.append(CsvImportRow(row_number=i, emp_code=emp_code, status="error", message=f"Unknown category: {cat_code}"))
                errors += 1
                continue

            dept = await db.execute(text("SELECT id FROM departments WHERE code = :c"), {"c": dept_code})
            if not dept.fetchone():
                rows.append(CsvImportRow(row_number=i, emp_code=emp_code, status="error", message=f"Unknown department: {dept_code}"))
                errors += 1
                continue

            des = await db.execute(text("SELECT id FROM designations WHERE name = :n"), {"n": des_name})
            if not des.fetchone():
                rows.append(CsvImportRow(row_number=i, emp_code=emp_code, status="error", message=f"Unknown designation: {des_name}"))
                errors += 1
                continue

            try:
                async with db.begin_nested():
                    eid = str(uuid.uuid4())
                    await db.execute(
                        text("""
                            INSERT INTO employees (id, emp_code, name, gender, doj, category_id, department_id, designation_id)
                            VALUES (:id, :ec, :nm, :g, TO_DATE(:doj, 'YYYY-MM-DD'),
                                    (SELECT id FROM employee_categories WHERE code = :cc),
                                    (SELECT id FROM departments WHERE code = :dc),
                                    (SELECT id FROM designations WHERE name = :dn))
                        """),
                        {"id": eid, "ec": emp_code, "nm": name, "g": gender, "doj": doj_str,
                         "cc": cat_code, "dc": dept_code, "dn": des_name},
                    )

                    existing_user = await db.execute(
                        text("SELECT id FROM users WHERE username = :un OR employee_id = :eid"),
                        {"un": emp_code, "eid": eid},
                    )
                    if not existing_user.fetchone():
                        await db.execute(
                            text("""
                                INSERT INTO users (id, username, password_hash, employee_id, role, is_active, must_change_password)
                                VALUES (uuid_generate_v4(), :un, :ph, :eid, 'STAFF', true, true)
                            """),
                            {"un": emp_code, "ph": hash_password(emp_code), "eid": eid},
                        )
            except IntegrityError:
                rows.append(CsvImportRow(row_number=i, emp_code=emp_code, status="error", message="Duplicate emp_code"))
                errors += 1
                continue

            success += 1
            rows.append(CsvImportRow(row_number=i, emp_code=emp_code, status="success"))
        except Exception as e:
            errors += 1
            rows.append(CsvImportRow(row_number=i, emp_code=emp_code or "", status="error", message=str(e)))

    await db.commit()
    return CsvImportResult(total_rows=success + errors, success_count=success, error_count=errors, rows=rows)
