"""Auth routes: login, refresh, logout, change-password, me."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError
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
from app.core.config import settings
from app.schemas import LoginRequest, PasswordResetRequest, TokenResponse, SelfPasswordChangeRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Authenticate user, return access + refresh tokens."""
    result = await db.execute(
        text("""
            SELECT u.id, u.username, u.password_hash, u.role, u.must_change_password, u.is_active,
                   e.id AS employee_id, e.emp_code
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.username = :un
        """),
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
        secure=settings.COOKIE_SECURE,
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
            "employee_id": str(user.employee_id) if user.employee_id else None,
            "emp_code": user.emp_code,
        },
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Issue new tokens using refresh token cookie and rotate."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    
    try:
        payload = decode_token(refresh_token)
        uid = payload.get("sub")
        jti = payload.get("jti")
        if not uid or not jti:
            raise ValueError()
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Check if jti is in token_blacklist for reuse detection
    blacklisted = await db.execute(text("SELECT jti FROM token_blacklist WHERE jti = :jti"), {"jti": jti})
    if blacklisted.fetchone():
        raise HTTPException(status_code=401, detail="Refresh token already used or revoked")

    result = await db.execute(
        text("""
            SELECT u.id, u.username, u.role, u.is_active, u.must_change_password, 
                   EXTRACT(EPOCH FROM u.tokens_valid_from) AS valid_from_epoch,
                   e.id AS employee_id, e.emp_code
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.id = :uid
        """), 
        {"uid": uid}
    )
    user_row = result.fetchone()
    if not user_row or not user_row.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
        
    iat = payload.get("iat")
    if iat and user_row.valid_from_epoch:
        if iat < (float(user_row.valid_from_epoch) - 1.0):
            raise HTTPException(status_code=401, detail="Refresh token invalidated by password change")

    new_access = create_access_token(uid, user_row.role, user_row.username)
    new_refresh = create_refresh_token(uid)

    # Blacklist old refresh token to prevent reuse
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    await db.execute(
        text("INSERT INTO token_blacklist (jti, user_id, expires_at) VALUES (:jti, :uid, :exp) ON CONFLICT DO NOTHING"),
        {"jti": jti, "uid": uid, "exp": expires_at}
    )
    await db.commit()

    response.set_cookie(
        key="refresh_token", value=new_refresh, httponly=True,
        secure=settings.COOKIE_SECURE, samesite="strict", max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600, path="/api/v1/auth"
    )

    return TokenResponse(
        access_token=new_access,
        user={
            "id": uid,
            "username": user_row.username,
            "role": user_row.role,
            "must_change_password": user_row.must_change_password,
            "employee_id": str(user_row.employee_id) if user_row.employee_id else None,
            "emp_code": user_row.emp_code,
        }
    )


@router.post("/logout")
async def logout(
    response: Response,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Blacklist current access token JTI."""
    expires_at = datetime.utcnow() + timedelta(hours=8)
    await db.execute(
        text("INSERT INTO token_blacklist (jti, user_id, expires_at) VALUES (:jti, :uid, :exp)"),
        {"jti": current_user["jti"], "uid": current_user["user_id"], "exp": expires_at},
    )
    await db.commit()
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")
    return {"message": "Logged out"}


@router.post("/change-password")
async def change_password(
    body: PasswordResetRequest,
    current_user: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Admin resets a user password. Sets must_change_password = true."""
    hashed = hash_password(body.new_password)
    await db.execute(
        text("UPDATE users SET password_hash = :ph, must_change_password = true, tokens_valid_from = now() WHERE id = :uid"),
        {"ph": hashed, "uid": body.user_id},
    )
    await db.commit()
    return {"message": "Password reset. User must change on next login."}


@router.post("/change-my-password")
async def change_my_password(
    body: SelfPasswordChangeRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Self-service password change for authenticated users. Clears must_change_password."""
    uid = current_user["user_id"]
    result = await db.execute(
        text("SELECT password_hash FROM users WHERE id = :uid"),
        {"uid": uid}
    )
    user_row = result.fetchone()
    if not user_row or not verify_password(body.current_password, user_row.password_hash):
        raise HTTPException(status_code=400, detail="Invalid current password")

    new_hashed = hash_password(body.new_password)
    await db.execute(
        text("UPDATE users SET password_hash = :ph, must_change_password = false, tokens_valid_from = now() WHERE id = :uid"),
        {"ph": new_hashed, "uid": uid}
    )
    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT u.employee_id, e.emp_code 
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.id = :uid
        """),
        {"uid": current_user["user_id"]}
    )
    row = result.fetchone()
    if row:
        current_user["employee_id"] = str(row[0]) if row[0] else None
        current_user["emp_code"] = row[1]
    else:
        current_user["employee_id"] = None
        current_user["emp_code"] = None
    return current_user