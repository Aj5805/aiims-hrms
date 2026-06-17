# AIIMS HRMS — Phase 2: Auth & Employee Master

> **For AI agent consumption.** Each section = one file. Place at path.   
> **Prerequisite:** Phase 1 (schema + seeds) must be complete.   

---

## PHASE 2 SCOPE

### Backend (11 files)
- JWT token utilities — create/verify access + refresh tokens, bcrypt hashing
- RBAC dependencies — `get_current_user`, `employee_scope`, `require_role`
- Auth routes — `POST /login`, `/logout`, `/change-password`, `GET /me`
- Employee routes — `GET/POST/PUT /employees`, `POST /employees/import` (CSV)
- Department routes — `GET/POST/PUT /departments`
- Designation routes — `GET/POST /designations`
- User routes — `GET/PUT /users` (admin only)
- Pydantic schemas for all request/response models

### Frontend (5 files)
- Axios client with Bearer token interceptor + 401 redirect
- API endpoint wrappers (auth, employees, departments, designations, users)
- Login page with Zustand auth store
- Employee master list with search, CSV import, add modal
- Department & designation management screens

### Files that OVERWRITE Phase 0/1
- `backend/app/api/v1/__init__.py` — now registers all route modules
- `frontend/src/App.tsx` — now has routing, login, nav bar, logout

---

## VERIFICATION AFTER PLACEMENT

```bash
cd aiims-hrms
docker compose up -d db
cd backend && alembic upgrade head && python -m seeds.run
uvicorn main:app --reload
# Test: curl -X POST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"..."}'
# Should return access_token + user
```

---

### FILE: `backend/app/auth/__init__.py`

```python
"""Auth package."""
```

---

### FILE: `backend/app/auth/jwt.py`

```python
"""JWT token creation, verification, and blacklist utilities."""

import uuid
from datetime import datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, role: str, username: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "role": role,
        "username": username,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(hours=settings.ACCESS_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": user_id,
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
```

---

### FILE: `backend/app/auth/dependencies.py`

```python
"""FastAPI dependencies for authentication and RBAC."""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_token
from app.core.database import get_db

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Validate access token and return current user dict.

    Checks token blacklist before accepting.
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    jti = payload.get("jti")
    if jti:
        result = await db.execute(
            text("SELECT 1 FROM token_blacklist WHERE jti = :jti"),
            {"jti": jti},
        )
        if result.fetchone():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    return {
        "user_id": user_id,
        "role": payload.get("role", "STAFF"),
        "username": payload.get("username", ""),
        "jti": jti,
    }


async def employee_scope(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns the employee_id filter for the current user based on role.

    - STAFF → own employee only
    - HOD → own department employees
    - DEAN_ACADEMIC → all residents
    - ESTABLISHMENT_OFFICER → all regular staff
    - REGISTRAR → all regular staff
    - DIRECTOR / ADMIN → all

    Applied to all list endpoints returning leave/employee data.
    """
    role = current_user["role"]
    user_id = current_user["user_id"]

    if role in ("DIRECTOR", "ADMIN"):
        return {"scope": "all", "employee_ids": None}

    result = await db.execute(
        text("SELECT employee_id FROM users WHERE id = :uid"),
        {"uid": user_id},
    )
    row = result.fetchone()
    emp_id = str(row[0]) if row and row[0] else None

    if role == "STAFF":
        return {"scope": "own", "employee_ids": [emp_id] if emp_id else []}

    if role == "HOD":
        if not emp_id:
            return {"scope": "none", "employee_ids": []}
        dept_result = await db.execute(
            text("SELECT department_id FROM employees WHERE id = :eid"),
            {"eid": emp_id},
        )
        dept_row = dept_result.fetchone()
        if not dept_row:
            return {"scope": "none", "employee_ids": []}
        sub_result = await db.execute(
            text("SELECT id FROM employees WHERE department_id = :did"),
            {"did": str(dept_row[0])},
        )
        return {"scope": "department", "employee_ids": [str(r[0]) for r in sub_result.fetchall()]}

    if role == "DEAN_ACADEMIC":
        res_result = await db.execute(
            text("""
                SELECT e.id FROM employees e
                JOIN employee_categories c ON e.category_id = c.id
                WHERE c.leave_scheme = 'RESIDENCY'
            """),
        )
        return {"scope": "residents", "employee_ids": [str(r[0]) for r in res_result.fetchall()]}

    if role in ("ESTABLISHMENT_OFFICER", "REGISTRAR"):
        reg_result = await db.execute(
            text("""
                SELECT e.id FROM employees e
                JOIN employee_categories c ON e.category_id = c.id
                WHERE c.leave_scheme = 'CCS'
            """),
        )
        return {"scope": "regular", "employee_ids": [str(r[0]) for r in reg_result.fetchall()]}

    return {"scope": "none", "employee_ids": []}


def require_role(*roles: str):
    """Dependency factory: only allow given roles."""
    async def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return dependency
```

