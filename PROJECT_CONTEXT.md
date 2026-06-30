# Project Context (Live Memory)

> **Agents:** Read this file at the start of every session. Update it after meaningful work (features, fixes, decisions, validation). Keep it concise — current state only, not a full changelog. Detailed history stays in `HANDOFF.md`.

**Last updated:** 2026-07-01 (CCS/DoPT Casual Leave rules in validation + Apply UX)

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

**Navigation:** Hub & Spoke — landing dashboards with **hover-dropdown** sub-nav in `App.tsx` (all roles, including Admin). **Masters** (`/masters`) is the single hub for departments, designations, leave types, entitlements, holidays, and workflows. **Admin Console** (`/admin`) covers operations only: dashboard, leave policy matrix, users & roles, audit & health. **Admin Tools**: maintenance, broadcasts, workflow(s), bulk roles.

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
| `NODAL_OFFICE` | Assigned depts | Clerical staff — onboarding, directory, reports (no leave approval) |
| `STAFF` | Own record | Apply leave, view balances |

**Nodal leave workflow:** `Staff → HOD (step 1) → NODAL_OFFICER (step 2, FINAL)` via `dept_nodal_assignments`.

**Owner spec mapping:** Staff = `STAFF`; HOD = `HOD`; Nodal Officer = `NODAL_OFFICER`; Nodal office clerical (view-only, no approvals) = `NODAL_OFFICE`; Super Admin = `ADMIN`.

---

## Owner Role Requirements — Alignment (2026-06-30)

*Reviewed against owner four-tier spec. ✓ = built; ~ = partial/shell; ✗ = not built.*

| Area | Staff | HOD | Nodal Officer | Super Admin |
|---|---|---|---|---|
| Leave balance / history | ~ own only | ~ API only, no team UI | ~ report export only | ✓ adjust + audit |
| Apply for leave | ✓ | — | — | — |
| Login activity tracking | ✓ `/login-activity` | — | — | ~ last_login in user list |
| Approval inbox | — | ~ approve/forward/reject | ✓ final step | — |
| Team leave ledgers | — | ~ team picker + ledger via `/leave-account` | ~ scoped API | — |
| Forecasting (dates × designations) | — | ✓ `/forecast` | ✓ same | — |
| Assign HOD / nodal to dept | — | — | ~ assign HOD per employee | ✓ Masters → Nodal Assignments |
| Onboard / resign / rejoin / promote | — | — | ~ directory actions (nodal officer) | — |
| Reports | — | — | ✓ | — |
| Custom leave adjustments | — | — | ✓ nodal officer scoped | ✓ |
| Balance overview + filters | — | — | ✓ `/balance-overview` | — |
| NODAL_OFFICE view-only logins | — | — | ✓ no edit/onboard/approve | ~ via user create |
| Masters CRUD + activate/deactivate | — | — | — | ✓ dept/desg/leave types |
| Holidays / RH load | — | — | — | ✓ Masters tab |
| Auditability | — | — | — | ✓ + immutable leave ledger |

**All four deferred items (2026-06-30) shipped:**
1. **Master activate/deactivate** — `is_active` on departments, designations, leave types; Masters UI toggles.
2. **HOD per department** — `dept_hod_assignments` table + Masters → HOD Assignments; approval routing uses it.
3. **Nodal office hierarchy** — `users.parent_nodal_user_id`; create view-only logins under a nodal officer in Masters → Nodal Assignments.
4. **Immutable leave ledger** — `leave_balance_ledger` append-only table; wired to opening, adjust, approve, recall; ledger API prefers immutable entries.

**Latest work (2026-06-30):** Deferred items + prior role alignment slice. Migrations: `b2c3d4e5f6a7` (login_log), `c3d4e5f6a7b8` (deferred). Frontend `npm run build` ✓.

**Prior (2026-06-30):** Role alignment — nodal assignments, login activity, team views, forecast, balance overview, lifecycle actions.

---

## Current State

**Built so far (foundation):** Auth, role-based navigation, leave apply/approve flow (incl. nodal routing), leave balances (basic), admin console, impersonation, reports shell, hub dashboards.

