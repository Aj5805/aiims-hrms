"""Auth routes: login, refresh, logout, change-password, me."""

from datetime import datetime, timedelta, timezone

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
from app.core.rate_limit import limiter
from app.schemas import LoginRequest, PasswordResetRequest, TokenResponse, SelfPasswordChangeRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def login(request: Request, body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Authenticate user, return access + refresh tokens."""
    result = await db.execute(
        text("""
            SELECT u.id, u.username, u.password_hash, u.role, u.must_change_password, u.is_active,
                   u.failed_login_attempts, u.locked_until,
                   e.id AS employee_id, e.emp_code
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.username = :un
        """),
        {"un": body.username},
    )
    user = result.fetchone()
    now = datetime.now(timezone.utc)
    if user and user.locked_until:
        locked_until = user.locked_until.astimezone(timezone.utc) if user.locked_until.tzinfo else user.locked_until.replace(tzinfo=timezone.utc)
        if locked_until > now:
            raise HTTPException(status_code=429, detail="Account temporarily locked. Please try again later.")

    if not user or not verify_password(body.password, user.password_hash):
        if user:
            failed_attempts = int(user.failed_login_attempts or 0) + 1
            locked_until = now + timedelta(minutes=15) if failed_attempts >= 5 else None
            await db.execute(
                text(
                    """
                    UPDATE users
                    SET failed_login_attempts = :failed_attempts,
                        locked_until = :locked_until,
                        updated_at = now()
                    WHERE id = :uid
                    """
                ),
                {"failed_attempts": failed_attempts, "locked_until": locked_until, "uid": str(user.id)},
            )
            await db.commit()
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

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:500]

    await db.execute(
        text(
            """
            UPDATE users
            SET last_login = now(),
                failed_login_attempts = 0,
                locked_until = NULL
            WHERE id = :uid
            """
        ),
        {"uid": uid},
    )
    await db.execute(
        text(
            """
            INSERT INTO login_log (user_id, ip_address, user_agent)
            VALUES (:uid, :ip, :ua)
            """
        ),
        {"uid": uid, "ip": client_ip, "ua": user_agent},
    )
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
@limiter.limit(settings.RATE_LIMIT_AUTH)
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


@router.post("/change-my-password", response_model=TokenResponse)
async def change_my_password(
    body: SelfPasswordChangeRequest,
    response: Response,
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

    result = await db.execute(
        text(
            """
            SELECT u.username, u.role, u.must_change_password, e.id AS employee_id, e.emp_code
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.id = :uid
            """
        ),
        {"uid": uid},
    )
    updated_user = result.fetchone()

    access_token = create_access_token(uid, updated_user.role, updated_user.username)
    refresh_token = create_refresh_token(uid)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        max_age=7 * 24 * 3600,
        path="/api/v1/auth",
    )

    return TokenResponse(
        access_token=access_token,
        user={
            "id": uid,
            "username": updated_user.username,
            "role": updated_user.role,
            "must_change_password": updated_user.must_change_password,
            "employee_id": str(updated_user.employee_id) if updated_user.employee_id else None,
            "emp_code": updated_user.emp_code,
        },
    )


@router.get("/my-login-activity")
async def my_login_activity(
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Staff self-service: recent login events for the current user."""
    result = await db.execute(
        text("""
            SELECT logged_in_at, ip_address, user_agent
            FROM login_log
            WHERE user_id = :uid
            ORDER BY logged_in_at DESC
            LIMIT :lim
        """),
        {"uid": current_user["user_id"], "lim": min(limit, 50)},
    )
    rows = result.fetchall()
    last_login = None
    user_row = await db.execute(
        text("SELECT last_login FROM users WHERE id = :uid"),
        {"uid": current_user["user_id"]},
    )
    lr = user_row.fetchone()
    if lr and lr.last_login:
        last_login = str(lr.last_login)

    return {
        "last_login": last_login,
        "history": [
            {
                "logged_in_at": str(r.logged_in_at),
                "ip_address": r.ip_address,
                "user_agent": r.user_agent,
            }
            for r in rows
        ],
    }


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


@router.post("/impersonate/{target_user_id}", response_model=TokenResponse)
async def impersonate_user(
    target_user_id: str,
    admin: dict = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """ADMIN-only: issue a token for any active user without requiring their password.

    The resulting JWT includes ``impersonated_by`` so audit logs can trace the session.
    The admin's own session is NOT invalidated.
    """
    result = await db.execute(
        text("""
            SELECT u.id, u.username, u.role, u.is_active,
                   e.id AS employee_id, e.emp_code
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.id = :uid
        """),
        {"uid": target_user_id},
    )
    target = result.fetchone()

    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")
    if not target.is_active:
        raise HTTPException(status_code=400, detail="Cannot impersonate an inactive user")
    if target.role == "ADMIN":
        raise HTTPException(status_code=403, detail="Cannot impersonate another ADMIN account")

    uid = str(target.id)

    # Build a normal access token but embed impersonated_by for audit visibility
    now = datetime.utcnow()
    from datetime import timedelta
    import uuid as _uuid
    from app.core.config import settings as _settings
    from jose import jwt as _jwt

    payload = {
        "sub": uid,
        "role": target.role,
        "username": target.username,
        "impersonated_by": admin["user_id"],
        "jti": str(_uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(hours=_settings.ACCESS_TOKEN_EXPIRE_HOURS),
    }
    access_token = _jwt.encode(payload, _settings.JWT_SECRET, algorithm=_settings.JWT_ALGORITHM)

    return TokenResponse(
        access_token=access_token,
        user={
            "id": uid,
            "username": target.username,
            "role": target.role,
            "must_change_password": False,
            "employee_id": str(target.employee_id) if target.employee_id else None,
            "emp_code": target.emp_code,
        },
    )

