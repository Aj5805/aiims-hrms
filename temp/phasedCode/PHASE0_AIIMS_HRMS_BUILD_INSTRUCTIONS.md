# AIIMS HRMS — Phase 0: Complete Build Instructions

> **For AI agent consumption.** Each section = one file.   
> **Heading** = relative file path from repo root. **Code block** = file content.   
> Place every file at its path inside `aiims-hrms/`.   
> **App name:** HRMS (repo renamed from `aiims-lms` → `aiims-hrms`).

---

## VERIFICATION AFTER PLACEMENT

```bash
cd aiims-hrms/backend
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
pytest tests/unit/ -v  # Should pass: 1 collected, 0 failures
cd ../frontend && npm install && npm test  # Should pass
```

---

### FILE: `.gitignore`

```
# Python
__pycache__/
*.py[cod]
*.egg-info/
.eggs/
dist/
build/
.env
*.env
venv/
.venv/

# Node / Frontend
node_modules/
frontend/dist/
frontend/.vite/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Uploads (do not commit user files)
uploads/

# Alembic
backend/alembic/versions/*.pyc

# Coverage
htmlcov/
.coverage
.coverage.*

# Logs
*.log
logs/

# Test
.pytest_cache/
```

---

### FILE: `.pre-commit-config.yaml`

```yaml
# Pre-commit hooks for AIIMS HRMS
# Install: pre-commit install
# Run manually: pre-commit run --all-files

repos:
  # Python: lint + format with Ruff
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.0
    hooks:
      - id: ruff
        args: [--fix, --exit-non-zero-on-fix]
        files: ^backend/
      - id: ruff-format
        files: ^backend/

  # Python: type checking with mypy
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        files: ^backend/
        args: [--ignore-missing-imports, --strict]
        additional_dependencies: [pydantic>=2.0, sqlalchemy>=2.0]

  # JavaScript/TypeScript: lint
  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v9.15.0
    hooks:
      - id: eslint
        files: ^frontend/src/.*\.(ts|tsx|js|jsx)$
        args: [--fix]

  # JavaScript/TypeScript: format
  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.4.0
    hooks:
      - id: prettier
        files: ^frontend/src/.*\.(ts|tsx|js|jsx|css|json)$

  # Python: run unit tests (fast verification only)
  - repo: local
    hooks:
      - id: pytest-unit
        name: pytest (unit only)
        entry: bash -c 'cd backend && pytest tests/unit -x --tb=short'
        language: system
        pass_filenames: false
        files: ^backend/

  # General: check for secrets in code
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.5.0
    hooks:
      - id: detect-secrets
        args: [--baseline, .secrets.baseline]

  # General: prevent large files
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: check-added-large-files
        args: [--maxkb=5000]
      - id: check-merge-conflict
      - id: end-of-file-fixer
        exclude: \.json$|dist/
      - id: trailing-whitespace
        exclude: \.md$
```

---

### FILE: `ONBOARDING.md`

```markdown
# AIIMS HRMS — Developer Onboarding Guide

## Prerequisites

| Tool        | Version      | Notes |
|-------------|-------------|-------|
| Python      | 3.11+        | Use `pyenv` or system package manager |
| Node.js     | 20+          | Use `nvm` or `fnm` |
| Docker      | 24+          | For dev PostgreSQL |
| Git         | 2.40+        | |
| PostgreSQL client | 16    | `psql` for manual DB inspection |

## First-Time Setup

### 1. Clone the repo
```bash
git clone <repo-url>
cd aiims-hrms
git checkout -b <your-branch>  # Branch from main or v0.4.0-development
```

### 2. Start the dev database
```bash
docker compose up -d db test_db
```
This starts PostgreSQL 16 on ports 5432 (main) and 5433 (test).

### 3. Backend setup
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# Edit .env — set JWT_SECRET to a random 64+ char string
```

### 4. Run migrations
```bash
alembic upgrade head
```

### 5. Create admin user
```bash
python ../scripts/init_admin.py
```
Save the printed password — you'll need it to log in.

### 6. Verify backend
```bash
uvicorn main:app --reload
# Visit http://localhost:8000/health — should return {"status": "ok"}
# Visit http://localhost:8000/docs — Swagger UI
```

### 7. Frontend setup
```bash
cd ../frontend
npm install
npm run dev
# Visit http://localhost:5173
```

## Git Workflow

- **Branch naming:** `feature/<short-desc>`, `fix/<short-desc>`, `phase/<number>`
- **Commit style:** Conventional commits preferred (`feat:`, `fix:`, `chore:`, `test:`)
- **Before push:** `ruff check . && pytest tests/unit`
- **Never commit:** `.env`, `node_modules/`, `uploads/`

## IDE Setup (Recommended)

### VS Code
Extensions: Python, Pylance, Ruff, ESLint, Prettier, Tailwind CSS IntelliSense

Settings:
```json
{
  "[python]": { "editor.defaultFormatter": "charliermarsh.ruff" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "editor.formatOnSave": true
}
```

## Common Commands