**Masters UI:** Departments/designations — inline edit + activate/deactivate. **Leave Types** — create/edit collapsed by default; validation rules as toggles (no raw JSON). **Entitlements** — credit frequency per rule (EL = half-yearly, 15+15). **Holidays** — closed/RH filter (closed default), add form collapsed; RH = any 2 per staff per year. **Workflows** — edit config matching rules + approval steps.

**Sample data:** Purge via `cd backend && .venv\Scripts\python.exe scripts/purge_test_data.py --reseed` (keeps departments/designations). **Avoid** `purge_all_test_data.py` without re-running seeds 009+010.

**HR Operations:** Bulk CSV import **removed** from nav and UI — onboard one employee at a time only.

**Latest (2026-07-01):** **CCS/DoPT Casual Leave** — CL may attach to weekends/holidays (not debited); 8-day calendar absence cap; sandwich ban with EL/HPL; half-day CL → next-day regular leave exception; Apply UX guidance + span preview; seed `014_cl_dopt_rules`. Tests + frontend build ✓.

**Latest (2026-06-30):** Staff numbers are **one global 7-digit series starting at `1000001`** (`1000002`, … up to `1999999`). Leading `1` is fixed; staff group is classification only (can change on promote). Numbers **never reused**. **Rejoin** = same person, same number; **promote/demote** = same number, group/designation updated; **new hire** = next number only.

**Prior fix (2026-06-30):** Sidebar submenu flyouts align correctly during impersonation.

**Not built yet (current priority):** Full **transaction logic** for the four core areas below — correct, reliable rules that govern how data moves and stays consistent.

---

## Core Transaction Logic — Build Roadmap

*Plain-language map for owner and agents. "Shell" = screens/APIs exist; "Transaction logic" = correct institutional rules still to implement or harden.*

### 1. User / employee registration

| Status | What exists | What transaction logic is still needed |
|---|---|---|
| Shell | Add employee form, CSV bulk import, auto-create login (username = emp code, temp password) | Full registration workflow: validation rules, approval before account goes live, linking user role (STAFF/HOD) at registration time, transfers between departments, deactivation/rejoin, password policy on first login |
| **Done (2026-06-30)** | **Auto staff number allotment** — global series `1000001`–`1999999`; staff group is classification only; numbers never reused | — |
| Shell | Admin can create standalone users (`users.py`) | Clear rule: when is a user created with vs without an employee record; NODAL_OFFICER role missing from admin user-create |
| Gap | — | Self-registration (if needed for AIIMS), document upload at join, probation period flags |

### Owner-provided master data (canonical — real AIIMS)

**Important:** Everything already in the database from earlier development (testDept1–10, testStaff, demo users, etc.) is **test data only**. The lists below from the owner are **real working information** and are the source of truth for registration.

| List | Status |
|---|---|
| **Staff registration fields** | Verified 2026-06-29 — see **Staff Registration Field Spec** below |
| **Department list** | In DB 2026-06-29 — 57 departments (`backend/seeds/data/aiims_departments.py`, seed `010`) |
| **Designation list** | In DB 2026-06-29 — 39 designations (`backend/seeds/data/aiims_designations.py`, seed `009`) |
| **2026 holiday calendar** | In DB 2026-07-01 — 18 gazetted + 29 restricted (`backend/seeds/data/aiims_holidays_2026.py`, seed `013`) from AIIMS Bibinagar OO/2025/472 + amendments |

**Load into DB:** `cd backend && python seeds/run.py` (seeds are idempotent). **Ran locally 2026-06-29** — 57 departments + 39 designations confirmed in PostgreSQL. **Ran locally 2026-07-01** — 47 holidays for 2026 confirmed.

#### Staff Registration Field Spec (owner list — verified & cleaned)

**Currently in system (43 fields):** Original 11 plus 32 extended registration fields — all in `employees` table (migration `a1b2c3d4e5f6`). Onboard form shows all fields grouped by section.

**Duplicates removed from owner list:** `MOBILENO1` (use MOB TEL), `ALT EMAIL` (use Alternate EMAIL ADDRESS), `DEPT NAME` (derived from dept master — do not store separately).

**Typos fixed:** `PARMANENT ADDRESS` → **Permanent Address**.

**Phase 2 — add to employee record (32 fields):**

