# AIIMS HRMS â€” Troubleshooting Guide

## Backend

### `uvicorn` fails with "could not translate host name"
**Cause:** PostgreSQL is not running or DATABASE_URL is wrong.
```bash
docker compose up -d db
docker compose ps
```

### `alembic upgrade head` fails with "relation does not exist"
```bash
alembic downgrade base
dropdb aiims_hrms && createdb aiims_hrms
alembic upgrade head
```

### `pip install` fails on `bcrypt` / `psycopg2`
**Fix (Windows):**
```bash
python -m pip install --upgrade pip
```

### Tests fail with "could not connect to test database"
```bash
docker compose up -d test_db    # Starts on port 5433
```

### Import errors after pulling
```bash
pip install -e ".[dev]"
```

## Frontend

### Playwright J6 / login helper gets stuck
**Symptom:** the J6 test hangs waiting for the login step or never reaches the apply-leave page.

**Root cause:** the seeded staff account starts with `must_change_password = true` and the initial password `password`. The test flow must handle the password-change screen before it can submit a leave application.

**Fix pattern:**
- Try the initial seeded password first.
- If the app redirects to the password-change screen, complete that flow.
- If the test is intentionally using the changed password later, fall back to that password only after the first attempt fails.

**Verified command:**
```bash
npx playwright test --project=chromium src/test/e2e/core_journeys.spec.ts -g "J6"
```

**Expected result:** `1 passed (9.0s)`

### `npm install` fails
```bash
node --version                   # Must be 20+
rm -rf node_modules package-lock.json
npm install
```

### Proxy errors (frontend can't reach backend)
- Ensure `uvicorn main:app --reload` is running on port 8000.
- Check `vite.config.ts` proxy target.
- For Windows: try `127.0.0.1` instead of `localhost`.

### Blank white screen
- Open DevTools â†’ Console for JS errors.
- Run `npm run build` to see TS compilation errors.

## Docker

### Port 5432 already in use
```bash
# Change port mapping in docker-compose.yml, or stop local PG:
sudo systemctl stop postgresql
```

## Windows Server (Production)

### Nginx won't start
- `nginx -t` for config errors.
- Port 80 may be used by IIS â€” stop via `services.msc`.

### NSSM service crashes
- Check NSSM Application tab: path to `python.exe` must be absolute.
- Run Uvicorn directly first to confirm it works.

### Certificate warning
Self-signed cert: open `https://<server-ip>` â†’ Advanced â†’ Install Certificate â†’ Trusted Root CA.