| Task | Command |
|------|---------|
| Run backend | `cd backend && uvicorn main:app --reload` |
| Run frontend | `cd frontend && npm run dev` |
| Run unit tests (BE) | `cd backend && pytest tests/unit -v` |
| Run all tests (BE) | `cd backend && pytest -v` |
| Run frontend tests | `cd frontend && npm test` |
| Create migration | `cd backend && alembic revision --autogenerate -m "description"` |
| Lint Python | `cd backend && ruff check .` |
| Type check Python | `cd backend && mypy app/` |
| Build frontend | `cd frontend && npm run build` |

## Getting Help
- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.
- Refer to `docs/LEAVE_MGMT_IMPLEMENTATION_PLAN.md` for the full spec.
- Ask in the team channel for anything not covered here.
```

---

### FILE: `README.md`

```markdown
# AIIMS HRMS — Bibinagar

**Human Resource Management System** for AIIMS Bibinagar, serving the Establishment Section and Dean Academic Office.

> **App name:** HRMS (formerly "LMS" — repo renamed to `aiims-hrms`).

---

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | FastAPI (Python 3.11+) |
| ORM      | SQLAlchemy 2.0 + Alembic |
| Database | PostgreSQL 16 |
| Frontend | React 18 + Vite + Tailwind CSS |
| Auth     | JWT (access 8h / refresh 7d) |
| Email    | Zoho SMTP via `fastapi-mail` |

---

## Quick Start (Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker (for PostgreSQL dev DB)

### 1. Clone & enter
```bash
git clone <repo-url> aiims-hrms
cd aiims-hrms
```

### 2. Start PostgreSQL
```bash
docker compose up -d db
```

### 3. Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .[dev]
cp .env.example .env         # Edit values as needed
alembic upgrade head
python ../scripts/init_admin.py
uvicorn main:app --reload
```
API available at `http://localhost:8000`.
- Swagger docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```
UI at `http://localhost:5173` (proxies `/api` to backend).

---

## Windows Server Deployment

See [`deployment/`](deployment/) for:
- **Nginx config** — reverse proxy on port 80
- **NSSM config** — run FastAPI as a Windows Service
- **OPS_RUNBOOK.md** — log rotation, crash recovery, SSL renewal, backup verification
- **ROLLBACK.md** — migration downgrade, code revert, data restore

### Production deployment steps
1. Install PostgreSQL 16 natively on Windows Server.
2. Install Python 3.11+ and create a virtual environment.
3. Install Nginx for Windows and configure reverse proxy.
4. Install NSSM; register Uvicorn as a Windows Service.
5. Copy `.env` from `.env.example` and populate all secrets.
6. Run `alembic upgrade head` and `python scripts/init_admin.py`.
7. Build frontend: `cd frontend && npm run build`. Serve `dist/` via Nginx.
8. Configure Windows Task Scheduler for backups and log rotation.

---

## Testing
```bash
# Backend
cd backend
pytest tests/unit          # Unit tests (no DB needed)
pytest tests/integration   # Integration tests (requires test DB on port 5433)

# Frontend
cd frontend
npm test
```

---

## Project Structure
```
aiims-hrms/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # API route modules
│   │   └── core/            # Config, DB, Cache
│   ├── alembic/             # DB migrations
│   ├── tests/               # unit/, integration/, load/
│   ├── main.py              # FastAPI entry point
│   └── pyproject.toml
├── frontend/                # Vite + React 18
├── scripts/                 # init_admin.py, generate_test_data.py
├── deployment/              # Nginx, NSSM, OPS runbook, rollback
├── docker-compose.yml
└── README.md
```

---

## Documentation
- [ONBOARDING.md](ONBOARDING.md) — Developer setup guide
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Common issues & fixes
- [deployment/OPS_RUNBOOK.md](deployment/OPS_RUNBOOK.md) — Operations runbook
- [deployment/ROLLBACK.md](deployment/ROLLBACK.md) — Rollback procedure
- `docs/LEAVE_MGMT_IMPLEMENTATION_PLAN.md` — Master implementation plan (source of truth)

---

## License
Proprietary — AIIMS Bibinagar.
```

---

### FILE: `TROUBLESHOOTING.md`

```markdown
# AIIMS HRMS — Troubleshooting Guide

## Backend

### `uvicorn` fails with "could not translate host name"
**Cause:** PostgreSQL is not running or DATABASE_URL is wrong.

**Fix:**
```bash
docker compose up -d db       # Ensure DB container is running
docker compose ps              # Check container status
# Verify .env DATABASE_URL matches the docker-compose credentials
```

### `alembic upgrade head` fails with "relation does not exist"
**Cause:** Running migrations in the wrong order, or DB was dropped/recreated.

**Fix:**
```bash
alembic downgrade base          # Reset to empty (if migrations table exists)
dropdb aiims_hrms               # Or: docker compose down -v
createdb aiims_hrms
alembic upgrade head
```

### `pip install` fails on `bcrypt` / `psycopg2`
**Cause:** Missing system build dependencies.

**Fix (Ubuntu/Debian):**
```bash
sudo apt install build-essential libpq-dev python3.11-dev
```
**Fix (Windows):** Use pre-built wheels — ensure Python 3.11 is in PATH and pip is up to date:
```bash
python -m pip install --upgrade pip
```

