## Current State

- Repo root: `C:\Users\aiims\Desktop\FS\HRMS\aiims-hrms`
- Phase 8 security hardening now covers the planned lockout, password policy, rate limiting, and import upload validation:
  - DB-backed login lockout is live via `users.failed_login_attempts` and `users.locked_until`; `/api/v1/auth/login` now locks after 5 failed attempts for 15 minutes, persists the failure-path updates across workers, and resets the counters on successful login;
  - password complexity is enforced through one shared schema validator for both admin reset and self-change flows: minimum 8 chars, at least 1 uppercase, 1 digit, and 1 special;
  - `slowapi` is wired in `main.py`; `/auth/login` and `/auth/refresh` use `RATE_LIMIT_AUTH`, report exports use `RATE_LIMIT_EXPORT`, and the app has a general default limit with an explicit comment that the in-memory storage is per-process under `uvicorn --workers 4`;
  - upload validation is now enforced only on the two import endpoints that actually exist: `employees/import` (`.csv`, csv content-type, <= 5 MB) and `leave-balances/opening/import` (`.xlsx`, openxml spreadsheet content-type, <= 5 MB);
  - attachment-upload whitelisting for PDF/JPG/PNG remains intentionally deferred because there is still no user-facing attachment upload endpoint in this repo.
- Phase 6/7/8 surfacing and backend hardening are now aligned for the live report/admin slice:
  - report routes now enforce the exact plan gates: `leave-register`, `leave-abstract`, `pending-applications`, `balance-summary`, and `leave-calendar` are restricted to `ESTABLISHMENT_OFFICER` / `REGISTRAR` / `DIRECTOR`; `payroll-export` now also allows `REGISTRAR` / `DIRECTOR` and excludes `ADMIN`;
  - locked report outputs now stream real files: leave register (`xlsx` and `pdf` with actual approval timestamp), category-wise summary (`xlsx`), pending aged applications (`pdf` with current approver), payroll export (`csv` with a clearly marked NIC-mapping placeholder), plus workbook exports for balance summary and leave calendar;
  - the previous department/type aggregate was retained separately at `GET /api/v1/reports/leave-abstract-department`;
  - admin APIs now support `from_date` / `to_date` on `audit-log` and expose `last_backup` plus explicit `error_rate` on `health-dashboard`;
  - frontend reports/admin pages now target the corrected file outputs and filters, and Playwright J5 asserts the leave-register download is an `xlsx`.
- Phase 5 leave accounts are now audited, implemented, and verified on `main` at commit `afccf15` (`Implement and verify phase 5 leave accounts`):
  - backend `leave-balances` now enforces employee scope on balance, ledger, and projection reads;
  - annual credit now handles both EL and HPL financial-year credits and is idempotent;
  - carry-forward now follows `leave_types.carry_forward` and enforces the EL 300 cap through policy data;
  - manual-adjust requires reason, writes audit rows, and is surfaced in the derived ledger;
  - projection now returns cached/fresh state with a 5-minute in-memory TTL;
  - frontend leave-account page now supports staff self-view plus admin/establishment lookup of any employee, expandable ledger, and inline manual adjustment;
  - frontend year-end page now wires annual credit, carry-forward, and manual-adjust actions with role gating.
- The deployment dry-run remains closed and the checked-in Windows nginx path is still valid:
  - `deployment/nginx.conf` uses absolute cert paths `C:/nginx/conf/server.crt` and `C:/nginx/conf/server.key`
  - `C:\nginx\nginx.exe -p C:\nginx -t -c conf\nginx.conf` passes with the checked-in config
- The production go-live run book in `docs/aiims hrms production go live run book.txt` has been updated to match the real verified Phase 5 state and the actual remaining launch constraints.
- GitHub remote is now live:
  - repository: `https://github.com/Aj5805/aiims-hrms`
  - current development continues on `main`
  - current pushed development tag: `v0.1.0-dev`

## Validation Run

- Backend Phase 8 security proof:
  - `backend`: `$env:APP_ENV='test'; .\.venv\Scripts\python.exe -m alembic downgrade base; .\.venv\Scripts\python.exe -m alembic upgrade head; .\.venv\Scripts\python.exe -m seeds.run; .\.venv\Scripts\python.exe test_phase8_security.py; .\.venv\Scripts\python.exe -m pytest tests/integration/test_auth_and_rbac.py::TestAuthFlow::test_lockout_after_5_failures -q`
  - result: passed; proved 6th-attempt lockout + successful reset, weak-password rejection, 6th `/auth/login` rate-limit 429, both import endpoints rejecting wrong type / oversize uploads, and the real integration lockout test now passing
- Backend Phase 7/8 proof:
  - `backend`: `$env:APP_ENV='test'; .\.venv\Scripts\python.exe -m seeds.run; .\.venv\Scripts\python.exe test_phase678_reports.py`
  - result: passed; proved the locked report content types/non-empty bodies, the corrected report role gates with 200/403 checks, and the new `audit-log` date filter / `health-dashboard` field surface
- Backend clean-schema proof:
  - `backend`: `.venv\Scripts\python.exe -m alembic downgrade base`
  - `backend`: `.venv\Scripts\python.exe -m alembic upgrade head`
  - `backend`: `.venv\Scripts\python.exe seeds\run.py`
  - `backend`: `.venv\Scripts\python.exe ..\scripts\init_admin.py`
  - `backend`: `.venv\Scripts\python.exe test_phase5_leave_balances.py`
  - result: passed; proved annual credit, carry-forward cap/policy, manual-adjust audit+ledger, and projection non-mutation/cache behavior
- Frontend build and typed e2e compile:
  - `frontend`: `npm.cmd run build`
  - `frontend`: `npm.cmd run typecheck:e2e`
  - result: both passed
- Frontend Playwright regression:
  - `frontend`: `npx.cmd playwright test --project=chromium`
  - result: passed all 5 tests, including the new establishment reports download scenario (J5)
- GitHub publish:
  - created remote repo `Aj5805/aiims-hrms`
  - pushed `main`
  - pushed tag `v0.1.0-dev`
  - result: remote wiring succeeded and local worktree remained clean

## Next Action

- The next concrete deferred item is still the real AIIMS Finance / NIC payroll column contract; once Finance provides it, replace the placeholder payroll mapping dict without changing the Phase 7 route shape again.
