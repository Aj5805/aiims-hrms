# ONBOARDING

Developer setup notes for working on AIIMS HRMS locally.

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Python | 3.11+ | Use the project venv |
| Node.js | 20+ | Needed for the frontend and Playwright |
| Docker | 24+ | Optional; only for compose-based dev PostgreSQL |
| Git | 2.40+ | Standard workflow |
| PostgreSQL client | 16+ | Useful for manual inspection |

## First-time setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd aiims-hrms
git checkout -b <your-branch>
```

### 2. Start a database

Use either a native local PostgreSQL instance or the compose setup:

```bash
docker compose up -d db test_db
```

### 3. Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
copy .env.example .env
```

Edit `.env` for local use and keep `COOKIE_SECURE=False` on plain HTTP.

### 4. Run migrations and seed data

```bash
alembic upgrade head
python seeds/run.py
python ../scripts/init_admin.py
```

### 5. Verify backend

```bash
uvicorn main:app --reload
```

Check `http://localhost:8000/health` and `http://localhost:8000/docs`.

### 6. Frontend setup

```bash
cd ../frontend
npm install
npm run dev
```

Check `http://localhost:5173`.

## Common commands

| Task | Command |
| --- | --- |
| Run backend | `cd backend && uvicorn main:app --reload` |
| Run frontend | `cd frontend && npm run dev` |
| Run backend unit tests | `cd backend && pytest tests/unit -v` |
| Run all backend tests | `cd backend && pytest -v` |
| Build frontend | `cd frontend && npm run build` |
| Lint Python | `cd backend && ruff check .` |
| Type-check Python | `cd backend && mypy app/` |

## Getting help

- Check `docs/INCIDENTS.md` for common failure modes.
- Check `docs/CONFIGURATION.md` for environment variables and guards.
- Check `docs/HRMS_IMPLEMENTATION_PLAN_FINAL_PATCHED_v3.md` for the full build spec.
