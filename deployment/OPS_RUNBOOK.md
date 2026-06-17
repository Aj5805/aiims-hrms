# AIIMS HRMS â€” Operations Runbook

## 1. SERVICE MANAGEMENT

```powershell
nssm status AIIMS_HRMS
nssm start AIIMS_HRMS
nssm stop AIIMS_HRMS
nssm restart AIIMS_HRMS
Get-Content C:\aiims-hrms\logs\uvicorn_stdout.log -Tail 50 -Wait
```

## 2. LOG ROTATION

Save as `C:\aiims-hrms\deployment\rotate_logs.ps1` and schedule daily at 02:00 IST:

```powershell
$logDir = "C:\aiims-hrms\logs"
$maxSizeMB = 100
$retentionDays = 90

Get-ChildItem $logDir -Filter *.log | ForEach-Object {
    $sizeMB = $_.Length / 1MB
    if ($sizeMB -gt $maxSizeMB) {
        $archiveName = "{0}_{1:yyyyMMdd_HHmmss}.log.gz" -f $_.BaseName, (Get-Date)
        Move-Item $_.FullName "$logDir\$archiveName"
        New-Item $_.FullName -ItemType File
    }
}
Get-ChildItem $logDir -Filter *.log.gz | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-$retentionDays)
} | Remove-Item -Force
```

## 3. CRASH RECOVERY

NSSM: `AppRestartDelay = 5000`. If 3+ crashes in 60s:
1. Check `C:\aiims-hrms\logs\uvicorn_stderr.log`
2. Common causes: DB unreachable, port conflict, missing `.env`
3. Fix, then: `nssm start AIIMS_HRMS`

## 4. SSL CERTIFICATE RENEWAL

```powershell
cd C:\nginx\conf
copy server.crt server.crt.bak
copy server.key server.key.bak
openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout server.key -out server.crt `
  -subj "/C=IN/ST=Telangana/L=Bibinagar/O=AIIMS/CN=aiims-hrms"
nginx -s reload
```

## 5. BACKUP & RESTORE

Daily backup script (`C:\aiims-hrms\deployment\backup_db.ps1`):

```powershell
$backupDir = "C:\aiims-hrms\backups"
$date = Get-Date -Format "yyyyMMdd_HHmm"
New-Item -ItemType Directory -Force -Path $backupDir
$env:PGPASSWORD = "aiims_hrms"
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" `
    -h localhost -U aiims_hrms -d aiims_hrms `
    --no-owner --no-acl -Fc -f "$backupDir\aiims_hrms_$date.dump"
Get-ChildItem $backupDir -Filter *.dump | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-30)
} | Remove-Item -Force
```

Restore:
```powershell
nssm stop AIIMS_HRMS
dropdb -h localhost -U postgres aiims_hrms
createdb -h localhost -U postgres aiims_hrms
pg_restore -h localhost -U aiims_hrms -d aiims_hrms backup_manual.dump
cd C:\aiims-hrms\backend && alembic upgrade head
nssm start AIIMS_HRMS
```

## 6. HEALTH MONITORING

```powershell
curl http://127.0.0.1:8000/health
# Expected: {"status":"ok","database":"connected","version":"0.1.0"}
```

Scheduler note:
`email_sender.start_email_scheduler` is not started in `main.py` right now, and email sending is still a stub. When this is enabled in production it must run in exactly one worker/process only; running it under `uvicorn --workers 4` without leader election or a dedicated scheduler process will produce duplicate sends.

| Metric | Warning threshold | Action |
|--------|------------------|--------|
| DB pool exhausted | max_overflow reached | Restart service |
| Email queue > 100 PENDING | Growing | Check Zoho SMTP |
| Disk space < 10% | Running low | Clean logs/backups |

## 7. DATA RETENTION

| Data | Retention | Cleanup |
|------|-----------|---------|
| Notification queue | 90 days | Daily SQL DELETE |
| Export files | 1 year | PowerShell delete |
| Token blacklist | Auto | Nightly APScheduler |
| Audit logs | 7 years | Partitioned, no deletion |

*Last updated: 2026-06-17 â€” Phase 0 scaffolding.*
## 8. MANUAL SMOKE TESTS

### Password Enforcement (must_change_password)
1. Start backend: cd backend && uvicorn app.main:app --reload
2. Start frontend: cd frontend && npm run dev
3. Use the Admin token to reset an employee's password (e.g., HRMS001) via API, or run the seed script to create fresh users.
4. Open the browser and go to http://localhost:5173/login.
5. Log in with the employee's credentials.
6. **Expect**: The app redirects you to http://localhost:5173/change-password and displays a "Your account requires a password change" message.
7. Try manually navigating to http://localhost:5173/apply.
8. **Expect**: You are forced back to /change-password.
9. Fill out the change password form with a valid new password (8+ chars) and submit.
10. **Expect**: The app redirects you to the home dashboard (/) and navigation is fully unlocked.