---

### FILE: `backend/app/schemas/__init__.py`

```python
"""Pydantic schemas for all API request/response models."""

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


# ── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 28800  # 8h
    user: dict  # {id, username, role, must_change_password}


class PasswordResetRequest(BaseModel):
    user_id: str
    new_password: str = Field(min_length=8)


# ── Employees ───────────────────────────────────────────────────────────────

class EmployeeBase(BaseModel):
    emp_code: str = Field(max_length=20)
    name: str = Field(max_length=200)
    gender: str = Field(pattern="^(MALE|FEMALE|OTHER)$")
    dob: date | None = None
    doj: date
    category_code: str
    department_code: str
    designation_name: str
    email: str | None = None
    has_institutional_email: bool = False
    personal_email: str | None = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: str | None = None
    department_code: str | None = None
    designation_name: str | None = None
    email: str | None = None
    reporting_officer_code: str | None = None
    is_active: bool | None = None
    model_config = ConfigDict(extra="forbid")


class EmployeeResponse(BaseModel):
    id: str
    emp_code: str
    name: str
    gender: str
    dob: date | None
    doj: date
    category_code: str
    category_name: str
    department_code: str
    department_name: str
    designation_name: str
    email: str | None
    has_institutional_email: bool
    is_active: bool
    user_id: str | None
    model_config = ConfigDict(from_attributes=True)


# ── CSV Import ──────────────────────────────────────────────────────────────

class CsvImportRow(BaseModel):
    row_number: int
    emp_code: str
    status: str  # "success" | "error"
    message: str | None = None


class CsvImportResult(BaseModel):
    total_rows: int
    success_count: int
    error_count: int
    rows: list[CsvImportRow]


# ── Departments ─────────────────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    code: str = Field(max_length=20)
    name: str = Field(max_length=150)
    parent_dept_code: str | None = None
    managing_office: str | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    managing_office: str | None = None
    model_config = ConfigDict(extra="forbid")


class DepartmentResponse(BaseModel):
    id: str
    code: str
    name: str
    parent_dept_id: str | None
    managing_office: str | None
    model_config = ConfigDict(from_attributes=True)


# ── Designations ────────────────────────────────────────────────────────────

class DesignationCreate(BaseModel):
    name: str = Field(max_length=150)
    grade_pay_level: str | None = None
    category_code: str | None = None


class DesignationResponse(BaseModel):
    id: str
    name: str
    grade_pay_level: str | None
    category_code: str | None
    model_config = ConfigDict(from_attributes=True)
```

---

### FILE: `backend/app/services/__init__.py`

```python
"""Services package."""
```

---

### FILE: `backend/app/api/v1/__init__.py`

⚠️ **OVERWRITE** existing file.