### Tests fail with "could not connect to test database"
**Cause:** Test DB container not started.

**Fix:**
```bash
docker compose up -d test_db    # Starts on port 5433
# Verify: psql -h localhost -p 5433 -U aiims_hrms_test -d aiims_hrms_test
```

### Import errors after pulling
**Cause:** New dependencies added.

**Fix:**
```bash
pip install -e ".[dev]"         # Reinstall with latest deps
```

## Frontend

### `npm install` fails
**Cause:** Node version too old or `node_modules` corrupted.

**Fix:**
```bash
node --version                   # Must be 20+
rm -rf node_modules package-lock.json
npm install
```

### Proxy errors (frontend can't reach backend)
**Cause:** Backend not running, or port mismatch.

**Fix:**
- Ensure `uvicorn main:app --reload` is running on port 8000.
- Check `vite.config.ts` proxy target matches backend port.
- For Windows: localhost resolution may differ — try `127.0.0.1` instead.

### Blank white screen in browser
**Cause:** JS bundle error or routing issue.

**Fix:**
- Open browser DevTools → Console tab for JS errors.
- Check Network tab — is `/src/main.tsx` loading?
- Run `npm run build` to see if there are TS compilation errors.

## Docker

### Port 5432 already in use
**Cause:** Another PostgreSQL instance running locally.

**Fix:**
```bash
sudo systemctl stop postgresql   # Stop local PG
# Or change the port mapping in docker-compose.yml
```

### Docker container exits immediately
**Cause:** Port conflict or disk space.

**Fix:**
```bash
docker compose logs db           # Check logs
df -h                            # Check disk space
docker system prune -a           # Clean up old containers/images
```

## Windows Server (Production)

### Nginx won't start
- Check `nginx -t` for config errors.
- Port 80 may be in use by IIS — stop IIS via `services.msc`.
- Run `nginx.exe` from an Administrator command prompt first time.

### NSSM service crashes on start
- Check NSSM Application tab: path to `python.exe` must be absolute.
- Check NSSM I/O tab: redirect stdout/stderr to log files.
- Run Uvicorn directly first: `uvicorn main:app --host 0.0.0.0 --port 8000` to confirm it works.

### Certificate warning in browser
Self-signed cert is expected for LAN. Install the cert on each client machine:
1. Open `https://<server-ip>` in browser.
2. Click "Advanced" → "Proceed to server".
3. Click the padlock → "Certificate" → "Install Certificate" → "Trusted Root CA".
```

---

### FILE: `docker-compose.yml`

```yaml
# Use official PostgreSQL 16 for local dev (matches production target)
# Production uses native PostgreSQL on Windows Server — this is dev only.

services:
  db:
    image: postgres:16-alpine
    container_name: aiims_hrms_db
    environment:
      POSTGRES_USER: aiims_hrms
      POSTGRES_PASSWORD: aiims_hrms
      POSTGRES_DB: aiims_hrms
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aiims_hrms"]
      interval: 5s
      timeout: 3s
      retries: 5

  test_db:
    image: postgres:16-alpine
    container_name: aiims_hrms_test_db
    environment:
      POSTGRES_USER: aiims_hrms_test
      POSTGRES_PASSWORD: aiims_hrms_test
      POSTGRES_DB: aiims_hrms_test
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aiims_hrms_test"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

---

### FILE: `backend/.env.example`

```
# AIIMS HRMS — Environment Variables
# Copy this file to .env and fill in the values.

# ── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://aiims_hrms:aiims_hrms@localhost:5432/aiims_hrms
DATABASE_URL_SYNC=postgresql+psycopg2://aiims_hrms:aiims_hrms@localhost:5432/aiims_hrms
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_PRE_PING=True

# ── JWT ────────────────────────────────────────────────────────────────────
JWT_SECRET=change-me-min-64-chars-secret-key-please-replace-in-production-xxxxxx
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=8
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── CORS ───────────────────────────────────────────────────────────────────
# Comma-separated origins. Use * for dev; restrict to server LAN IP in prod.
CORS_ORIGINS=*

# ── Email (Zoho SMTP) ───────────────────────────────────────────────────────
ZOHO_SMTP_HOST=smtp.zoho.in
ZOHO_SMTP_PORT=587
ZOHO_EMAIL=
ZOHO_APP_PASSWORD=

# ── Rate Limiting ───────────────────────────────────────────────────────────
RATE_LIMIT_AUTH=5/minute
RATE_LIMIT_GENERAL=100/minute
RATE_LIMIT_EXPORT=10/minute

# ── Upload ──────────────────────────────────────────────────────────────────
UPLOAD_MAX_SIZE_MB=5
UPLOAD_DIR=uploads

# ── Bcrypt ──────────────────────────────────────────────────────────────────
BCRYPT_ROUNDS=12
```

---

### FILE: `backend/alembic.ini`

