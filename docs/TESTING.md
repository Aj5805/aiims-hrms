# TESTING

How to run and interpret the test suites.

## Test layers

| Layer | Tool | Location | Scope |
| --- | --- | --- | --- |
| Unit | pytest | `backend/tests/unit/` | Leave rules, employee validation, roles, attendance helpers |
| Integration | pytest | `backend/tests/integration/` | Auth/RBAC, reports, security, leave balances |
| API harness | pytest | `backend/tests/e2e_test.py` | Full leave workflow via ASGI |
| Component | Vitest | `frontend/src/test/` | Auth flow, workMode, employeeForm helpers |
| Browser journeys | Playwright | `frontend/src/test/e2e/core_journeys.spec.ts` | Login, apply, approve, reports, notifications |

## Journey test users (does not purge manual data)

```powershell
cd backend
.\.venv\Scripts\python.exe tools\ensure_e2e_users.py
```

Creates `staff` / `hod` / `nodal` (password `password`) plus `TEST_STAFF` employee with opening EL balance. Playwright globalSetup runs this automatically.

Admin login remains `admin` / `password`.

## Running tests

```powershell
# Backend unit (fast — run on every change)
cd backend
.\.venv\Scripts\python.exe -m pytest tests/unit -q

# Backend integration (needs PostgreSQL)
.\.venv\Scripts\python.exe -m pytest tests/integration -q

# Full backend including E2E harness
.\.venv\Scripts\python.exe -m pytest -q

# Frontend component tests
cd ..\frontend
npm run test

# Playwright (starts backend + frontend; uses journey users above)
npx playwright test --project=chromium
npm run typecheck:e2e
```

## Optional sample staff seed

**Default:** `python seeds/run.py` does **not** add demo employees. Owner adds staff via the onboard form only.

To load 20 named demo staff (Dr. Ananya Sharma, etc.):

```powershell
cd backend
.\.venv\Scripts\python.exe scripts/purge_test_data.py --reseed
# or: $env:SEED_SAMPLE_STAFF=1; .\.venv\Scripts\python.exe seeds/run.py
```

To wipe all employees except admin first: set `PURGE_DEV_STAFF=1` before running seeds (destructive — use only when you want a clean slate).

To remove agent/demo rows but keep your `test*` staff: `python scripts/purge_non_test_staff.py`.

## Core Playwright journeys (`J1`–`J6`)

| ID | Journey |
| --- | --- |
| `J1` | Staff login, password change, apply leave |
| `J2` | HOD → Nodal Officer approval chain |
| `J3` | Staff checks balance after approval |
| `J4` | Admin views employee ledger |
| `J5` | Nodal officer exports leave register |
| `J6` | Notification bell mark-read |

Approval workflow is **two steps**: `HOD → NODAL_OFFICER` (legacy Establishment/Registrar roles removed).

## CI

GitHub Actions runs backend unit tests and frontend Vitest on every push/PR (`.github/workflows/ci.yml`). Integration and Playwright remain local/pre-release checks until a shared test database is wired in CI.
