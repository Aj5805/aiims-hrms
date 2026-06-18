"""Application-wide rate limiter."""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# NOTE: slowapi's default storage is per-process in-memory.
# Under `uvicorn --workers 4`, the effective ceiling is roughly 4x the configured
# per-IP limit because workers do not share counters. This is acceptable coarse
# protection on a single LAN box for now; move to shared storage if stricter
# cross-worker enforcement is needed.
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.RATE_LIMIT_GENERAL])
