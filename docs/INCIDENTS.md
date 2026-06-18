# INCIDENTS

Symptom to cause to fix runbook for failure modes already seen in this repo. Pair it with `docs/OPERATIONS.md`.

## Auth and login

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Redirect loop right after a forced password change | Old access token was invalidated by `tokens_valid_from`, but the client kept using it | Fixed in `0bbb590`: the endpoint now returns fresh tokens and the SPA stores them. If it recurs, confirm the frontend calls `setAuth(data.access_token, data.user)` |
| Login works in prod but not on local `http://localhost` | `COOKIE_SECURE=True` over plain HTTP | Set `COOKIE_SECURE=False` for local development |
| All users get rate-limited together | uvicorn is missing `--proxy-headers --forwarded-allow-ips 127.0.0.1` | Add both flags to the service command |
| A reseeded test account stays locked | Stale `failed_login_attempts` or `locked_until` | Rerun the test-user seed; for real users, clear those fields in `users` |

## Database and migrations

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| App cannot connect to DB | Wrong port or credentials in `DATABASE_URL` | Confirm the target cluster and port; local dry-runs have used both `5432` and `5433` |
| `alembic upgrade head` fails because relations are missing | Schema was reset inconsistently | Use a clean rebuild path instead of partial manual recovery |
| Test DB is unreachable | Test database container or local instance is not running | If you use the Docker dev setup, run `docker compose up -d db test_db` |
| `409` appears on apply or approve paths after an earlier failure | Session was not rolled back before re-raising the conflict | Ensure the handler executes `await db.rollback()` before raising the `409` |
| Test users appear in production | Seed ran outside the intended environment | `007_test_users` should auto-skip when `APP_ENV=production`; confirm the "Skipping test users in production environment." log line |

## Backend startup and dependencies

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `ModuleNotFoundError: app` or import failures | Wrong interpreter or wrong working directory | Use `backend\\.venv\\Scripts\\python.exe` and start `main:app` from `backend/` |
| `pip install` fails on `bcrypt` or `psycopg2` | Old installer tooling | Run `python -m pip install --upgrade pip` and retry |
| Import errors after pulling | Editable/dev dependencies are missing | Run `pip install -e \".[dev]\"` inside `backend/` |
| App refuses to boot in production | Config guard tripped | Check `JWT_SECRET`, `CORS_ORIGINS`, and production-safe config in `docs/CONFIGURATION.md` |
| Scheduler appears idle | `EMAIL_SENDING_ENABLED=False` | Expected until email is deliberately enabled |

## nginx and proxying

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| nginx command reports "exit 1" but the site still works | PowerShell surfaced nginx stderr startup banner as an error | Validate with <code>tasklist | findstr nginx</code> |
| SPA loads but `/api` returns `502` | uvicorn service is down or unhealthy | Check `nssm status AIIMS_HRMS`, then inspect `C:\aiims-hrms\logs\uvicorn_stderr.log` |
| Frontend cannot reach backend in local dev | Proxy target mismatch or localhost resolution issue | Confirm backend is on port `8000` and try `127.0.0.1` instead of `localhost` if needed |

## Notifications

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Bell badge does not clear after mark-read | Optimistic update path got out of sync | Confirm the mark-read `PUT` returned `200`; the 60-second poll should reconcile it |
| Duplicate emails after enabling email | Sender lock was bypassed or removed | Confirm `pg_try_advisory_lock(123456789)` still guards `send_email_batch` |
