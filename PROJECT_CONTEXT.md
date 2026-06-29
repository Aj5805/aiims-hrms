# Project Context (Live Memory)

> **Agents:** Read this file at the start of every session. Update it after meaningful work (features, fixes, decisions, validation). Keep it concise — current state only, not a full changelog. Detailed history stays in `HANDOFF.md`.

**Last updated:** 2026-06-29 (session close — new window handoff)

---

## Stakeholder & Project Stage

**Owner context:** Product owner is **non-technical**. Explain decisions in plain language. Do not assume they can read or review code. Propose options with clear trade-offs, not jargon.

**Institution:** AIIMS — Indian **central autonomous** medical institution. Design for institutional HR workflows, role hierarchies, audit expectations, and eventual production rigour — but we are **not in production yet**.

**Actual stage:** **Early / active development.** The app has screens and basic flows, but **core transaction logic is the current priority** — the rules that correctly register people, link them to departments and designations, and run leave types with proper internal mechanics (credits, deductions, carry-forward, validations).

**Current build focus (owner-confirmed):**
1. **User / employee registration** — onboarding staff with correct accounts and roles
2. **Departments** — organisational structure AIIMS uses
3. **Designations** — job titles linked to employee categories
4. **Leave types & internal mechanics** — EL, HPL, CL, etc. with entitlement rules, balance movements, and CCS/residency rules

Treat earlier Phase 1–8 work as **foundation** (screens, APIs, test data). The **business rules layer** for the above four areas is what we build next.

**Agent priority:** **Build core transaction logic first** in the areas above. Defer cosmetic/code-quality fixes per **Deferred Improvements Backlog** unless they block current work.

---

## What This Is

**AIIMS HRMS** — leave management and HR workflows for AIIMS. Foundation in place (auth, RBAC, leave application flow, admin console, reports shell); **transaction and business-logic layers still evolving**.

| Layer | Stack |
|---|---|
| Backend | FastAPI, SQLAlchemy async, Alembic, APScheduler |
| Frontend | React + TypeScript, Vite, Tailwind |
| Database | PostgreSQL |
| Auth | JWT + httpOnly refresh cookie, bcrypt, RBAC |

---

## Repo Layout

```text
backend/app/api/v1/     REST endpoints
backend/app/models/     ORM models
backend/alembic/        migrations
backend/seeds/          versioned seed data
frontend/src/pages/     UI screens
frontend/src/App.tsx    shell, nav, role-based routing
docs/                   architecture, security, go-live runbook
scripts/db_sync.py      cross-platform DB snapshot sync
```

**Navigation:** Hub & Spoke — landing dashboards (`/`, `/leave-dashboard`, `/claims`, `/payroll`, `/performance`, `/profile-dashboard`) with hover-dropdown sub-nav in `App.tsx`.

---

## Roles (summary)

| Role | Scope | Key capability |
|---|---|---|
| `ADMIN` | All | System config, user mgmt, audit, impersonation |
| `DIRECTOR` | All | Read-only institutional view |
| `REGISTRAR` / `ESTABLISHMENT_OFFICER` | CCS staff | Legacy chain, masters, reports |
| `DEAN_ACADEMIC` | Residents | Final approver (resident leave) |
| `HOD` | Own dept | First-stage approver |
| `NODAL_OFFICER` | Assigned depts | Final approver (nodal chain) |
| `STAFF` | Own record | Apply leave, view balances |

**Nodal leave workflow:** `Staff → HOD (step 1) → NODAL_OFFICER (step 2, FINAL)` via `dept_nodal_assignments`.

---

## Current State

**Built so far (foundation):** Auth, role-based navigation, leave apply/approve flow (incl. nodal routing), leave balances (basic), admin console, impersonation, reports shell, hub dashboards, test seed data.

**Not built yet (current priority):** Full **transaction logic** for the four core areas below — correct, reliable rules that govern how data moves and stays consistent.

---

## Core Transaction Logic — Build Roadmap

*Plain-language map for owner and agents. "Shell" = screens/APIs exist; "Transaction logic" = correct institutional rules still to implement or harden.*

### 1. User / employee registration

| Status | What exists | What transaction logic is still needed |
|---|---|---|
| Shell | Add employee form, CSV bulk import, auto-create login (username = emp code, temp password) | Full registration workflow: validation rules, approval before account goes live, linking user role (STAFF/HOD) at registration time, transfers between departments, deactivation/rejoin, password policy on first login |
| Shell | Admin can create standalone users (`users.py`) | Clear rule: when is a user created with vs without an employee record; NODAL_OFFICER role missing from admin user-create |
| Gap | — | Self-registration (if needed for AIIMS), document upload at join, probation period flags |

### Owner-provided master data (ready for Step 1)

