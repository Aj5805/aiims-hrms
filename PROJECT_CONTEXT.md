## Current State

- Repo root: `C:\Users\aiims\Desktop\FS\HRMS\aiims-hrms`
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
  - result: passed all 4 tests, including the new admin leave-account lookup/ledger scenario (J4)
- GitHub publish:
  - created remote repo `Aj5805/aiims-hrms`
  - pushed `main`
  - pushed tag `v0.1.0-dev`
  - result: remote wiring succeeded and local worktree remained clean

## Next Action

- Continue active development on `main` for now. Near release, split active work to a `dev` branch and hold the approved release line stable without disturbing `main` during cutover/release finalization.