| Group | Fields |
|---|---|
| Personal | address, permanent_address, marital_status, father_name, blood_group, initial, photo |
| Contact | mobile, alt_mobile |
| Education | last_qualification |
| Employment | doj_actual, dol_last_working, next_increment_date, staff_group, is_physically_handicapped, type_of_flat |
| Social (govt forms) | caste_category, religion |
| Banking | bank_account_no, bank_name, ifsc_code |
| IDs & payroll | pan, aadhaar, nps_or_gpf_no, pfms_code |
| Pay snapshot | grade, pay_level (copy from designation at join; store on employee for history) |

**Suggested additions (not on owner list):** reporting officer, emergency contact, probation end date, residency year (JR1/JR2/SR), appointment type, superannuation date, campus/location, medical council reg no (doctors).

**Build order:** Phase 1 = extend DB + API + form with personal/contact/IDs; Phase 2 = banking/pay snapshot; Phase 3 = e-Service Book display + CSV import columns.

#### Designation master (39 roles — owner list)

| Leave scheme | Category | Count | Examples |
|---|---|---|---|
| CCS (faculty) | FACULTY | 11 | Professor, Associate Professor, Lecturer, Dietician, Clinical Psychologist |
| CCS (nursing) | NURSING | 2 | Senior Nursing Officer, Nursing Officer |
| CCS (admin) | ADMIN | 22 | Registrar, Executive, Accounts Officer, Lab Technician, Stenographer |
| Residency | JR_ACAD | 2 | Junior Resident, P.G. Student |
| Residency | SR_ACAD | 2 | Senior Resident, SR (Academic) |

Duplicates removed from source: Professor, Senior Resident, Technician, Junior Admin row, Executive. Expanded truncated names (e.g. Techniciar → Technician). Pay levels not yet assigned — owner can supply later.

#### Department master (57 departments — owner list)

Clinical & basic sciences (19): Physiology, Microbiology, Biochemistry, Anatomy, Pharmacology, Pathology, Forensic Medicine, etc.

Clinical specialties (24): General Medicine, General Surgery, Paediatrics, Cardiology, Neurology, Anaesthesiology, etc.

Support & administration (14): Nursing, College of Nursing, Administration, Hospital Administration, Finance & Accounts, Library, Dean, Registrar, Engineering, Stores, etc.

All-caps names normalised for display (e.g. NURSING → Nursing, PULMONARY MEDICINE → Pulmonary Medicine). Short codes assigned (e.g. GENMED, OBGYN, CARDIO) — max 20 characters. **Note:** ENT and Otorhinolaryngology both kept; General Medicine and Medicine both kept (distinct rows in owner list). Managing office per department not yet set.

**Still open (owner):** Leave rules priority (CCS vs Resident), pilot vs go-live timeline; pay levels per designation.

### 2. Departments

| Status | What exists | What transaction logic is still needed |
|---|---|---|
| **Master in DB** | 57 AIIMS departments loaded (seed `010` ran locally) | Hierarchy (parent depts), managing office per dept, nodal officer assignment |
| Shell | CRUD: code, name, parent department, managing office | Cannot delete dept with active staff; transfers affecting approval chain |
| Shell | Nodal routing table (`dept_nodal_assignments`) | Workflow when nodal officer changes mid-approval |

**Suggested order:** Assign nodal officers per real department → configure managing office where needed.

### 3. Designations

| Status | What exists | What transaction logic is still needed |
|---|---|---|
| **Master in DB** | 39 AIIMS designations loaded (seed `009` ran locally), linked to leave categories | Pay levels per designation; promotion → leave rule recalculation |
| Shell | CRUD: name, grade/pay level, linked employee category | Duplicate prevention across categories |
| Gap | — | Residency year (JR1/JR2/SR) affecting leave entitlement |

**Suggested order:** Owner supplies pay levels → link firmly to leave scheme rules.

### 4. Leave types & internal mechanics