Owner **has official default lists** (not yet in repo — to be supplied in next session):
- **Staff registration fields** — required field list for employee onboarding
- **Department list** — AIIMS departments
- **Designation list** — AIIMS job titles

**Next session start:** Owner will share these lists. Agent loads `PROJECT_CONTEXT.md`, imports or maps lists into masters + registration flow (Step 1 → Step 2).

**Still open (owner):** Staff category breakdown (CCS / Resident / etc.), leave rules priority (CCS vs Resident), pilot vs go-live timeline.

### 2. Departments

| Status | What exists | What transaction logic is still needed |
|---|---|---|
| Shell | CRUD: code, name, parent department, managing office | Hierarchy rules (cannot delete dept with active staff), nodal officer assignment as part of dept setup, department transfers affecting leave approval chain |
| Shell | Nodal routing table (`dept_nodal_assignments`) | Workflow: when nodal officer changes, what happens to pending approvals |
| Gap | — | AIIMS-specific department tree (clinical vs admin vs school), multi-campus if applicable |

**Suggested order:** Lock the AIIMS department master list, then wire nodal assignments as a required step when a department is activated.

### 3. Designations

| Status | What exists | What transaction logic is still needed |
|---|---|---|
| Shell | CRUD: name, grade/pay level, linked employee category (CCS / Resident) | Rules: which designations get which leave schemes, promotion path (designation change → leave rule recalculation), duplicate prevention across categories |
| Gap | — | Mapping to pay commission levels, residency year (JR1/JR2/SR) affecting leave entitlement |

**Suggested order:** Confirm designation list with AIIMS HR, then link each designation firmly to employee category and leave scheme.

### 4. Leave types & internal mechanics

| Status | What exists | What transaction logic is still needed |
|---|---|---|
| Shell | 13 leave types seeded (EL, HPL, CL, ML, etc.) with flags (half-day, MC required, max accumulation) | **Per-type rules engine:** CL no prefix/suffix holidays, EL minimum notice, HPL >3 days needs MC, leave combination bans |
| Shell | Entitlement rules per category (days/year, pro-rata, carry-forward) | **Annual credit job:** auto-credit EL 30/yr, HPL 20/yr on correct date (financial year for CCS, joining anniversary for residents) |
| Shell | Opening balances, manual adjust, basic availed deduction on approval | **Immutable transaction ledger** (currently balances are updated in place — no append-only audit trail per ADR-003) |
| Shell | Leave application + multi-step approval | **Balance deduction atomicity:** approve → deduct → sanction PDF in one reliable transaction; rollback on failure |
| Partial | Carry-forward with EL cap (300) | Resident pro-rata on contract change (deferred ADR-006) |
| Gap | — | Encashment, LOP (loss of pay) calculation, comp-off earning from overtime, year-end closing process |

**Suggested order:** (a) Define leave rules per type in plain language with AIIMS HR → (b) Implement entitlement + credit logic → (c) Harden apply/approve/deduct as one transaction → (d) Add ledger/audit trail when rules stabilise.

### Recommended build sequence

```
Step 1: Masters solidify     → Departments, Designations, Categories (AIIMS-approved lists)
Step 2: Registration flow    → Employee onboarding with correct dept + designation + category
Step 3: Leave config         → Leave types + entitlement rules per category
Step 4: Leave transactions   → Credit, apply, approve, deduct, carry-forward (the core engine)
Step 5: Year-end / special   → Closing, encashment, LOP, comp-off (as AIIMS requires)
```

*Payroll, claims, and other modules come after this core is reliable.*

---

## Current State

**Built so far (foundation):** Auth, role-based navigation, leave apply/approve flow (incl. nodal routing), leave balances (basic), admin console, impersonation, reports shell, hub dashboards, test seed data.

**Latest work (2026-06-29):** Dedicated admin login (`/admin-login`); strict ADMIN vs employee login separation; "HRMS" branding; admin console UI spacing cleanup.

### WIP / Uncommitted (as of 2026-06-29)

| File | Notes |
|---|---|
| `HANDOFF.md` | Modified |
| `backend/app/api/v1/users.py` | Modified |
| `frontend/index.html` | Encoding fix |
| `frontend/src/App.tsx` | Admin routing / nav |
| `frontend/src/pages/LoginPage.tsx` | Employee login gate |
| `frontend/src/pages/Phase678Pages.tsx` | Admin console spacing |
| `frontend/src/pages/AdminDashboardPage.tsx` | **New** |
| `frontend/src/pages/AdminLoginPage.tsx` | **New** |

---

## Run Locally

```powershell
# Backend (backend/, venv activated)
python -m uvicorn main:app --reload    # http://127.0.0.1:8000

# Frontend
cd frontend && npm run dev             # http://localhost:5173
```

