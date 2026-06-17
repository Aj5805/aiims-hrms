## Current State

- Repo root: `C:\Users\aiims\Desktop\FS\HRMS\aiims-hrms`
- Backend production config parsing is hardened:
  - `backend/app/core/config.py` now uses `pydantic-settings` `NoDecode` on `CORS_ORIGINS`, so comma-separated/plain env values like `https://localhost` load correctly in `APP_ENV=production`.
  - `backend/tools/verify_config_guards.py` now tests the supported plain/comma env form instead of JSON array strings.
- Deployment docs/config were updated:
  - `backend/.env.example` documents `COOKIE_SECURE=False` and that HTTPS/production must set it to `True`.
  - `deployment/OPS_RUNBOOK.md` warns that the APScheduler email job is not started today and must run in only one worker/process when enabled.
  - `backend/main.py` and `deployment/nginx.conf` had low-risk mojibake/comment cleanup only.
- Local prod-like PostgreSQL 16 on `localhost:5433` was brought up successfully and the `aiims_hrms` role/database were confirmed.

## Validation Run

- Config guard verification:
  - `backend`: `.venv\Scripts\python tools\verify_config_guards.py`
  - result:
    - production + short JWT secret -> refused
    - production + `CORS_ORIGINS=*` -> refused
    - production + strong JWT + explicit origin -> loaded successfully
- Plain production env proof:
  - `backend`: `Settings(_env_file=None)` with `APP_ENV=production`, strong `JWT_SECRET`, `COOKIE_SECURE=True`, `CORS_ORIGINS=https://localhost`
  - result: loaded successfully with `CORS_ORIGINS == ['https://localhost']`
- Negative production boot:
  - `backend`: `python -m uvicorn main:app --host 127.0.0.1 --port 8000` with production env and placeholder JWT secret
  - result: refused correctly on `JWT_SECRET must be explicitly set to a strong value outside local/test development`
- Prod-like DB setup:
  - `backend`: `python -m alembic upgrade head`
  - `backend`: `python -m seeds.run`
  - `backend`: `python ..\scripts\init_admin.py`
  - result:
    - schema upgrade succeeded
    - `007_test_users.py` logged `Skipping test users in production environment.`
    - `init_admin.py` logged `ADMIN user already exists. Skipping creation.`
- Frontend production build:
  - `frontend`: `npm.cmd run build`
  - result: failed before nginx/proxy smoke could start
  - real errors:
    - `src/test/e2e/core_journeys.spec.ts(19,7): error TS6133: 'appNumber' is declared but its value is never read.`
    - `src/test/e2e/core_journeys.spec.ts(59,34): error TS2339: Property 'employee_id' does not exist on type 'never'.`

## Next Action

- Fix the frontend TypeScript build blockers in `frontend/src/test/e2e/core_journeys.spec.ts`, then rerun the production dry-run from the frontend build step onward:
  - `npm.cmd run build`
  - stage/copy `frontend/dist` for nginx
  - create/check self-signed certs
  - start `uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4`
  - start nginx with `deployment/nginx.conf`
  - smoke `https://localhost` for `/health`, admin forced password change, authenticated proxy flow, and `Secure` refresh cookie
  - tear down nginx, uvicorn, and the PG16 cluster
