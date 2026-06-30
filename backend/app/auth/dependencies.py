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

    user_res = await db.execute(
        text("SELECT is_active, must_change_password, EXTRACT(EPOCH FROM tokens_valid_from) AS valid_from_epoch FROM users WHERE id = :uid"),
        {"uid": user_id}
    )
    user_row = user_res.fetchone()
    if not user_row or not user_row.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    iat = payload.get("iat")
    if iat and user_row.valid_from_epoch:
        if iat < (float(user_row.valid_from_epoch) - 1.0):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalidated by password change")

    if user_row.must_change_password:
        allowed_paths = {"/api/v1/auth/change-my-password", "/api/v1/auth/logout", "/api/v1/auth/me"}
        if request.url.path not in allowed_paths:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="PASSWORD_CHANGE_REQUIRED")

    return {
        "user_id": user_id,
        "role": payload.get("role", "STAFF"),
        "username": payload.get("username", ""),
        "jti": jti,
        "impersonated_by": payload.get("impersonated_by"),
    }


async def employee_scope(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Returns the employee_id filter for the current user based on role.

    - STAFF             -> own employee only
    - HOD               -> own department employees
    - DEAN_ACADEMIC     -> all residents
    - ESTABLISHMENT_OFFICER / REGISTRAR -> all regular staff
    - DIRECTOR / ADMIN  -> all
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

    res = {"scope": "none", "employee_ids": []}

    if role == "STAFF":
        res = {"scope": "own", "employee_ids": [emp_id] if emp_id else []}
    elif role == "HOD":
        if emp_id:
            dept_result = await db.execute(
                text("SELECT department_id FROM employees WHERE id = :eid"),
                {"eid": emp_id},
            )
            dept_row = dept_result.fetchone()
            if dept_row:
                sub_result = await db.execute(
                    text("SELECT id FROM employees WHERE department_id = :did"),
                    {"did": str(dept_row[0])},
                )
                res = {"scope": "department", "employee_ids": [str(r[0]) for r in sub_result.fetchall()]}
    elif role == "DEAN_ACADEMIC":
        res_result = await db.execute(
            text("""
                SELECT e.id FROM employees e
                JOIN employee_categories c ON e.category_id = c.id
                WHERE c.leave_scheme = 'RESIDENCY'
            """),
        )
        res = {"scope": "residents", "employee_ids": [str(r[0]) for r in res_result.fetchall()]}
    elif role == "ESTABLISHMENT_OFFICER":
        reg_result = await db.execute(
            text("""
                SELECT e.id FROM employees e
                JOIN employee_categories c ON e.category_id = c.id
                WHERE c.leave_scheme = 'CCS'
            """),
        )
        res = {"scope": "regular", "employee_ids": [str(r[0]) for r in reg_result.fetchall()]}
    elif role == "REGISTRAR":
        reg_result = await db.execute(
            text("""
                SELECT e.id FROM employees e
                JOIN employee_categories c ON e.category_id = c.id
                WHERE c.leave_scheme = 'RESIDENCY'
            """),
        )
        res = {"scope": "residents", "employee_ids": [str(r[0]) for r in reg_result.fetchall()]}
    elif role in ("NODAL_OFFICER", "NODAL_OFFICE"):
        nodal_result = await db.execute(
            text("""
                SELECT DISTINCT e.id FROM employees e
                JOIN dept_nodal_assignments dna ON dna.department_id = e.department_id
                WHERE dna.nodal_user_id = :uid AND dna.is_active = true
            """),
            {"uid": user_id},
        )
        res = {"scope": "nodal_departments", "employee_ids": [str(r[0]) for r in nodal_result.fetchall()]}

    if res["employee_ids"] is not None and emp_id and emp_id not in res["employee_ids"]:
        res["employee_ids"].append(emp_id)

    return res


def require_role(*roles: str):
    """Dependency factory: only allow given roles."""
    async def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return dependency