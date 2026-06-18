# TESTING

How to run and interpret the test suites. Current verified status at `0bbb590`: pytest `42 passed`, Playwright `6/6`, and `typecheck:e2e` green.

## Test layers

| Layer | Tool | Location | Scope |
| --- | --- | --- | --- |
| Unit and integration | pytest | `backend/tests/` | Core services, API behavior, report/admin/security proofs |
| API proof harness | pytest-backed script harness | `backend/tests/e2e_test.py` | Full backend workflow exercise through ASGI |
| Browser journeys | Playwright (chromium) | `frontend/src/test/e2e/core_journeys.spec.ts` | Real user journeys through the running stack |
| E2E type safety | `tsc` | `npm run typecheck:e2e` | Type-checks the Playwright specs |

## Clean rebuild before a full run

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic downgrade base
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe seeds\run.py
.\.venv\Scripts\python.exe ..\scripts\init_admin.py
```

## Running the suites

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q

cd ..\frontend
npx playwright test --project=chromium
npx playwright test --project=chromium -g "J6"
npm run typecheck:e2e
```

## Test users

`backend/seeds/versions/007_test_users.py` creates one user per role with password `password` and auto-skips itself when `APP_ENV=production`. It also resets `failed_login_attempts`, `locked_until`, and `tokens_valid_from` on reseed. The seeded `staff` user starts with `must_change_password=true` and changes to `NewPassword123!` on first login.

## Core journeys (`J1` to `J6`)

| ID | Journey |
| --- | --- |
| `J1` | Staff first login, forced password change, reaches the app |
| `J2` | Apply for leave |
| `J3` | HOD approval |
| `J4` | Establishment Officer approval |
| `J5` | Registrar final approval and balance deduction |
| `J6` | Notification bell flow: staff applies, HOD sees it, mark-read clears the badge |

The Playwright `login()` helper handles both the seeded password and the post-change password. Run the whole spec for a faithful regression because later journeys assume earlier state transitions have happened.

## What "verified end to end" means

A verified claim here means a clean rebuild plus full backend pytest and full Playwright, not a mocked component test or one isolated browser step.
