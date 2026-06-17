## Current State

- Repo root: `C:\Users\aiims\Desktop\FS\HRMS\aiims-hrms`
- Frontend production build is unblocked:
  - `frontend/src/test/e2e/core_journeys.spec.ts` now uses the captured J1 application number in a real assertion (`HRMS/2026/<digits>` format).
  - The captured leave-apply request body is explicitly typed and asserts `employee_id` as a non-empty UUID-shaped value instead of relying on `never` inference.
  - `frontend/tsconfig.json` excludes `src/test`, and `frontend/tsconfig.e2e.json` plus `package.json -> typecheck:e2e` keep the e2e suite strictly type-checked outside the production bundle path.
- A first local git baseline now exists on `main`:
  - commit: `09894f29cf3936e1b1054bf603b35d4b76a1eed9` (`chore: baseline repository snapshot`)
  - `.gitignore` covers local env/runtime outputs including `.venv/`, `node_modules/`, `frontend/dist/`, `frontend/test-results/`, `backend/test-results/`, `*.png`, `.env` (while preserving `.env.example`), `uploads/`, `logs/`, and local PostgreSQL data dirs.
- The prod-like HTTPS dry-run completed successfully on the local machine:
  - official nginx Windows ZIP was installed to `C:\nginx`
  - a self-signed cert was generated under `C:\nginx\conf\server.crt` / `server.key`
  - uvicorn was run with production env against PostgreSQL on `localhost:5433`
  - nginx terminated HTTPS and proxied to the backend successfully
- The repo nginx config now matches the working Windows deployment shape:
  - `deployment/nginx.conf` uses absolute cert paths `C:/nginx/conf/server.crt` and `C:/nginx/conf/server.key`
  - `C:\nginx\nginx.exe -p C:\nginx -t -c conf\nginx.conf` passes with the checked-in config

## Validation Run

- Frontend strict type checks:
  - `frontend`: `npm.cmd run typecheck:e2e`
  - result: passed
- Frontend production build:
  - `frontend`: `npm.cmd run build`
  - result: passed and produced `frontend/dist`
- Prod-like backend/bootstrap:
  - `backend`: `.venv\Scripts\python.exe -m alembic upgrade head`
  - `backend`: `.venv\Scripts\python.exe seeds\run.py`
  - `backend`: `.venv\Scripts\python.exe ..\scripts\init_admin.py`
  - result:
    - schema upgrade succeeded
    - production seeding skipped `007_test_users.py` as intended
    - admin row already existed
- HTTPS proxy smoke through nginx:
  - `https://localhost/health`
  - result: `200 {"status":"ok","database":"connected","version":"0.1.0"}`
- HTTPS auth smoke through nginx:
  - `POST https://localhost/api/v1/auth/login` as `admin`
  - `GET https://localhost/api/v1/auth/me`
  - `POST https://localhost/api/v1/auth/change-my-password`
  - re-login as `admin`
  - result:
    - initial login returned `must_change_password=true`
    - authenticated `/api/v1/auth/me` returned real user data
    - self password change succeeded
    - re-login returned `must_change_password=false`
    - refresh cookie `Set-Cookie` included `Secure`
- Teardown:
  - nginx stopped
  - uvicorn workers stopped
  - the local PostgreSQL process on `localhost:5433` stopped
  - repo working tree returned clean (`git status --short` empty)

## Next Action

- If a fuller production smoke is needed beyond admin auth, seed or create production-safe workflow users explicitly, then run the apply -> approve -> balance journey over the proxied UI.