```ini
# A generic single-database configuration.

[alembic]
script_location = alembic
prepend_sys_path = .
sqlalchemy.url = postgresql+asyncpg://aiims_hrms:aiims_hrms@localhost:5432/aiims_hrms

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

---

### FILE: `backend/main.py`

```python
"""AIIMS HRMS — Application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import router as v1_router
from app.core.config import settings
from app.core.database import engine, ping_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Startup: verify DB connectivity
    await ping_db()
    yield
    # Shutdown: dispose engine
    await engine.dispose()


app = FastAPI(
    title="AIIMS HRMS",
    description="AIIMS Bibinagar — Human Resource Management System",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────────────────
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
```

---

### FILE: `backend/pyproject.toml`

```toml
[project]
name = "aiims-hrms"
version = "0.1.0"
description = "AIIMS Bibinagar — Human Resource Management System (HRMS)"
requires-python = ">=3.11"
license = { text = "Proprietary" }

dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "sqlalchemy[asyncio]>=2.0.35",
    "alembic>=1.14.0",
    "asyncpg>=0.30.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.7.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "bcrypt>=4.0.0",
    "python-multipart>=0.0.18",
    "fastapi-mail>=1.4.1",
    "jinja2>=3.1.0",
    "WeasyPrint>=62.0",
    "apscheduler>=3.10.0",
    "cachetools>=5.5.0",
    "slowapi>=0.1.9",
    "bleach>=6.2.0",
    "openpyxl>=3.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.25.0",
    "httpx>=0.28.0",
    "ruff>=0.8.0",
    "mypy>=1.13.0",
    "locust>=2.32.0",
    "faker>=33.0.0",
]

[build-system]
requires = ["setuptools>=75.0"]
build-backend = "setuptools.build_meta"

[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "SIM"]

[tool.mypy]
python_version = "3.11"
strict = true
ignore_missing_imports = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

---

### FILE: `backend/pytest.ini`

```ini
# AIIMS HRMS — pytest configuration
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short --strict-markers
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    unit: unit tests
    integration: integration tests (require test DB)
```

---

### FILE: `backend/alembic/env.py`

```python
"""Alembic environment configuration for async SQLAlchemy."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import settings

# Alembic Config object
config = context.config

# Set the database URL from our settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models here so Alembic can detect them
# from app.models import Base  # Uncomment after models are added in Phase 1
target_metadata = None  # Replace with Base.metadata in Phase 1


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

---

### FILE: `backend/alembic/script.py.mako`

```python
"""Alembic script.py.mako template placeholder."""

# This file will be populated after `alembic init`.
# Alembic versions will appear in the versions/ directory.
```

---

### FILE: `backend/alembic/versions/__init__.py`

```python
"""Alembic versions package."""
```

---

### FILE: `backend/app/__init__.py`

```python
"""Empty init for app package."""
```

---

### FILE: `backend/app/api/__init__.py`

```python
"""Empty init for api package."""
```

---

### FILE: `backend/app/api/v1/__init__.py`

```python
"""API v1 router — placeholder for future route modules."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/ping")
async def ping():
    return {"ping": "pong"}
```

---

### FILE: `backend/app/core/__init__.py`

```python
"""Empty init for core package."""
```

---

### FILE: `backend/app/core/cache.py`

```python
"""In-memory TTL cache wrapper (cachetools).

Redis is deferred to v2 — this is sufficient for <50 concurrent users.
"""

from cachetools import TTLCache

# Default cache: max 1024 entries, TTL 300 seconds (5 min)
_default_cache: TTLCache = TTLCache(maxsize=1024, ttl=300)


def get_cache() -> TTLCache:
    return _default_cache


def cached(key: str):
    """Decorator-like helper: returns cached value or None."""
    return _default_cache.get(key)


def cache_set(key: str, value):
    _default_cache[key] = value


def cache_clear():
    _default_cache.clear()
```

---

### FILE: `backend/app/core/config.py`

```python
"""Application settings loaded from environment / .env."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://aiims_hrms:aiims_hrms@localhost:5432/aiims_hrms"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://aiims_hrms:aiims_hrms@localhost:5432/aiims_hrms"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_PRE_PING: bool = True

    # ── JWT ────────────────────────────────────────────────────────────────
    JWT_SECRET: str = "change-me-min-64-chars-secret-key-please-replace-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ───────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["*"]

    # ── Email (Zoho SMTP) ───────────────────────────────────────────────────
    ZOHO_SMTP_HOST: str = "smtp.zoho.in"
    ZOHO_SMTP_PORT: int = 587
    ZOHO_EMAIL: str = ""
    ZOHO_APP_PASSWORD: str = ""

    # ── Rate Limiting ───────────────────────────────────────────────────────
    RATE_LIMIT_AUTH: str = "5/minute"
    RATE_LIMIT_GENERAL: str = "100/minute"
    RATE_LIMIT_EXPORT: str = "10/minute"

    # ── Upload ──────────────────────────────────────────────────────────────
    UPLOAD_MAX_SIZE_MB: int = 5
    UPLOAD_DIR: str = "uploads"

    # ── Bcrypt ──────────────────────────────────────────────────────────────
    BCRYPT_ROUNDS: int = 12

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
```

---

### FILE: `backend/app/core/database.py`

