# MASTER_PLAN_AND_PATH_FORWARD

Canonical path-forward for AIIMS HRMS. Current verified build: `0bbb590`, functionally complete through Phase 8 plus notifications. Launch decision remains in-app notifications only, with email deferred. Detailed cutover commands live in `docs/GO_LIVE_RUNBOOK.md`.

## 1. Original build scope

The build was scoped as phases 0 through 9 in `docs/HRMS_IMPLEMENTATION_PLAN_FINAL_PATCHED_v3.md`.

| Phase | Scope |
| --- | --- |
| 0 | Repo scaffold, config, DB and Alembic baseline |
| 1 | Auth and RBAC |
| 2 | Employees master data and import |
| 3 | Leave types and workflow config |
| 4 | Leave application and approval chain |
| 5 | Leave accounts: annual credit, carry-forward, projection |
| 6 | Notifications: in-app plus email wiring |
| 7 | Reports and payroll exports |
| 8 | Security hardening and admin |
| 9 | UAT and production migration/go-live |

## 2. Verified completed work

| Phase | Status | Commit | Verified |
| --- | --- | --- | --- |
| 0 to 4 core foundation | Done | `09894f29` | auth, employees, leave types, workflow, application and approval chain |
| 5 leave accounts | Verified | `afccf15` | idempotent credit, carry-forward, projection |
| 7 reports and admin | Verified | `a5acbb3` | locked-column exports, role gates, audit log, health dashboard |
| 8 security hardening | Verified | `054359e` | DB-backed lockout, password complexity, slowapi, upload validation |
| 6 notifications | Verified | `0bbb590` | in-app notifications live, email wired but gated, password-change auth fix |
| Deployment dry-run | Proven | `5924402` | HTTPS to SPA to API proxy to secure cookie |

Latest verification battery: Playwright `6/6`, pytest `42 passed`, `typecheck:e2e` green.

## 3. Path forward

### Step 1: lock pre-cutover decisions

- [x] Launch in-app notifications only (`EMAIL_SENDING_ENABLED=False`)
- [x] Defer git tags and `v1.0.0` until explicitly requested; until then `deployment/ROLLBACK.md` remains commit-hash based
- [ ] Confirm the real access hostname
- [ ] Gather production secrets (`JWT_SECRET`, DB credentials)
- [ ] Confirm resident pro-rata deferral is acceptable

### Step 2: production cutover

- [ ] Server prerequisites: PostgreSQL 16, Python 3.11, Node.js, nginx, NSSM
- [ ] Build backend venv and frontend bundle
- [ ] Set production `.env`
- [ ] Run DB migrate, seed, and `init_admin`
- [ ] Validate HTTPS certificate and nginx
- [ ] Install NSSM service with `--workers 4 --proxy-headers --forwarded-allow-ips 127.0.0.1`
- [ ] Run full go-live smoke

### Step 3: stabilization and monitoring handover

- [ ] Schedule daily DB backup and verify a restore
- [ ] Schedule log rotation and `/health` checks
- [ ] Hand day-2 monitoring to the continuous monitoring agent

### Step 4: backlog after launch

1. Create git tags and cut `v1.0.0` when requested
2. Enable email with real Zoho credentials
3. Add a persisted immutable leave-transaction ledger
4. Implement resident pro-rata recompute
5. Capture audit `before_state`
6. Add projection-cache invalidation
7. Replace payroll NIC placeholders when the finance spec arrives
8. Add the attachment upload endpoint and whitelist
