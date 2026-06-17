# AIIMS HRMS â€” Rollback Procedure

## WHEN TO ROLLBACK

- Health check fails (`/health` returns non-200)
- Login broken for all users
- Leave application submission fails
- Data corruption detected
- UAT-critical feature broken with no hotfix within 1 hour

## ROLLBACK STEPS

```powershell
# Step 1: Stop services
nssm stop AIIMS_HRMS
nginx -s stop

# Step 2: Revert DB migration
cd C:\aiims-hrms\backend
alembic current
alembic history
alembic downgrade <previous-stable-revision>

# Step 3: Revert code
cd C:\aiims-hrms
git checkout <previous-stable-tag>   # e.g., v0.3.0

# Step 4: Rebuild frontend
cd C:\aiims-hrms\frontend
npm install && npm run build

# Step 5: Restart
nssm start AIIMS_HRMS
nginx

# Step 6: Verify
curl http://127.0.0.1:8000/health
```

## ROLLBACK DECISION MATRIX

| Issue | Action |
|-------|--------|
| Migration failed to apply | Downgrade â†’ fix â†’ re-deploy |
| Migration applied but app errors | Downgrade migration â†’ revert code â†’ restart |
| Code regression (no migration) | Revert code â†’ restart |
| Frontend regression | Revert frontend build â†’ rebuild |
| Data corruption | Restore DB backup â†’ revert code â†’ restart |

## GIT TAGS

| Tag | Description |
|-----|-------------|
| v0.1.0 | Phase 0-1: Scaffolding + Schema |
| v0.2.0 | Phase 2-3: Auth + Leave Config |
| v0.3.0 | Phase 4-5: Leave App + Balances |
| v0.4.0 | Phase 6-8: Notifications + Admin + Reports |
| v1.0.0 | Phase 9: UAT + Go-Live |

*Last updated: 2026-06-17 â€” Phase 0 scaffolding.*