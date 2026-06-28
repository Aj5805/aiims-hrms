import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from sqlalchemy import text
from app.core.database import async_session_factory
from app.auth.jwt import decode_token

# Simple in-memory cache for maintenance mode to avoid DB hit on every single request
_maintenance_cache = {"is_maintenance": False, "last_checked": 0}

class MaintenanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Always allow auth routes and docs so admins can log in
        if request.url.path.startswith("/api/v1/auth/") or request.url.path.startswith("/docs") or request.url.path.startswith("/openapi"):
            return await call_next(request)

        # Check cache
        now = time.time()
        if now - _maintenance_cache["last_checked"] > 10:  # refresh every 10 seconds
            async with async_session_factory() as db:
                result = await db.execute(text("SELECT value FROM system_settings WHERE key = 'maintenance_mode'"))
                row = result.fetchone()
                if row and str(row.value).lower() in ["true", '"true"']:
                    _maintenance_cache["is_maintenance"] = True
                else:
                    _maintenance_cache["is_maintenance"] = False
                _maintenance_cache["last_checked"] = now

        if _maintenance_cache["is_maintenance"]:
            # If maintenance mode is ON, allow ADMIN users
            # Extract token manually
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                try:
                    payload = decode_token(token)
                    if payload.get("role") == "ADMIN":
                        return await call_next(request)
                except Exception:
                    pass
            
            # Non-admin or unauthenticated
            return JSONResponse(
                status_code=503,
                content={"detail": "System is currently undergoing maintenance. Please try again later.", "code": "MAINTENANCE_MODE"}
            )

        return await call_next(request)