```python
"""Async SQLAlchemy engine & session factory."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import text

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency: yields an async DB session."""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


async def ping_db() -> bool:
    """Return True if the database is reachable."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
```

---

### FILE: `backend/docs/btree_gist_extension.md`

```markdown
# btree_gist PostgreSQL extension requirement
# 
# Required for the concurrent leave overlap exclusion constraint in Phase 1.
# Run this SQL on your PostgreSQL instance before applying migrations:
#
#   CREATE EXTENSION IF NOT EXISTS btree_gist;
#
# This extension enables the GiST index on daterange columns needed for:
#   ALTER TABLE leave_applications
#   ADD CONSTRAINT no_overlapping_approved_leave
#   EXCLUDE USING gist (
#       employee_id WITH =,
#       daterange(from_date, to_date, '[]') WITH &&
#   ) WHERE (status IN ('SUBMITTED','UNDER_REVIEW','APPROVED'));
#
# Note: btree_gist is included in the standard PostgreSQL contrib package.
# Docker: the postgres:16-alpine image includes it by default.
# Windows: included with the standard PostgreSQL 16 installer.
```

---

### FILE: `backend/tests/conftest.py`

```python
"""Test configuration and shared fixtures."""

# Add fixtures here as models are built in Phase 1+
```

---

### FILE: `backend/tests/integration/__init__.py`

```python
"""Placeholder integration tests — Phase 1+."""
```

---

### FILE: `backend/tests/load/__init__.py`

```python
"""Placeholder load test — Phase 8+."""
```

---

### FILE: `backend/tests/unit/test_placeholder.py`

```python
"""Placeholder unit test — ensures pytest runs."""


def test_pytest_works():
    assert True
```

---

### FILE: `deployment/OPS_RUNBOOK.md`

```markdown
# AIIMS HRMS — Operations Runbook
#
# For the Windows Server system administrator managing the HRMS deployment.
# Keep this document updated after any infrastructure changes.

---

## 1. SERVICE MANAGEMENT

### Check service status
```powershell
nssm status AIIMS_HRMS
# Or via services.msc → find "AIIMS HRMS"
```

### Start / Stop / Restart
```powershell
nssm start AIIMS_HRMS
nssm stop AIIMS_HRMS
nssm restart AIIMS_HRMS
```

### View live logs
```powershell
Get-Content C:\aiims-hrms\logs\uvicorn_stdout.log -Tail 50 -Wait
```

---

## 2. LOG ROTATION

Logs are stored at `C:\aiims-hrms\logs\`.

### Automated rotation (PowerShell script, scheduled daily via Task Scheduler)

Save as `C:\aiims-hrms\deployment\rotate_logs.ps1`:

```powershell
$logDir = "C:\aiims-hrms\logs"
$maxSizeMB = 100
$retentionDays = 90

Get-ChildItem $logDir -Filter *.log | ForEach-Object {
    $sizeMB = $_.Length / 1MB
    if ($sizeMB -gt $maxSizeMB) {
        $archiveName = "{0}_{1:yyyyMMdd_HHmmss}.log.gz" -f $_.BaseName, (Get-Date)
        # Rotate: rename current, create fresh empty
        Move-Item $_.FullName "$logDir\$archiveName"
        New-Item $_.FullName -ItemType File
        Write-Host "Rotated: $($_.Name) → $archiveName"
    }
}

# Delete archives older than retention period
Get-ChildItem $logDir -Filter *.log.gz | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-$retentionDays)
} | Remove-Item -Force
```

**Schedule:** Windows Task Scheduler → Daily at 02:00 IST.

---

## 3. CRASH RECOVERY

NSSM is configured with:
- `AppRestartDelay = 5000` (5-second delay between restart attempts)
- Default restart action on exit

**If the service stays down (3+ consecutive crashes within 60s):**
1. Check `C:\aiims-hrms\logs\uvicorn_stderr.log` for the error.
2. Common causes:
   - Database unreachable → Check PostgreSQL service.
   - Port conflict → `netstat -ano | findstr :8000`.
   - `.env` missing or misconfigured → Verify all keys are set.
3. Fix the root cause, then: `nssm start AIIMS_HRMS`.

---

## 4. SSL CERTIFICATE RENEWAL

Self-signed certificates expire after 365 days.

### Generate new cert
```powershell
# Run as Administrator
cd C:\nginx\conf

# Backup old certs
copy server.crt server.crt.bak
copy server.key server.key.bak

# Generate new
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout server.key -out server.crt `
  -subj "/C=IN/ST=Telangana/L=Bibinagar/O=AIIMS/CN=aiims-hrms"

# Restart Nginx
nginx -s reload
```

**Schedule:** Annual reminder set in Windows Task Scheduler (30 days before expiry).

The `renew_cert.bat` script at `C:\aiims-hrms\deployment\renew_cert.bat` automates this.

### Install cert on client machines
1. Browse to `https://<server-ip>`.
2. Click "Advanced" → "Proceed to server".
3. Click padlock → "Certificate" → "Install Certificate".
4. Choose "Trusted Root Certification Authorities".

---

## 5. BACKUP & RESTORE

### Automated backup (daily, via Task Scheduler)

