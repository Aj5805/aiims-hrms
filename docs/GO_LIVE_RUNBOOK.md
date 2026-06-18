# GO_LIVE_RUNBOOK

Everything up to go-live is proven: HTTPS deployment dry-run (termination to static SPA to API proxy to auth plus secure cookie, against the checked-in `deployment/nginx.conf`), Phase 5 leave accounts, Phase 7/8 reports and admin, Phase 8 security hardening, and the notification/auth fix in `0bbb590`. This runbook is the cutover to the real Windows plus PostgreSQL 16 server. Work top to bottom; do not skip Section 0.

## 0. Pre-go-live decisions (go / no-go)

Decide each consciously. These are known, deliberate gaps, not bugs:

- [ ] In-app notifications are live; email sending is gated off. Workflow events now enqueue and display in-app notifications end to end, independently code-verified in `0bbb590`. Email is fully wired (Zoho SMTP plus Jinja2 templates) but disabled by default behind `EMAIL_SENDING_ENABLED=False` and blank Zoho credentials, so no email sends until you set real creds and flip the flag. The poller is safe under `--workers 4` because a PostgreSQL advisory lock elects a single sender. Decision: launch in-app-only, or set `EMAIL_SENDING_ENABLED=True` plus Zoho credentials to turn email on.
- [ ] 5.6 resident pro-rata recompute is not implemented. There is still no contract-lifecycle event model or endpoint to recompute resident balances on contract completion or extension.
- [ ] Leave ledger is still schema-derived, not a dedicated immutable leave-transaction table. Fine for launch, but keep it flagged as future hardening.
- [ ] Git tags do not exist yet. `deployment/ROLLBACK.md` references release tags that still need to be created during cutover.
- [ ] Confirm the real access hostname. It is needed for the certificate CN, `CORS_ORIGINS`, and UAT URLs.

## 1. Prerequisites on the production server

- [ ] Windows server reachable with admin PowerShell
- [ ] PostgreSQL 16 installed and running; role and database `aiims_hrms` created
- [ ] Python 3.11 at `C:\Python311\python.exe`
- [ ] Node.js installed for frontend build
- [ ] nginx for Windows at `C:\nginx`
- [ ] NSSM installed
- [ ] Repo deployed to `C:\aiims-hrms`

## 2. Code and frontend build

```powershell
cd C:\aiims-hrms
git pull
cd C:\aiims-hrms\backend
py -3.11 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
cd C:\aiims-hrms\frontend
npm install
npm run build
```

## 3. Production `.env`

Copy `.env.example` to `.env` and set real production values:

```dotenv
APP_ENV=production
DATABASE_URL=postgresql+asyncpg://aiims_hrms:<STRONG_DB_PW>@localhost:5432/aiims_hrms
DATABASE_URL_SYNC=postgresql+psycopg2://aiims_hrms:<STRONG_DB_PW>@localhost:5432/aiims_hrms
JWT_SECRET=<RANDOM 32+ CHAR SECRET>
COOKIE_SECURE=True
CORS_ORIGINS=https://<real-hostname>
BCRYPT_ROUNDS=12
# Optional if enabling email
ZOHO_EMAIL=...
ZOHO_APP_PASSWORD=...
```

Production PG16 is expected on `5432`. Earlier dry-runs that used `5433` were isolated validation setups, not the production target.

## 4. Database: migrate, seed, bootstrap admin

```powershell
cd C:\aiims-hrms\backend
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe seeds\run.py
.venv\Scripts\python.exe ..\scripts\init_admin.py
```

- [ ] Confirm `007_test_users.py` logs `Skipping test users in production environment.`
- [ ] Record the real admin credentials securely; first login forces a password change.

## 5. nginx

Generate the production cert with the real CN, validate config, then start nginx:

```powershell
cd C:\nginx\conf
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout server.key -out server.crt `
  -subj "/C=IN/ST=Telangana/L=Bibinagar/O=AIIMS/CN=<real-hostname>"

C:\nginx\nginx.exe -p C:\nginx -t -c conf\nginx.conf
start C:\nginx\nginx.exe
```

## 6. Backend as a service

```powershell
nssm install AIIMS_HRMS "C:\Python311\python.exe" "-m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4 --proxy-headers --forwarded-allow-ips 127.0.0.1"
nssm set AIIMS_HRMS AppDirectory "C:\aiims-hrms\backend"
nssm set AIIMS_HRMS AppStdout "C:\aiims-hrms\logs\uvicorn_stdout.log"
nssm set AIIMS_HRMS AppStderr "C:\aiims-hrms\logs\uvicorn_stderr.log"
nssm set AIIMS_HRMS AppRestartDelay 5000
nssm set AIIMS_HRMS Start SERVICE_AUTO_START
nssm start AIIMS_HRMS
nssm status AIIMS_HRMS
```

The NSSM command must include `--proxy-headers --forwarded-allow-ips 127.0.0.1` so rate limiting keys off real client IPs behind nginx. Keeping `--workers 4` is correct even when email is enabled because the sender uses an advisory lock.

## 7. Go-live smoke

- [ ] `https://<hostname>/health` returns `200 {"status":"ok","database":"connected"}`
- [ ] `https://<hostname>/` serves the SPA and hashed `/assets/*` files return `200`
- [ ] Admin login, forced password change, and re-login succeed
- [ ] Refresh cookie carries `Secure`
- [ ] One regular-staff journey completes end to end: staff apply, HOD approve, ESTAB approve, REGISTRAR approve, balance updates
- [ ] Staff can load their own leave account
- [ ] Admin or establishment can search another employee and view balances plus ledger
- [ ] Manual adjustment with reason changes the balance and appears in the ledger
- [ ] Optional but recommended: run one projection call and confirm it changes only the projected value
- [ ] Confirm on-box service health with `curl http://127.0.0.1:8000/health`

## 8. Post-deploy hardening

- [ ] Create git tags so `deployment/ROLLBACK.md` becomes actionable
- [ ] Schedule `backup_db.ps1` daily
- [ ] Schedule `rotate_logs.ps1` daily at 02:00 IST
- [ ] Add a health-check task hitting `/health`
- [ ] Verify at least one backup restore into a scratch database

## 9. Rollback readiness

- [ ] Confirm the previous stable tag exists before cutover.
- [ ] Dry-read `deployment/ROLLBACK.md`: stop service plus nginx, downgrade Alembic if needed, check out the prior tag or commit, rebuild frontend, restart, and verify `/health`.

## 10. UAT sign-off

- [ ] Real users across all roles run their core journeys
- [ ] Capture issues; only mark `v1.0.0` after sign-off

## Roadmap still open after go-live

- Real email sending
- Resident pro-rata recompute
- Persisted leave-transaction ledger
- Audit `before_state` capture
