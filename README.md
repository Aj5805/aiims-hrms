# README

AIIMS HRMS is a leave-management and HR workflow system for AIIMS, built as a FastAPI backend with a React + TypeScript frontend on PostgreSQL. It covers institutional leave types, role-based approval chains, leave accounting, in-app notifications, reporting, and admin/audit workflows.

> **Status:** Functionally complete through Phase 8 plus notifications. Latest verified build: `0bbb590` with Playwright `6/6`, pytest `42 passed`, and `typecheck:e2e` green.

## Stack

- **Backend:** FastAPI, SQLAlchemy async, Alembic, APScheduler
- **Database:** PostgreSQL with `asyncpg` for app traffic and `psycopg2` for sync tooling
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Auth:** JWT access token plus httpOnly refresh cookie, bcrypt hashing
- **Production serving:** nginx and uvicorn under NSSM

## Repository layout

```text
backend/
  app/            # API, auth, core config, services
  alembic/        # migrations
  seeds/          # versioned seed data
  tests/          # pytest suites and proof harnesses
  tools/          # one-off diagnostics/utilities
frontend/
  src/
    api/          # client + endpoints
    pages/        # UI screens
    test/e2e/     # Playwright journeys
deployment/       # nginx, rollback, ops assets
docs/             # architecture, config, ops, security, runbooks
scripts/          # repo-level helper scripts
```

## Quickstart

**Prerequisites:** Python 3.11, Node.js, and PostgreSQL.

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe seeds\run.py
.\.venv\Scripts\python.exe ..\scripts\init_admin.py
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

For local HTTP development, keep `APP_ENV=development` and `COOKIE_SECURE=False` in `backend/.env`, or the refresh cookie will not persist.

```powershell
cd frontend
npm install
npm run dev
```

Health check: `GET http://127.0.0.1:8000/health` should return `200 {"status":"ok","database":"connected","version":"0.1.0"}`.

## Test and demo accounts

`backend/seeds/versions/007_test_users.py` creates one account per role and auto-skips itself when `APP_ENV=production`. Default password is `password`; the seeded `staff` user is forced through a first-login password change and then uses `NewPassword123!`.

## Roles and approval chains

Roles: `STAFF`, `HOD`, `ESTABLISHMENT_OFFICER`, `REGISTRAR`, `DEAN_ACADEMIC`, `DIRECTOR`, `ADMIN`

- Regular employee: `HOD -> ESTABLISHMENT_OFFICER -> REGISTRAR`
- Resident: `HOD -> DEAN_ACADEMIC`

## Documentation index

- `docs/ARCHITECTURE.md` - system design, data model, request/workflow flows
- `docs/CONFIGURATION.md` - environment variables and boot guards
- `docs/SECURITY.md` - auth, lockout, rate limiting, upload validation
- `docs/TESTING.md` - pytest, Playwright, and proof harnesses
- `docs/OPERATIONS.md` - day-2 service, logs, backup, deploy guidance
- `docs/INCIDENTS.md` - symptom to cause to fix runbook
- `docs/DECISIONS.md` - architecture decision log
- `docs/ONBOARDING.md` - developer setup details
- `docs/MASTER_PLAN_AND_PATH_FORWARD.md` - current path-forward checklist
- `docs/HRMS_IMPLEMENTATION_PLAN_FINAL_PATCHED_v3.md` - full build spec
- `docs/GO_LIVE_RUNBOOK.md` - production cutover
- `CHANGELOG.md` - build history

## Testing in one pass

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q

cd ..\frontend
npx playwright test --project=chromium
npm run typecheck:e2e
```
