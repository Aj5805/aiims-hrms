"""Employee CRUD + CSV import routes."""

import csv
import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import hash_password
from app.auth.dependencies import get_current_user, require_role, employee_scope
from app.core.database import get_db
from app.core.upload_validation import validate_import_upload
from sqlalchemy.exc import IntegrityError
from app.schemas import (
    CsvImportResult,
    CsvImportRow,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    StaffGroupInfo,
    StaffGroupSuggestion,
    StaffNumberPreview,
)
from app.services.leave_balance_bootstrap import bootstrap_leave_balances
from app.services.leave_rules import fetch_eligible_leave_types
from app.services.staff_number import (
    StaffNumberError,
    allocate_staff_number,
    preview_next_staff_number,
    resolve_staff_group,
    validate_staff_group,
)
from app.data.staff_number_groups import STAFF_NUMBER_GROUPS

router = APIRouter(prefix="/employees", tags=["employees"])

_VIEWER_ROLES = ("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "HOD", "DEAN_ACADEMIC", "NODAL_OFFICER", "NODAL_OFFICE")
_EDITOR_ROLES = ("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "NODAL_OFFICER")
_NODAL_SCOPED_ROLES = ("NODAL_OFFICER", "NODAL_OFFICE")

_EMPLOYEE_SELECT = """
    SELECT e.id, e.emp_code, e.name, e.gender, e.dob, e.doj, e.email,
           e.has_institutional_email, e.personal_email, e.is_active,
           e.initial, e.address, e.permanent_address, e.marital_status,
           e.father_name, e.blood_group, e.photo, e.mobile, e.alt_mobile,
           e.last_qualification, e.doj_actual, e.dol_last_working,
           e.next_increment_date, e.staff_group, e.is_physically_handicapped,
           e.type_of_flat, e.caste_category, e.religion,
           e.bank_account_no, e.bank_name, e.ifsc_code,
           e.pan, e.aadhaar, e.nps_or_gpf_no, e.pfms_code, e.grade, e.pay_level,
           c.code AS category_code, c.name AS category_name,
           d.code AS department_code, d.name AS department_name,
           des.name AS designation_name, u.id AS user_id
    FROM employees e
    JOIN employee_categories c ON e.category_id = c.id
    JOIN departments d ON e.department_id = d.id
    JOIN designations des ON e.designation_id = des.id
    LEFT JOIN users u ON u.employee_id = e.id
"""


def _row_to_response(r) -> EmployeeResponse:
    return EmployeeResponse(
        id=str(r.id), emp_code=r.emp_code, name=r.name, gender=r.gender,
        dob=r.dob, doj=r.doj,
        category_code=r.category_code, category_name=r.category_name,
        department_code=r.department_code, department_name=r.department_name,
        designation_name=r.designation_name,
        email=r.email, has_institutional_email=r.has_institutional_email,
        personal_email=r.personal_email,
        is_active=r.is_active, user_id=str(r.user_id) if r.user_id else None,
        initial=r.initial, address=r.address, permanent_address=r.permanent_address,
        marital_status=r.marital_status, father_name=r.father_name,
        blood_group=r.blood_group, photo=r.photo, mobile=r.mobile,
        alt_mobile=r.alt_mobile, last_qualification=r.last_qualification,
        doj_actual=r.doj_actual, dol_last_working=r.dol_last_working,
        next_increment_date=r.next_increment_date, staff_group=r.staff_group,
        is_physically_handicapped=bool(r.is_physically_handicapped),
        type_of_flat=r.type_of_flat, caste_category=r.caste_category,
        religion=r.religion, bank_account_no=r.bank_account_no,
        bank_name=r.bank_name, ifsc_code=r.ifsc_code, pan=r.pan,
        aadhaar=r.aadhaar, nps_or_gpf_no=r.nps_or_gpf_no, pfms_code=r.pfms_code,
        grade=r.grade, pay_level=r.pay_level,
    )


async def _check_nodal_dept_access(db: AsyncSession, user_id: str, department_id) -> None:
    nodal_check = await db.execute(
        text(
            "SELECT 1 FROM dept_nodal_assignments "
            "WHERE nodal_user_id = :uid AND department_id = :did AND is_active = true"
        ),
        {"uid": user_id, "did": department_id},
    )
    if not nodal_check.fetchone():
        raise HTTPException(status_code=403, detail="Not authorized for this department")


async def _fetch_employee(db: AsyncSession, employee_id: str) -> EmployeeResponse:
    result = await db.execute(
        text(_EMPLOYEE_SELECT + " WHERE e.id = :eid"),
        {"eid": employee_id},
    )
    r = result.fetchone()
    if not r:
        raise HTTPException(status_code=404, detail="Employee not found")
    return _row_to_response(r)


@router.get("", response_model=list[EmployeeResponse])
async def list_employees(
    search: str = Query("", max_length=100),
    category_code: str = Query(None),
    department_code: str = Query(None),
    designation_name: str = Query(None),
    is_active: bool = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _: dict = Depends(require_role(*_VIEWER_ROLES)),
    scope: dict = Depends(employee_scope),
    db: AsyncSession = Depends(get_db),
):
    query = _EMPLOYEE_SELECT + " WHERE 1=1"
    params: dict = {}

    if scope["scope"] != "all":
        if not scope["employee_ids"]:
            return []
        query += " AND e.id = ANY(:allowed_ids)"
        params["allowed_ids"] = scope["employee_ids"]

    if search:
        query += " AND (e.name ILIKE :search OR e.emp_code ILIKE :search)"
        params["search"] = f"%{search}%"
    if category_code:
        query += " AND c.code = :cat"
        params["cat"] = category_code
    if department_code:
        query += " AND d.code = :dept"
        params["dept"] = department_code
    if designation_name:
        query += " AND des.name = :desg"
        params["desg"] = designation_name
    if is_active is not None:
        query += " AND e.is_active = :active"
        params["active"] = is_active
    query += " ORDER BY e.name LIMIT :lim OFFSET :skip"
    params["lim"] = limit
    params["skip"] = skip

    result = await db.execute(text(query), params)
    rows = result.fetchall()
    return [_row_to_response(r) for r in rows]


@router.get("/staff-groups", response_model=list[StaffGroupInfo])
async def list_staff_groups(
    _: dict = Depends(require_role(*_EDITOR_ROLES)),
):
    return [
        StaffGroupInfo(code=code, label=spec["label"])
        for code, spec in STAFF_NUMBER_GROUPS.items()
    ]


@router.get("/suggest-staff-group", response_model=StaffGroupSuggestion)
async def suggest_staff_group(
    designation_name: str = Query(..., min_length=1),
    department_code: str = Query(..., min_length=1),
    category_code: str | None = Query(None),
    _: dict = Depends(require_role(*_EDITOR_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    if not category_code:
        des = await db.execute(
            text(
                """
                SELECT c.code FROM designations d
                JOIN employee_categories c ON d.category_id = c.id
                WHERE d.name = :n
                """
            ),
            {"n": designation_name},
        )
        row = des.fetchone()
        category_code = row[0] if row else None

    suggested = resolve_staff_group(
        designation_name=designation_name,
        category_code=category_code,
        department_code=department_code,
    )
    if not suggested:
        return StaffGroupSuggestion(staff_group=None, label=None)
    spec = STAFF_NUMBER_GROUPS.get(suggested)
    return StaffGroupSuggestion(staff_group=suggested, label=spec["label"] if spec else None)


@router.get("/next-staff-number", response_model=StaffNumberPreview)
async def next_staff_number(
    staff_group: str | None = Query(None),
    _: dict = Depends(require_role(*_EDITOR_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    try:
        next_code = await preview_next_staff_number(db, staff_group)
    except StaffNumberError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return StaffNumberPreview(next_emp_code=next_code)


def _assert_employee_access(scope: dict, employee_id: str, own_emp_id: str | None) -> None:
    if scope["scope"] != "all" and employee_id != own_emp_id and employee_id not in (scope["employee_ids"] or []):
        raise HTTPException(status_code=403, detail="Not authorized to view this employee")


@router.get("/{employee_id}/eligible-leave-types")
async def eligible_leave_types(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
    scope: dict = Depends(employee_scope),
    db: AsyncSession = Depends(get_db),
):
    """Leave types this employee may apply for (category entitlement matrix + scheme)."""
    user_res = await db.execute(
        text("SELECT employee_id FROM users WHERE id = :uid"),
        {"uid": current_user["user_id"]},
    )
    user_row = user_res.fetchone()
    own_emp_id = str(user_row[0]) if user_row and user_row[0] else None
    _assert_employee_access(scope, employee_id, own_emp_id)

    exists = await db.execute(text("SELECT 1 FROM employees WHERE id = :eid"), {"eid": employee_id})
    if not exists.fetchone():
        raise HTTPException(status_code=404, detail="Employee not found")

    return await fetch_eligible_leave_types(db, employee_id)


@router.post("/{employee_id}/bootstrap-leave-balances")
async def bootstrap_employee_leave_balances(
    employee_id: str,
    current_user: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    """Create missing balance rows for an existing employee (backfill / manual run)."""
    row = await db.execute(text("SELECT doj FROM employees WHERE id = :eid"), {"eid": employee_id})
    emp = row.fetchone()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    result = await bootstrap_leave_balances(
        db,
        employee_id,
        emp[0],
        actor_id=current_user["user_id"],
        impersonated_by=current_user.get("impersonated_by"),
    )
    await db.commit()
    return result


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
    scope: dict = Depends(employee_scope),
    db: AsyncSession = Depends(get_db),
):
    user_res = await db.execute(
        text("SELECT employee_id FROM users WHERE id = :uid"),
        {"uid": current_user["user_id"]}
    )
    user_row = user_res.fetchone()
    own_emp_id = str(user_row[0]) if user_row and user_row[0] else None

    _assert_employee_access(scope, employee_id, own_emp_id)
    return await _fetch_employee(db, employee_id)


@router.post("", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    body: EmployeeCreate,
    current_user: dict = Depends(get_current_user),
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
    
    if current_user["role"] in _NODAL_SCOPED_ROLES:
        await _check_nodal_dept_access(db, current_user["user_id"], dept_row[0])

    des = await db.execute(
        text("SELECT id, grade_pay_level FROM designations WHERE name = :n"),
        {"n": body.designation_name},
    )
    des_row = des.fetchone()
    if not des_row:
        raise HTTPException(status_code=400, detail=f"Unknown designation: {body.designation_name}")

    try:
        staff_group = validate_staff_group(body.staff_group)
    except StaffNumberError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    emp_code = (body.emp_code or "").strip()
    if not emp_code:
        try:
            emp_code = await allocate_staff_number(db, staff_group)
        except StaffNumberError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    pay_level = body.pay_level

    eid = str(uuid.uuid4())
    try:
        await db.execute(
            text("""
                INSERT INTO employees
                    (id, emp_code, name, gender, dob, doj, category_id, department_id,
                     designation_id, email, has_institutional_email, personal_email,
                     initial, address, permanent_address, marital_status, father_name,
                     blood_group, photo, mobile, alt_mobile, last_qualification,
                     doj_actual, dol_last_working, next_increment_date, staff_group,
                     is_physically_handicapped, type_of_flat, caste_category, religion,
                     bank_account_no, bank_name, ifsc_code, pan, aadhaar,
                     nps_or_gpf_no, pfms_code, grade, pay_level)
                VALUES
                    (:id, :ec, :nm, :g, :dob, :doj, :cat, :dept, :des, :em, :hie, :pe,
                     :initial, :address, :perm_addr, :marital, :father, :blood, :photo,
                     :mobile, :alt_mobile, :qual, :doj_act, :dol, :incr, :staff_grp,
                     :ph, :flat, :caste, :religion, :bank_acct, :bank_name, :ifsc,
                     :pan, :aadhaar, :nps, :pfms, :grade, :pay_level)
            """),
            {
                "id": eid, "ec": emp_code, "nm": body.name, "g": body.gender,
                "dob": body.dob, "doj": body.doj,
                "cat": str(cat_row[0]), "dept": str(dept_row[0]), "des": str(des_row[0]),
                "em": body.email, "hie": body.has_institutional_email, "pe": body.personal_email,
                "initial": body.initial, "address": body.address,
                "perm_addr": body.permanent_address, "marital": body.marital_status,
                "father": body.father_name, "blood": body.blood_group, "photo": body.photo,
                "mobile": body.mobile, "alt_mobile": body.alt_mobile,
                "qual": body.last_qualification, "doj_act": body.doj_actual,
                "dol": body.dol_last_working, "incr": body.next_increment_date,
                "staff_grp": staff_group, "ph": body.is_physically_handicapped,
                "flat": body.type_of_flat, "caste": body.caste_category,
                "religion": body.religion, "bank_acct": body.bank_account_no,
                "bank_name": body.bank_name, "ifsc": body.ifsc_code,
                "pan": body.pan, "aadhaar": body.aadhaar, "nps": body.nps_or_gpf_no,
                "pfms": body.pfms_code, "grade": body.grade, "pay_level": pay_level,
            },
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Employee with emp_code '{emp_code}' already exists")

    existing_user = await db.execute(
        text("SELECT id FROM users WHERE username = :un OR employee_id = :eid"),
        {"un": emp_code, "eid": eid},
    )
    if not existing_user.fetchone():
        await db.execute(
            text("""
                INSERT INTO users (id, username, password_hash, employee_id, role, is_active, must_change_password)
                VALUES (uuid_generate_v4(), :un, :ph, :eid, 'STAFF', true, false)
            """),
            {"un": emp_code, "ph": hash_password(emp_code), "eid": eid},
        )

    await bootstrap_leave_balances(
        db,
        eid,
        body.doj,
        actor_id=current_user["user_id"],
        impersonated_by=current_user.get("impersonated_by"),
    )

    await db.commit()
    return await _fetch_employee(db, eid)


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    body: EmployeeUpdate,
    current_user: dict = Depends(get_current_user),
    scope: dict = Depends(employee_scope),
    _: dict = Depends(require_role(*_EDITOR_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    if scope["scope"] != "all" and employee_id not in (scope["employee_ids"] or []):
        raise HTTPException(status_code=403, detail="Not authorized to modify this employee")
    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.department_code is not None:
        dept = await db.execute(text("SELECT id FROM departments WHERE code = :c"), {"c": body.department_code})
        dept_row = dept.fetchone()
        if not dept_row:
            raise HTTPException(status_code=400, detail=f"Unknown department: {body.department_code}")
        
        if current_user["role"] in _NODAL_SCOPED_ROLES:
            await _check_nodal_dept_access(db, current_user["user_id"], dept_row[0])
                
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


@router.post("/{employee_id}/lifecycle")
async def employee_lifecycle(
    employee_id: str,
    body: dict,
    current_user: dict = Depends(require_role(*_EDITOR_ROLES, "ADMIN")),
    scope: dict = Depends(employee_scope),
    db: AsyncSession = Depends(get_db),
):
    """Resign, rejoin, promote, or demote an employee."""
    action = body.get("action")
    if action not in ("resign", "rejoin", "promote", "demote", "assign_hod"):
        raise HTTPException(status_code=400, detail="action must be resign, rejoin, promote, demote, or assign_hod")

    if scope["scope"] != "all" and employee_id not in (scope["employee_ids"] or []):
        raise HTTPException(status_code=403, detail="Not authorized for this employee")

    emp = await db.execute(
        text("SELECT e.id, u.id AS user_id FROM employees e LEFT JOIN users u ON u.employee_id = e.id WHERE e.id = :eid"),
        {"eid": employee_id},
    )
    row = emp.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Employee not found")

    user_id = str(row.user_id) if row.user_id else None

    if action == "resign":
        dol = body.get("dol_last_working")
        await db.execute(
            text("UPDATE employees SET is_active = false, dol_last_working = COALESCE(CAST(:dol AS date), CURRENT_DATE) WHERE id = :eid"),
            {"eid": employee_id, "dol": dol},
        )
        if user_id:
            await db.execute(text("UPDATE users SET is_active = false WHERE id = :uid"), {"uid": user_id})
    elif action == "rejoin":
        await db.execute(
            text("UPDATE employees SET is_active = true, dol_last_working = NULL WHERE id = :eid"),
            {"eid": employee_id},
        )
        if user_id:
            await db.execute(text("UPDATE users SET is_active = true WHERE id = :uid"), {"uid": user_id})
        doj_row = await db.execute(text("SELECT doj FROM employees WHERE id = :eid"), {"eid": employee_id})
        doj_val = doj_row.fetchone()
        if doj_val:
            await bootstrap_leave_balances(
                db,
                employee_id,
                doj_val[0],
                actor_id=current_user["user_id"],
                impersonated_by=current_user.get("impersonated_by"),
            )
    elif action in ("promote", "demote"):
        new_desg = body.get("designation_name")
        if not new_desg:
            raise HTTPException(status_code=400, detail="designation_name required for promote/demote")
        des = await db.execute(
            text(
                """
                SELECT des.id, c.code AS category_code, d.code AS department_code
                FROM designations des
                JOIN employee_categories c ON des.category_id = c.id
                JOIN employees e ON e.id = :eid
                JOIN departments d ON e.department_id = d.id
                WHERE des.name = :n
                """
            ),
            {"n": new_desg, "eid": employee_id},
        )
        des_row = des.fetchone()
        if not des_row:
            raise HTTPException(status_code=400, detail=f"Unknown designation: {new_desg}")
        updates: dict = {"desg_id": str(des_row.id), "eid": employee_id}
        set_parts = ["designation_id = :desg_id"]
        dept_code = body.get("department_code") or des_row.department_code
        if body.get("department_code"):
            dept = await db.execute(text("SELECT id FROM departments WHERE code = :c"), {"c": body["department_code"]})
            dept_row = dept.fetchone()
            if not dept_row:
                raise HTTPException(status_code=400, detail="Unknown department")
            updates["dept_id"] = str(dept_row[0])
            set_parts.append("department_id = :dept_id")
            dept_code = body["department_code"]
        new_group = resolve_staff_group(
            designation_name=new_desg,
            category_code=des_row.category_code,
            department_code=dept_code,
        )
        if new_group:
            updates["staff_group"] = new_group
            set_parts.append("staff_group = :staff_group")
        if body.get("pay_level"):
            updates["pay_level"] = body["pay_level"]
            set_parts.append("pay_level = :pay_level")
        await db.execute(text(f"UPDATE employees SET {', '.join(set_parts)} WHERE id = :eid"), updates)
        doj_row = await db.execute(text("SELECT doj FROM employees WHERE id = :eid"), {"eid": employee_id})
        doj_val = doj_row.fetchone()
        if doj_val:
            await bootstrap_leave_balances(
                db,
                employee_id,
                doj_val[0],
                actor_id=current_user["user_id"],
                impersonated_by=current_user.get("impersonated_by"),
            )
    elif action == "assign_hod":
        if not user_id:
            raise HTTPException(status_code=400, detail="Employee has no login account — create user first")
        await db.execute(text("UPDATE users SET role = 'HOD' WHERE id = :uid"), {"uid": user_id})

    reporting_officer_id = body.get("reporting_officer_id")
    if reporting_officer_id:
        await db.execute(
            text("UPDATE employees SET reporting_officer_id = :roid WHERE id = :eid"),
            {"roid": reporting_officer_id, "eid": employee_id},
        )

    await db.commit()
    return {"message": f"Employee {action} completed", "employee_id": employee_id}


@router.post("/import", response_model=CsvImportResult)
async def import_csv(
    file: UploadFile,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_role(*_EDITOR_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] in _NODAL_SCOPED_ROLES:
        raise HTTPException(status_code=403, detail="Bulk import is not available for nodal users")
        
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
                                VALUES (uuid_generate_v4(), :un, :ph, :eid, 'STAFF', true, false)
                            """),
                            {"un": emp_code, "ph": hash_password(emp_code), "eid": eid},
                        )

                    await bootstrap_leave_balances(
                        db,
                        eid,
                        date.fromisoformat(doj_str),
                        actor_id=current_user["user_id"],
                        impersonated_by=current_user.get("impersonated_by"),
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
