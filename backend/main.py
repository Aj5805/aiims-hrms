"""AIIMS HRMS application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

from app.api.v1 import router as v1_router
from app.core.config import settings
from app.core.database import engine, ping_db
from app.core.rate_limit import limiter
from app.services.email_sender import start_email_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    await ping_db()
    start_email_scheduler()
    yield
    await engine.dispose()


app = FastAPI(
    title="AIIMS HRMS",
    description="AIIMS Bibinagar - Human Resource Management System",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.middleware import MaintenanceMiddleware

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(MaintenanceMiddleware)
app.add_middleware(SlowAPIMiddleware)

# Routers
app.include_router(v1_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health-check: returns DB connectivity status."""
    db_ok = await ping_db()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
        "version": "0.1.0",
    }