| Status | What exists | What transaction logic is still needed |
|---|---|---|
| Shell | 13 leave types seeded (EL, HPL, CL, ML, etc.) with flags (half-day, MC required, max accumulation) | Encashment, LOP, comp-off earning, year-end closing |
| **Seeded + wired** | Entitlement matrix, eligible leave types, onboarding bootstrap | Tenure-pool consumption (EOL/ML) on apply |
| **Done (2026-06-30)** | **Atomic final approval** — balance lock, fund check, deduct + ledger + APPROVED in one commit; idempotent recall | Sanction PDF polish |
| **Done (2026-06-30)** | **Multi-stage balance check** — pending applications reserved at apply, forward, approve, modify | — |
| **Done (2026-06-30)** | **Cancel/modify approved leave** — change-request workflow restores or adjusts balance on final approval | — |
| **Done (2026-06-30)** | **Validation engine** — MC requirement, min notice (EL), max stretch, workflow min/max days | **Done (2026-07-01)** CL DoPT rules: allow holiday/weekend attachment, 8-day absence span, EL/HPL sandwich ban, half-day emergency continuation |
| **Done (2026-06-30)** | **CL prefix/suffix** from config (legacy block flags for non-CL types) | — |
| **Done (2026-06-30)** | **AIIMS Bibinagar form catalogue** — `GET /leave-form-templates` + Apply screen links by category/leave type | Host PDFs in-repo if institute URLs change |
| **Done (2026-06-30)** | **Jan-1 annual credit scheduler** (optional, `ANNUAL_CREDIT_SCHEDULER_ENABLED`); manual button still available | — |
| Partial | Carry-forward (EL cap 300); one annual credit run (1 Jan) for CCS + residents | Year-end closing automation |

**Owner-confirmed leave policy (2026-06-30):**
- **Year boundary:** Calendar year (1 Jan – 31 Dec) for **both** regular staff and residents.
- **Regular staff (CCS):** Same rules for Faculty, Nursing, Admin — EL 30/yr, HPL 20/yr, CL 8/yr, etc. (seed `003`).
- **Residents:** Unified JR/SR rules — ANNUAL_RES **30/yr calendar** (pro-rata if joined mid-year), same annual pattern as staff; EOL/ML/PL tenure limits (seed `004`). **No monthly scheduler** (owner choice 2026-06-30).
- **Config approach:** Seed once (`python seeds/run.py`), then adjust in Masters → Entitlements.

**Suggested order:** Step 4 leave transactions largely done → Step 5 year-end / encashment / LOP as AIIMS requires.

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

**Latest work (2026-06-30):** Nav & UX fixes — dedicated **Leave Forms** catalogue (`/leave-forms`); **Login As User** in Admin Console → Users & Roles; employee directory read-only with separate **Lifecycle** and **Bulk Import** menus; policy matrix resilient loading + empty-state guidance; **ADMIN** added to report access (frontend + backend). Frontend `npm run build` ✓.

**Prior (2026-06-30):** Leave transaction hardening — pending-balance checks at all approval stages; cancel/modify approved leave; config-driven validation; AIIMS Bibinagar form template API + Apply UI; Jan-1 annual credit scheduler. Migration `d4e5f6a7b8c9`. Seed `005_validation_rules_update`.

**Git:** Pushed `419bb82` — staff auto-numbering, 2026 holidays, leave form templates, annual credit scheduler, masters/nav UI.

### WIP / Uncommitted

None (working tree clean except `temp/` reference PDFs — not in repo).


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

**Run locally:** `cd backend && alembic upgrade head` (applies `d4e5f6a7b8c9` leave-application extensions). `python seeds/run.py` (includes `005_validation_rules_update`). Restart backend + frontend.

**Smoke test:** Apply CL spanning a weekend — only working days debited; projection shows calendar absence span. CL Fri + EL Mon (with existing approved CL) should reject sandwich. Half-day CL then EL next day (with prior CL on record) should allow. Run `python seeds/run.py` for seed `014_cl_dopt_rules` on existing DBs.

**Next Action:** If Login As or policy matrix look empty, run `cd backend && alembic upgrade head` (applies pending migrations including `parent_nodal_user_id`). Then refresh Admin Console → Users & Roles.


---

## Update Protocol (agents)

When updating this file after work:

1. Bump **Last updated** date.
2. Refresh **Current State** and **WIP / Uncommitted** from live `git status`.
3. Record durable changes (what shipped, what was validated).
4. Set **Next Action** to the concrete next step.
5. Do not duplicate session logs here — append detail to `HANDOFF.md` only when a full session summary is warranted.