Save as `C:\aiims-hrms\deployment\backup_db.ps1`:

```powershell
$backupDir = "C:\aiims-hrms\backups"
$date = Get-Date -Format "yyyyMMdd_HHmm"
$backupFile = "$backupDir\aiims_hrms_$date.sql.gz"

# Ensure backup directory exists
New-Item -ItemType Directory -Force -Path $backupDir

# Dump + compress + encrypt
$env:PGPASSWORD = "aiims_hrms"
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" `
    -h localhost -U aiims_hrms -d aiims_hrms `
    --no-owner --no-acl | gzip | `
    gpg --symmetric --batch --passphrase "CHANGE_ME_BACKUP_KEY" `
    -o "$backupFile.gpg"

Write-Host "Backup complete: $backupFile.gpg"

# Delete backups older than 30 days
Get-ChildItem $backupDir -Filter *.gpg | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-30)
} | Remove-Item -Force
```

### Manual backup
```powershell
pg_dump -h localhost -U aiims_hrms -d aiims_hrms -Fc -f backup_manual.dump
```

### Restore
```powershell
# First: stop the HRMS service
nssm stop AIIMS_HRMS

# Drop and recreate (CAUTION: destroys existing data)
dropdb -h localhost -U postgres aiims_hrms
createdb -h localhost -U postgres aiims_hrms

# Restore
pg_restore -h localhost -U aiims_hrms -d aiims_hrms backup_manual.dump

# Run migrations (in case backup was from an older version)
cd C:\aiims-hrms\backend
alembic upgrade head

# Restart
nssm start AIIMS_HRMS
```

### Weekly restore verification
**Schedule:** Every Sunday 03:00 IST.
1. Restore latest backup to `aiims_hrms_verify` (separate temp DB).
2. Run: `SELECT COUNT(*) FROM employees; SELECT COUNT(*) FROM leave_applications;`
3. Compare row counts against production.
4. Drop `aiims_hrms_verify`.
5. Log result to `C:\aiims-hrms\logs\backup_verify.log`.

---

## 6. HEALTH MONITORING

### In-app health dashboard
Visit `https://<server-ip>/health` or use the admin dashboard (Phase 8) for:
- DB pool usage
- Queue depth
- Recent error rate
- Last backup time

### Manual health check
```powershell
curl http://127.0.0.1:8000/health
# Expected: {"status":"ok","database":"connected","version":"0.1.0"}
```

### Key things to watch
| Metric | Warning threshold | Action |
|--------|------------------|--------|
| DB pool exhausted | `max_overflow` reached | Restart service; consider increasing pool |
| Email queue > 100 PENDING | Queue growing | Check Zoho SMTP connectivity |
| Disk space < 10% free | Running low | Clean logs/backups; expand disk |
| Uvicorn restart loop | 3+ crashes/60s | Check stderr log; escalate to dev team |

---

## 7. DATA RETENTION CLEANUP

Schedule these as Windows Task Scheduler jobs:

| Data | Retention | Cleanup |
|------|-----------|---------|
| Notification queue | 90 days | Daily SQL: `DELETE FROM notification_queue WHERE created_at < NOW() - INTERVAL '90 days'` |
| Export files | 1 year | PowerShell: delete files older than 365d in `C:\aiims-hrms\exports\` |
| Token blacklist | Auto-clean | Nightly APScheduler job deletes expired rows |
| Audit logs | 7 years | Partitioned by year; no deletion needed before 7 years |

---

## 8. EMERGENCY CONTACTS

| Role | Contact | When to call |
|------|---------|-------------|
| Development team | [TBD] | Bugs, crashes, data issues |
| IT / Network | [TBD] | Server down, network issues |
| Establishment Officer | [TBD] | Leave data questions, UAT sign-off |
| Dean Academic Office | [TBD] | Resident leave policy questions |

---

*Last updated: 2026-06-17 — Phase 0 scaffolding.*
```

---

### FILE: `deployment/ROLLBACK.md`

```markdown
# AIIMS HRMS — Rollback Procedure
#
# Use this when a deployment causes issues and you need to revert.
# All steps are manual and must be performed on the Windows Server.

---

## WHEN TO ROLLBACK

Trigger a rollback if any of the following occur after deployment:
- Health check fails (`/health` returns non-200).
- Login is broken for all users.
- Leave application submission fails (critical workflow).
- Data corruption detected (incorrect balances).
- Any UAT-critical feature is broken and a hotfix is not available within 1 hour.

---

## ROLLBACK STEPS

### Step 1: Stop Services
```powershell
nssm stop AIIMS_HRMS
nginx -s stop
```

### Step 2: Revert Database (if migration was applied)

Identify the migration to revert:
```bash
cd C:\aiims-hrms\backend
alembic current    # Shows current revision
alembic history    # Shows migration chain
```

Downgrade to the previous stable revision:
```bash
alembic downgrade <previous-stable-revision>
```

### Step 3: Revert Code

```powershell
cd C:\aiims-hrms
git fetch --tags
git checkout <previous-stable-tag>   # e.g., v0.3.0
```

Or revert to a specific commit:
```powershell
git checkout <commit-hash>
```

### Step 4: Revert Frontend

```powershell
cd C:\aiims-hrms\frontend
git checkout <previous-stable-tag>
npm install
npm run build
# Verify: dist/ directory is populated with new build
```

### Step 5: Restore Database Backup (if data corruption)

⚠️ **Only if Step 2 downgrade is not sufficient.** This replaces the entire database.

```powershell
# Verify backup exists
ls C:\aiims-hrms\backups\