**Test accounts** (password: `password`): `admin` (ADMIN); `testStaff1`–`10`, `testHod1`–`10`, `testNodal1`–`10` (nodal routing dataset).

**DB sync:** Only use `python scripts/db_sync.py pull|push` when user explicitly says **"with db"**. Otherwise code-only `git pull` / normal commit flow.

---

## Key Entry Points

| Area | Path / file |
|---|---|
| App shell & nav | `frontend/src/App.tsx` |
| Admin console UI | `frontend/src/pages/Phase678Pages.tsx` |
| Admin login | `frontend/src/pages/AdminLoginPage.tsx` |
| Employee login | `frontend/src/pages/LoginPage.tsx` |
| Auth / impersonate | `backend/app/api/v1/auth.py` |
| Users API | `backend/app/api/v1/users.py` |
| Admin APIs | `backend/app/api/v1/admin.py` |
| Go-live | `docs/GO_LIVE_RUNBOOK.md` |

---

## Development Strategy (agents — when to fix what)

Use this ladder. **Default = keep building; fix only when a trigger fires.**

| When | What to do | Examples |
|---|---|---|
| **Now (during feature work)** | Fix only if it **blocks** the feature you are building | Broken login, wrong approval routing, data not saving |
| **When touching the same area** | Fix related known issues in the same PR/session | Building session management → fix force-logout; building broadcasts → add content sanitization |
| **When a module is "done"** | Light cleanup for that module only | Split an oversized page file after the screen stabilizes |
| **Before pilot / UAT** | Automated tests for critical journeys; fix security holes in active modules | CI pipeline, leave end-to-end tests, RBAC tests |
| **Before production go-live** | Full hardening pass | Backup scripts in repo, install docs correct, release tags, monitoring, all P0 security items |
| **Defer indefinitely** | Cosmetic refactors with no user impact | Rename phase files, remove unused React Query dep, ORM migration from raw SQL |

**Do not** surface long technical-debt lists to the owner unless they ask, or a go-live/pilot milestone is near. Track debt here; resolve at optimum time.

---

## Deferred Improvements Backlog

*From quality review 2026-06-29. Owner asked to defer — resolve per triggers above, not urgently.*

### Fix before production (P0 at go-live)

| Item | Plain-language impact | Trigger |
|---|---|---|
| No automated CI pipeline | Bad changes could slip in unnoticed | Before pilot or shared team dev |
| `force_logout` admin action broken | "Log out user" may not actually log them out | When building admin user/session tools |
| Install docs reference missing `requirements.txt` | New server setup may fail | Before any fresh deployment |
| Backup / log-rotation scripts not in repo | Backups rely on copy-paste, not version control | Before production go-live |
| Broadcast messages not sanitized | Possible security risk if HTML shown to users | When broadcasts go live for real users |

### Fix when module stabilizes (P1 — during development)

| Item | Plain-language impact | Trigger |
|---|---|---|
| Large monolithic screen files | Harder to change screens later; more bugs when editing | When that screen stops changing weekly |
| Duplicate helper code across screens | Same fix needed in multiple places | When editing those screens anyway |
| Weak input validation on some APIs | Invalid data might get through | When building transaction logic (high stakes) |
| Test stubs (tests that don't run) | False confidence in quality | Before UAT for that module |
| Docs out of date (roles, demo users) | Wrong test accounts in instructions | When onboarding new testers |

### Defer until post-MVP / low priority (P2)

| Item | Plain-language impact | Trigger |
|---|---|---|
| Raw SQL instead of ORM models | Internal code style; works today | Major backend refactor sprint only |
| Unused React Query library | Slightly larger download; no user impact | Frontend architecture pass |
| `@ts-nocheck` on one large file | Type-safety gap internal to dev | When refactoring that file |
| Phase-based file names | Confusing for developers only | Optional rename sprint |
| No release tags for rollback | Rollback harder in emergency | Before first production deploy |

---

## Next Action

**Immediate (new window):** Owner starting fresh session. **Step 1 — Masters:** receive owner's field list, department list, and designation list; load into system and align registration screens.

**Build sequence:** Step 1 Masters → Step 2 Registration → Step 3 Leave config → Step 4 Leave transactions → Step 5 Year-end.

**Still open (plain language):** Staff categories breakdown; CCS vs Resident leave rules first; pilot timeline.

---

## Update Protocol (agents)

When updating this file after work:

1. Bump **Last updated** date.
2. Refresh **Current State** and **WIP / Uncommitted** from live `git status`.
3. Record durable changes (what shipped, what was validated).
4. Set **Next Action** to the concrete next step.
5. Do not duplicate session logs here — append detail to `HANDOFF.md` only when a full session summary is warranted.
