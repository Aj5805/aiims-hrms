# OPERATIONS

Day-2 operations for the production deployment (Windows, PostgreSQL 16, nginx, NSSM). For the initial cutover, use `docs/GO_LIVE_RUNBOOK.md`; this doc covers post-launch operations.

## Service management

The backend runs as Windows service `AIIMS_HRMS`.

```powershell
nssm status AIIMS_HRMS
nssm start AIIMS_HRMS
nssm restart AIIMS_HRMS
nssm stop AIIMS_HRMS
```

The service command must include:

```text
main:app --host 127.0.0.1 --port 8000 --workers 4 --proxy-headers --forwarded-allow-ips 127.0.0.1
```

Those proxy flags are mandatory for correct rate limiting; see `docs/SECURITY.md`.

## nginx

```powershell
C:\nginx\nginx.exe -p C:\nginx -t -c conf\nginx.conf
start C:\nginx\nginx.exe
C:\nginx\nginx.exe -s reload
C:\nginx\nginx.exe -s stop
```

In PowerShell, nginx can emit its startup banner on stderr even on success. Confirm the process table with `tasklist | findstr nginx` instead of trusting the exit code alone.

## Health monitoring

- External check: `GET https://<hostname>/health`
- On-box check: `curl http://127.0.0.1:8000/health`
- Alert on non-200 or `database != connected`

## Backups

- `C:\aiims-hrms\deployment\backup_db.ps1` wraps `pg_dump`
- Schedule it daily
- Periodically verify a restore into a scratch database

## Logs

- uvicorn stdout/stderr: `C:\aiims-hrms\logs\uvicorn_stdout.log` and `C:\aiims-hrms\logs\uvicorn_stderr.log`
- `C:\aiims-hrms\deployment\rotate_logs.ps1` rotates them; schedule daily, for example 02:00 IST

## Deploying an update

```powershell
nssm stop AIIMS_HRMS
cd C:\aiims-hrms
git pull
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
cd ..\frontend
npm install
npm run build
nssm start AIIMS_HRMS
```

Smoke test afterward: `/health`, login, and one real workflow journey.

## Rollback

See `deployment/ROLLBACK.md`: stop service and nginx, roll schema back if needed, check out the prior commit or tag, rebuild frontend, restart, verify `/health`. Release tags do not exist yet, so use commit hashes for now.

## Enabling email later

Set `EMAIL_SENDING_ENABLED=True` plus `ZOHO_EMAIL` and `ZOHO_APP_PASSWORD` in `.env`, then restart `AIIMS_HRMS`. No worker-count change is needed because the sender uses an advisory lock.

## Monitoring handover

The intended end-state is a continuous monitoring agent that watches `/health`, uvicorn logs, service status, and backup success, and follows `docs/INCIDENTS.md` for known failures.