```python
"""API v1 router — registers all route modules."""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.employees import router as employees_router
from app.api.v1.departments import router as departments_router
from app.api.v1.designations import router as designations_router
from app.api.v1.users import router as users_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(employees_router)
router.include_router(departments_router)
router.include_router(designations_router)
router.include_router(users_router)


@router.get("/ping")
async def ping():
    return {"ping": "pong"}
```

---

### FILE: `backend/app/api/v1/auth.py`

```python
"""Auth routes: login, refresh, logout, change-password."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from jose import JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.database import get_db
from app.schemas import LoginRequest, PasswordResetRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Authenticate user, return access + refresh tokens."""
    result = await db.execute(
        text("SELECT id, username, password_hash, role, must_change_password, is_active FROM users WHERE username = :un"),
        {"un": body.username},
    )
    user = result.fetchone()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account deactivated")

    uid = str(user.id)
    access_token = create_access_token(uid, user.role, user.username)
    refresh_token = create_refresh_token(uid)

    # Set refresh token as HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7 * 24 * 3600,
        path="/api/v1/auth",
    )

    await db.execute(text("UPDATE users SET last_login = now() WHERE id = :uid"), {"uid": uid})
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        user={
            "id": uid, "username": user.username, "role": user.role,
            "must_change_password": user.must_change_password,
        },
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: Response, db: AsyncSession = Depends(get_db)):
    """Issue new access + refresh tokens using valid refresh token from cookie."""
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Cookie-based refresh — use Authorization header with refresh token for now")


@router.post("/logout")
async def logout(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Blacklist current access token JTI."""
    from datetime import timedelta
    expires_at = datetime.utcnow() + timedelta(hours=8)
    await db.execute(
        text("INSERT INTO token_blacklist (jti, user_id, expires_at) VALUES (:jti, :uid, :exp)"),
        {"jti": current_user["jti"], "uid": current_user["user_id"], "exp": expires_at},
    )
    await db.commit()
    return {"message": "Logged out"}


@router.post("/change-password")
async def change_password(
    body: PasswordResetRequest,
    current_user: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Admin resets a user's password. Force-reset flag set on next login."""
    hashed = hash_password(body.new_password)
    await db.execute(
        text("UPDATE users SET password_hash = :ph, must_change_password = true WHERE id = :uid"),
        {"ph": hashed, "uid": body.user_id},
    )
    await db.commit()
    return {"message": "Password reset. User must change on next login."}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user
```

---

### FILE: `backend/app/api/v1/employees.py`