# Stop service if still running
nssm stop AIIMS_HRMS

# Restore (see OPS_RUNBOOK.md for full restore procedure)
# ...
```

### Step 6: Restart Services
```powershell
nssm start AIIMS_HRMS
nginx
```

### Step 7: Verify
```powershell
curl http://127.0.0.1:8000/health
# Expected: {"status":"ok",...}
```
Test login, leave application, and approval in browser.

---

## ROLLBACK DECISION MATRIX

| Issue | Action |
|-------|--------|
| Migration failed to apply | Downgrade → fix migration → re-deploy |
| Migration applied but app errors | Downgrade migration → revert code → restart |
| Code regression (no migration) | Revert code → restart |
| Frontend regression | Revert frontend build → rebuild |
| Data corruption | Restore DB backup → revert code → restart |
| Server crash / hardware failure | Restore DB backup on spare server → deploy → DNS/network cutover |

---

## POST-ROLLBACK

1. Document the issue, root cause, and resolution.
2. Create a Git issue for the fix.
3. Do NOT re-deploy the broken version until the fix is tested.
4. Notify all stakeholders of the rollback and estimated fix timeline.

---

## GIT TAGS (Release Reference)

| Tag | Description | Status |
|-----|-------------|--------|
| v0.1.0 | Phase 0-1: Scaffolding + Schema | Planned |
| v0.2.0 | Phase 2-3: Auth + Leave Config | Planned |
| v0.3.0 | Phase 4-5: Leave App + Balances | Planned |
| v0.4.0 | Phase 6-8: Notifications + Admin + Reports | Planned |
| v1.0.0 | Phase 9: UAT + Go-Live | Planned |

---

*Last updated: 2026-06-17 — Phase 0 scaffolding.*
```

---

### FILE: `deployment/nginx.conf`

```nginx
# Nginx reverse proxy configuration for AIIMS HRMS (Windows Server)
#
# Place at: C:\nginx\conf\nginx.conf (or your Nginx install path)
#
# Serves:
#   - Frontend static files from dist/
#   - Backend API proxied to Uvicorn on port 8000
#   - HTTP → HTTPS redirect
#   - Security headers

worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile        on;
    keepalive_timeout  65;

    # Logging
    access_log  logs/access.log;
    error_log   logs/error.log  warn;

    # Gzip
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    # ── HTTP → HTTPS redirect ────────────────────────────────────────────
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # ── HTTPS server ─────────────────────────────────────────────────────
    server {
        listen 443 ssl;
        server_name _;

        # Self-signed cert (replace with real cert path)
        ssl_certificate      conf/server.crt;
        ssl_certificate_key  conf/server.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'" always;

        # Client max body size (10MB)
        client_max_body_size 10M;

        # ── Frontend static files ────────────────────────────────────────
        location / {
            root   C:/aiims-hrms/frontend/dist;
            index  index.html;
            try_files $uri $uri/ /index.html;
        }

        # ── API proxy to FastAPI/Uvicorn ──────────────────────────────────
        location /api/ {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 60s;
        }

        # ── Health check (bypasses frontend) ─────────────────────────────
        location /health {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;
        }
    }
}
```

---

### FILE: `deployment/nssm-config.txt`

```text
# NSSM Configuration for AIIMS HRMS FastAPI Service
#
# NSSM (Non-Sucking Service Manager) runs Uvicorn as a Windows background service.
# Download from: https://nssm.cc/
#
# Installation (run as Administrator in PowerShell):
#   1. Copy this file to a known location.
#   2. Run the commands below (replace paths as needed):
#
#   nssm install AIIMS_HRMS "C:\Python311\python.exe" "-m uvicorn main:app --host 127.0.0.1 --port 8000"
#   nssm set AIIMS_HRMS AppDirectory "C:\aiims-hrms\backend"
#   nssm set AIIMS_HRMS AppStdout "C:\aiims-hrms\logs\uvicorn_stdout.log"
#   nssm set AIIMS_HRMS AppStderr "C:\aiims-hrms\logs\uvicorn_stderr.log"
#   nssm set AIIMS_HRMS AppRestartDelay 5000
#   nssm set AIIMS_HRMS AppThrottle 1500
#   nssm set AIIMS_HRMS AppExit Default Restart
#   nssm set AIIMS_HRMS Start SERVICE_AUTO_START
#
#   # Start the service:
#   nssm start AIIMS_HRMS
#
#   # Check status:
#   nssm status AIIMS_HRMS
#
#   # View logs:
#   Get-Content C:\aiims-hrms\logs\uvicorn_stdout.log -Tail 50
#
#   # Uninstall:
#   nssm stop AIIMS_HRMS
#   nssm remove AIIMS_HRMS confirm
#
# Crash recovery:
#   - AppRestartDelay = 5000 (5 seconds between restart attempts)
#   - After 3 consecutive crashes within 60 seconds, service stops.
#     Email IT support manually or configure Windows Event trigger.

# Service name (used in all nssm commands)
SERVICE_NAME=AIIMS_HRMS

# Paths (update these for your Windows Server)
PYTHON_EXE=C:\Python311\python.exe
APP_DIR=C:\aiims-hrms\backend
LOG_DIR=C:\aiims-hrms\logs

# Uvicorn arguments
UVICORN_ARGS=-m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4

# Restart policy
RESTART_DELAY_MS=5000
THROTTLE_MS=1500
MAX_CONSECUTIVE_CRASHES=3
CRASH_WINDOW_SECONDS=60
```