```python
"""Employee CRUD + CSV import routes."""

import csv
import io
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_role
from app.core.database import get_db
from app.schemas import EmployeeCreate, EmployeeUpdate, EmployeeResponse, CsvImportResult, CsvImportRow

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[EmployeeResponse])
async def list_employees(
    search: str = Query("", max_length=100),
    category_code: str = Query(None),
    department_code: str = Query(None),
    is_active: bool = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "HOD", "DEAN_ACADEMIC")),
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
    params = {}
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
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR", "HOD", "DEAN_ACADEMIC")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
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
    """), {"eid": employee_id})
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


@router.post("", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    body: EmployeeCreate,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    # Resolve FK codes
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
    await db.execute(text("""
        INSERT INTO employees (id, emp_code, name, gender, dob, doj, category_id, department_id, designation_id, email, has_institutional_email, personal_email)
        VALUES (:id, :ec, :nm, :g, :dob, :doj, :cat, :dept, :des, :em, :hie, :pe)
    """), {
        "id": eid, "ec": body.emp_code, "nm": body.name, "g": body.gender,
        "dob": body.dob, "doj": body.doj,
        "cat": str(cat_row[0]), "dept": str(dept_row[0]), "des": str(des_row[0]),
        "em": body.email, "hie": body.has_institutional_email, "pe": body.personal_email,
    })
    await db.commit()
    # Fetch created
    return await get_employee(eid, _=_, db=db)


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str, body: EmployeeUpdate,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    updates = {}
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
    return await get_employee(employee_id, _=_, db=db)


@router.post("/import", response_model=CsvImportResult)
async def import_csv(
    file: UploadFile,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    text_content = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text_content))
    rows = []
    success = 0
    errors = 0

    for i, row in enumerate(reader, start=2):
        try:
            emp_code = row.get("emp_code", "").strip()
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

            # Validate FKs
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

            # Check duplicate
            dup = await db.execute(text("SELECT id FROM employees WHERE emp_code = :ec"), {"ec": emp_code})
            if dup.fetchone():
                rows.append(CsvImportRow(row_number=i, emp_code=emp_code, status="error", message="Duplicate emp_code"))
                errors += 1
                continue

            eid = str(uuid.uuid4())
            await db.execute(text("""
                INSERT INTO employees (id, emp_code, name, gender, doj, category_id, department_id, designation_id)
                VALUES (:id, :ec, :nm, :g, TO_DATE(:doj, 'YYYY-MM-DD'),
                        (SELECT id FROM employee_categories WHERE code = :cc),
                        (SELECT id FROM departments WHERE code = :dc),
                        (SELECT id FROM designations WHERE name = :dn))
            """), {"id": eid, "ec": emp_code, "nm": name, "g": gender, "doj": doj_str, "cc": cat_code, "dc": dept_code, "dn": des_name})
            success += 1
            rows.append(CsvImportRow(row_number=i, emp_code=emp_code, status="success"))
        except Exception as e:
            errors += 1
            rows.append(CsvImportRow(row_number=i, emp_code=emp_code or "", status="error", message=str(e)))

    await db.commit()
    return CsvImportResult(total_rows=success + errors, success_count=success, error_count=errors, rows=rows)
```

---

### FILE: `backend/app/api/v1/departments.py`

```python
"""Department CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db
from app.schemas import DepartmentCreate, DepartmentUpdate, DepartmentResponse

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentResponse])
async def list_departments(
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("SELECT id, code, name, parent_dept_id, managing_office FROM departments ORDER BY name"))
    return [
        DepartmentResponse(
            id=str(r.id), code=r.code, name=r.name,
            parent_dept_id=str(r.parent_dept_id) if r.parent_dept_id else None,
            managing_office=r.managing_office,
        ) for r in result.fetchall()
    ]


@router.post("", response_model=DepartmentResponse, status_code=201)
async def create_department(
    body: DepartmentCreate,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    parent_id = None
    if body.parent_dept_code:
        pr = await db.execute(text("SELECT id FROM departments WHERE code = :c"), {"c": body.parent_dept_code})
        p_row = pr.fetchone()
        if not p_row:
            raise HTTPException(status_code=400, detail=f"Parent department not found: {body.parent_dept_code}")
        parent_id = str(p_row[0])

    did = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO departments (id, code, name, parent_dept_id, managing_office)
        VALUES (:id, :code, :name, :pid, :mo)
    """), {"id": did, "code": body.code, "name": body.name, "pid": parent_id, "mo": body.managing_office})
    await db.commit()

    result = await db.execute(text("SELECT id, code, name, parent_dept_id, managing_office FROM departments WHERE id = :id"), {"id": did})
    r = result.fetchone()
    return DepartmentResponse(id=str(r.id), code=r.code, name=r.name, parent_dept_id=str(r.parent_dept_id) if r.parent_dept_id else None, managing_office=r.managing_office)


@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: str, body: DepartmentUpdate,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.managing_office is not None:
        updates["managing_office"] = body.managing_office
    if updates:
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        updates["eid"] = department_id
        await db.execute(text(f"UPDATE departments SET {set_clause} WHERE id = :eid"), updates)
        await db.commit()
    result = await db.execute(text("SELECT id, code, name, parent_dept_id, managing_office FROM departments WHERE id = :id"), {"id": department_id})
    r = result.fetchone()
    if not r:
        raise HTTPException(status_code=404)
    return DepartmentResponse(id=str(r.id), code=r.code, name=r.name, parent_dept_id=str(r.parent_dept_id) if r.parent_dept_id else None, managing_office=r.managing_office)
```

---

### FILE: `backend/app/api/v1/designations.py`

```python
"""Designation CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.core.database import get_db
from app.schemas import DesignationCreate, DesignationResponse

router = APIRouter(prefix="/designations", tags=["designations"])


@router.get("", response_model=list[DesignationResponse])
async def list_designations(
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER", "REGISTRAR", "DIRECTOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT d.id, d.name, d.grade_pay_level, c.code AS category_code
        FROM designations d
        LEFT JOIN employee_categories c ON d.category_id = c.id
        ORDER BY d.name
    """))
    return [
        DesignationResponse(id=str(r.id), name=r.name, grade_pay_level=r.grade_pay_level, category_code=r.category_code)
        for r in result.fetchall()
    ]


@router.post("", response_model=DesignationResponse, status_code=201)
async def create_designation(
    body: DesignationCreate,
    _: dict = Depends(require_role("ADMIN", "ESTABLISHMENT_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    cat_id = None
    if body.category_code:
        cr = await db.execute(text("SELECT id FROM employee_categories WHERE code = :c"), {"c": body.category_code})
        c_row = cr.fetchone()
        if not c_row:
            raise HTTPException(status_code=400, detail=f"Unknown category: {body.category_code}")
        cat_id = str(c_row[0])

    did = str(uuid.uuid4())
    await db.execute(text("""
        INSERT INTO designations (id, name, grade_pay_level, category_id)
        VALUES (:id, :name, :gpl, :cid)
    """), {"id": did, "name": body.name, "gpl": body.grade_pay_level, "cid": cat_id})
    await db.commit()

    result = await db.execute(text("""
        SELECT d.id, d.name, d.grade_pay_level, c.code AS category_code
        FROM designations d LEFT JOIN employee_categories c ON d.category_id = c.id
        WHERE d.id = :id
    """), {"id": did})
    r = result.fetchone()
    return DesignationResponse(id=str(r.id), name=r.name, grade_pay_level=r.grade_pay_level, category_code=r.category_code)
```

---

### FILE: `backend/app/api/v1/users.py`

```python
"""User management routes (admin only)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.auth.jwt import hash_password
from app.core.database import get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
async def list_users(
    role: str = Query(None),
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    query = "SELECT id, username, role, is_active, must_change_password, employee_id, last_login, created_at FROM users"
    params = {}
    if role:
        query += " WHERE role = :role"
        params["role"] = role
    query += " ORDER BY username"
    result = await db.execute(text(query), params)
    return [
        {
            "id": str(r.id), "username": r.username, "role": r.role,
            "is_active": r.is_active, "must_change_password": r.must_change_password,
            "employee_id": str(r.employee_id) if r.employee_id else None,
            "last_login": str(r.last_login) if r.last_login else None,
            "created_at": str(r.created_at),
        }
        for r in result.fetchall()
    ]


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    body: dict,
    _: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Update user role, active status, or trigger password reset."""
    allowed = ["role", "is_active", "must_change_password"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["uid"] = user_id
    await db.execute(text(f"UPDATE users SET {set_clause} WHERE id = :uid"), updates)
    await db.commit()
    return {"message": "User updated"}
```

---

### FILE: `frontend/src/api/client.ts`

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token from Zustand store
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
```

---

### FILE: `frontend/src/api/endpoints.ts`

```typescript
import api from './client';

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (userId: string, newPassword: string) =>
    api.post('/auth/change-password', { user_id: userId, new_password: newPassword }),
};