---

### FILE: `frontend/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AIIMS HRMS — Bibinagar</title>
  </head>
  <body class="bg-[#F0F4F8] text-gray-900 antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### FILE: `frontend/package.json`

```json
{
  "name": "aiims-hrms-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,css}\""
  },
  "dependencies": {
    "@tanstack/react-query": "^5.60.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "zustand": "^5.0.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.15.0",
    "jsdom": "^25.0.0",
    "msw": "^2.6.0",
    "postcss": "^8.4.0",
    "prettier": "^3.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

---

### FILE: `frontend/postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

### FILE: `frontend/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
      },
    },
  },
  plugins: [],
};
```

---

### FILE: `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

---

### FILE: `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
```

---

### FILE: `frontend/src/App.tsx`

```typescript
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-primary-800">
            AIIMS HRMS — Bibinagar
          </h1>
          <span className="text-sm text-gray-500">v0.1.0</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="bg-white rounded-lg shadow p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">
        Human Resource Management System
      </h2>
      <p className="text-gray-600">
        AIIMS Bibinagar — Establishment & Dean Academic Office.
      </p>
      <div className="mt-6 flex gap-4">
        <a
          href="/api/v1/ping"
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition"
        >
          API Health Check
        </a>
      </div>
    </div>
  );
}

export default App;
```

---

### FILE: `frontend/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

### FILE: `frontend/src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

---

### FILE: `frontend/src/vite-env.d.ts`

```typescript
/// <reference types="vite/client" />
```

---

### FILE: `frontend/src/stores/index.ts`

```typescript
import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: { id: string; role: string; name: string } | null;
  setAuth: (token: string, user: AuthState['user']) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user }),
  clearAuth: () => set({ token: null, user: null }),
}));
```

---

### FILE: `frontend/src/test/App.test.ts`

```typescript
// Placeholder frontend test
import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('should pass a basic smoke test', () => {
    expect(true).toBe(true);
  });
});
```

---

### FILE: `frontend/src/test/setup.ts`

```typescript
// Test setup for Vitest + React Testing Library + MSW
import '@testing-library/jest-dom';

// MSW server can be imported here in later phases:
// import { server } from './mocks/server';
// beforeAll(() => server.listen());
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());
```

---

### FILE: `scripts/init_admin.py`

```python
#!/usr/bin/env python3
"""
AIIMS HRMS — Bootstrap the first ADMIN user.

Usage:
    cd backend && python ../scripts/init_admin.py

Reads DATABASE_URL_SYNC from .env. Creates the initial ADMIN user if none exists.
The temporary password is printed to stdout; force-reset is enforced on first login.
"""

import os
import sys
import uuid

# Add backend to path so we can import app.core.config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    from app.core.config import settings
except ImportError:
    print("ERROR: Cannot import app.core.config. Run from the project root.", file=sys.stderr)
    sys.exit(1)

try:
    import bcrypt
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session
    from sqlalchemy.exc import IntegrityError
except ImportError as e:
    print(f"ERROR: Missing dependency — {e}", file=sys.stderr)
    print("Install: pip install sqlalchemy bcrypt psycopg2-binary", file=sys.stderr)
    sys.exit(1)


def main():
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with Session(engine) as session:
        # Check if any ADMIN already exists
        existing = session.execute(
            text("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1")
        ).fetchone()

        if existing:
            print("ADMIN user already exists. Skipping creation.")
            return

        admin_id = str(uuid.uuid4())
        password = os.urandom(8).hex()  # 16-char random hex
        password_hash = bcrypt.hashpw(
            password.encode(), bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
        ).decode()

        try:
            session.execute(
                text("""
                    INSERT INTO users (id, username, password_hash, role, is_active, must_change_password)
                    VALUES (:id, :username, :password_hash, 'ADMIN', true, true)
                """),
                {
                    "id": admin_id,
                    "username": "admin",
                    "password_hash": password_hash,
                },
            )
            session.commit()
            print("=" * 60)
            print("  ADMIN user created successfully!")
            print(f"  Username : admin")
            print(f"  Password : {password}")
            print("  ⚠️  You will be forced to change this password on first login.")
            print("=" * 60)
        except IntegrityError:
            session.rollback()
            print("ADMIN user already exists (integrity check). Skipping.")
        except Exception as e:
            session.rollback()
            print(f"ERROR creating admin user: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
```

---