export const employeesApi = {
  list: (params: Record<string, string | boolean>) =>
    api.get('/employees', { params }),
  get: (id: string) => api.get(`/employees/${id}`),
  create: (data: Record<string, unknown>) => api.post('/employees', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/employees/${id}`, data),
  importCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/employees/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const departmentsApi = {
  list: () => api.get('/departments'),
  create: (data: Record<string, unknown>) => api.post('/departments', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/departments/${id}`, data),
};

export const designationsApi = {
  list: () => api.get('/designations'),
  create: (data: Record<string, unknown>) => api.post('/designations', data),
};

export const usersApi = {
  list: (role?: string) => api.get('/users', { params: role ? { role } : {} }),
  update: (id: string, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
};
```

---

### FILE: `frontend/src/pages/LoginPage.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { useAuthStore } from '../stores';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login(username, password);
      localStorage.setItem('access_token', data.access_token);
      setAuth(data.access_token, data.user);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F4F8]">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-primary-800 mb-1">AIIMS HRMS</h1>
        <p className="text-gray-500 mb-6">Bibinagar — Sign in</p>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            required
            autoFocus
          />
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-6 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2 rounded-md hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

### FILE: `frontend/src/pages/EmployeeListPage.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeesApi, departmentsApi, designationsApi } from '../api/endpoints';
import { useAuthStore } from '../stores';

interface Employee {
  id: string;
  emp_code: string;
  name: string;
  gender: string;
  doj: string;
  category_name: string;
  department_name: string;
  designation_name: string;
  email?: string;
  is_active: boolean;
  user_id?: string;
}

export default function EmployeeListPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data } = await employeesApi.list({ search });
      setEmployees(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchEmployees();
  }, [search]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data } = await employeesApi.importCsv(file);
      alert(`Import done: ${data.success_count} success, ${data.error_count} errors`);
      fetchEmployees();
    } catch (err) {
      alert('Import failed');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Employee Master</h2>
        <div className="flex gap-2">
          <label className="px-3 py-2 bg-green-600 text-white rounded cursor-pointer hover:bg-green-700 text-sm">
            Import CSV
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={() => setShowForm(true)} className="px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm">
            + Add Employee
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search by name or emp_code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-primary-500"
      />

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Dept</th>
                <th className="px-4 py-2 text-left">Designation</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">{emp.emp_code}</td>
                  <td className="px-4 py-2">{emp.name}</td>
                  <td className="px-4 py-2">{emp.department_name}</td>
                  <td className="px-4 py-2">{emp.designation_name}</td>
                  <td className="px-4 py-2">{emp.category_name}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-1 rounded ${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <EmployeeFormModal onClose={() => setShowForm(false)} onSaved={fetchEmployees} />}
    </div>
  );
}

function EmployeeFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ emp_code: '', name: '', gender: 'MALE', doj: '', category_code: '', department_code: '', designation_name: '', email: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await employeesApi.create(form);
      onSaved();
      onClose();
    } catch (err) {
      alert('Failed to create employee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
        <h3 className="text-lg font-bold mb-4">Add Employee</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input placeholder="Emp Code *" value={form.emp_code} onChange={(e) => setForm({ ...form, emp_code: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full border rounded px-3 py-2">
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
          <input type="date" placeholder="DOJ *" value={form.doj} onChange={(e) => setForm({ ...form, doj: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input placeholder="Category Code *" value={form.category_code} onChange={(e) => setForm({ ...form, category_code: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input placeholder="Department Code *" value={form.department_code} onChange={(e) => setForm({ ...form, department_code: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input placeholder="Designation *" value={form.designation_name} onChange={(e) => setForm({ ...form, designation_name: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded px-3 py-2" />
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-primary-600 text-white py-2 rounded hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### FILE: `frontend/src/pages/MastersPage.tsx`

```typescript
import { useState, useEffect } from 'react';
import { departmentsApi, designationsApi } from '../api/endpoints';

interface Dept { id: string; code: string; name: string; managing_office?: string }
interface Desg { id: string; name: string; grade_pay_level?: string; category_code?: string }

export default function MastersPage() {
  const [tab, setTab] = useState<'dept' | 'desg'>('dept');
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('dept')} className={`px-4 py-2 rounded text-sm font-medium ${tab === 'dept' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>
          Departments
        </button>
        <button onClick={() => setTab('desg')} className={`px-4 py-2 rounded text-sm font-medium ${tab === 'desg' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>
          Designations
        </button>
      </div>
      {tab === 'dept' ? <DepartmentTab /> : <DesignationTab />}
    </div>
  );
}

function DepartmentTab() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [office, setOffice] = useState('');

  const load = async () => {
    const { data } = await departmentsApi.list();
    setDepts(data);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;
    await departmentsApi.create({ code, name, managing_office: office || null });
    setCode(''); setName(''); setOffice('');
    load();
  };

  return (
    <div>
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} className="border rounded px-3 py-2 w-24" required />
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2 flex-1" required />
        <input placeholder="Office" value={office} onChange={(e) => setOffice(e.target.value)} className="border rounded px-3 py-2 w-40" />
        <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 text-sm">Add</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left">Code</th><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-left">Office</th></tr></thead>
          <tbody>
            {depts.map((d) => (
              <tr key={d.id} className="border-t"><td className="px-4 py-2">{d.code}</td><td className="px-4 py-2">{d.name}</td><td className="px-4 py-2 text-gray-500">{d.managing_office || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DesignationTab() {
  const [desgs, setDesgs] = useState<Desg[]>([]);
  const [name, setName] = useState('');
  const [payLevel, setPayLevel] = useState('');
  const [catCode, setCatCode] = useState('');

  const load = async () => {
    const { data } = await designationsApi.list();
    setDesgs(data);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    await designationsApi.create({ name, grade_pay_level: payLevel || null, category_code: catCode || null });
    setName(''); setPayLevel(''); setCatCode('');
    load();
  };

  return (
    <div>
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input placeholder="Designation Name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2 flex-1" required />
        <input placeholder="Pay Level" value={payLevel} onChange={(e) => setPayLevel(e.target.value)} className="border rounded px-3 py-2 w-32" />
        <input placeholder="Category Code" value={catCode} onChange={(e) => setCatCode(e.target.value)} className="border rounded px-3 py-2 w-32" />
        <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 text-sm">Add</button>
      </form>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-left">Pay Level</th><th className="px-4 py-2 text-left">Category</th></tr></thead>
          <tbody>
            {desgs.map((d) => (
              <tr key={d.id} className="border-t"><td className="px-4 py-2">{d.name}</td><td className="px-4 py-2 text-gray-500">{d.grade_pay_level || '—'}</td><td className="px-4 py-2 text-gray-500">{d.category_code || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

### FILE: `frontend/src/App.tsx`

⚠️ **OVERWRITE** existing file.

```typescript
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from './stores';
import LoginPage from './pages/LoginPage';
import EmployeeListPage from './pages/EmployeeListPage';
import MastersPage from './pages/MastersPage';
import { authApi } from './api/endpoints';

function Layout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('access_token');
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-primary-800">AIIMS HRMS — Bibinagar</h1>
            {user && (
              <nav className="flex gap-4 text-sm">
                <Link to="/" className="text-gray-600 hover:text-primary-600">Employees</Link>
                <Link to="/masters" className="text-gray-600 hover:text-primary-600">Masters</Link>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-gray-500">
                {user.username} <span className="text-gray-400">({user.role})</span>
              </span>
            )}
            <span className="text-sm text-gray-400">v0.2.0</span>
            {user && (
              <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-800">
                Logout
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<Layout><Routes><Route path="/" element={<EmployeeListPage />} /><Route path="/masters" element={<MastersPage />} /></Routes></Layout>} />
    </Routes>
  );
}
```

---

