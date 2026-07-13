# Project Context (Live Memory)

> **Agents:** Read this file at the start of every session. Update it after meaningful work (features, fixes, decisions, validation). Keep it concise — current state only, not a full changelog. Detailed history stays in `HANDOFF.md`.

**Last updated:** 2026-07-06 (nodal officer staff view — attendance + leave apply)

---

## Latest (2026-07-06): Nodal officer — personal attendance + leave apply

- **My attendance (Staff view):** Nodal Officer / HOD in **Staff** mode now loads **only their own** attendance (passes `employee_id`); desk-wide team rows no longer appear on personal pages.
- **Apply for leave:** Submit always uses the logged-in employee; clear message if login is not linked to an employee record. Backend enforces self-apply on `POST /leave-applications` (desk entry remains for recording others' leave).
- **HOD self-apply:** When the applicant is the department HOD, step 1 is auto-skipped so approval routes to the nodal officer (fixes stuck submissions for dual-role users).
- **My applications:** Staff-mode list filtered to own applications only (same pattern as leave dashboard).
- **Validation:** backend unit **102/102**; frontend Vitest **27/27**.

## Previous (2026-07-06): Staff ledger — current FY only + approval trail on ledger rows

- **Staff ledger** (`/staff-ledger`): Removed FY year picker; always shows **current calendar year** balances only (aligned with Team balances). Ledger drill-down requests `leave_year` so transactions exclude carry-forward / future-year noise.
- **Approval trail:** Ledger application rows now include `application_id`; click a leave row → **View trail** expands the movement trail panel. HOD / Nodal Officer / Nodal Office can view trails for employees in their scope (not only if they personally approved).
- **Validation:** backend unit **102/102**; frontend Vitest **26/26**.

## Previous (2026-07-06): Desk leave entry + staff balances cleanup

- **Staff balances:** Removed duplicate “Open full ledger” in page header; kept contextual **View full ledger →** next to selected staff.
- **Manual leave entry → Record leave at desk:** Nodal roles record leave with **leave type (current FY only)**, **from/to dates**, and **reason**. New `POST /leave-applications/desk-entry` creates an **APPROVED** application, debits balance (same as final approval), writes ledger + audit trail — not raw field tweaks. Year-end **Manual adjustment** tab unchanged for admin corrections.
- **Validation:** backend unit **100/100**; frontend Vitest **26/26**.

## Previous (2026-07-06): Staff ledger — compact desk layout

- **Nodal Desk → Staff ledger** (`/staff-ledger`): Removed duplicate page title and extra search card; staff picker, FY selector, and balance table now share one compact `card` with dense `data-table` styling (matches Team balances / Approval inbox density).
- **Validation:** frontend Vitest **26/26**.

## Previous (2026-07-06): Staff leave ledger — desk route + working links

- **Root cause:** "Open full ledger" on Staff balances pointed to `/leave-account`, which is blocked in Desk View (redirects to `/hod`).
- **Fix:** New **Staff ledger** tab under Nodal Desk (`/staff-ledger`) — searchable staff picker, full balance table, per-type ledger drill-down, manual entries for nodal roles. Links from Staff balances pass `?employee=&year=`.
- **Validation:** frontend Vitest **26/26**.

## Previous (2026-07-06): Staff balances — current year only

- **Nodal Desk → Staff balances** (`/team-leave`): Now shows **FY current year** only — no upcoming-year rows after year-end carry-forward.
- **Shared helper:** `balancesForLeaveYear` + `dedupeLatestPerLeaveType` capped at current calendar year (home/leave dashboards no longer prefer future-year buckets).
- **Validation:** frontend Vitest **25/25** (incl. `leaveBalances.test.ts`).

## Previous (2026-07-06): Admin dashboard nav, searchable dropdowns, year-end tabs, opening balances

- **Admin dashboard:** Fixed blank dashboard when returning from Users & roles — active tab now follows the URL (`/admin` = dashboard; no stale `module=users` state).
- **Searchable dropdowns:** New `SearchableSelect` + `EmployeeSearchSelect` — type to filter or scroll the list. Dense single-line rows; dropdown portals to body (not clipped by cards). Used on HR lifecycle, year-end, reports filters, HOD/nodal staff picks, admin force-logout.
- **Year-end:** Sub-tabs on the page — **Carry-forward**, **Calendar credit**, **Manual adjustment** (`/year-end?tab=…`).
- **Opening balances:** Excel-first UI with plain-language instructions; results shown as a success/error table (JSON entry moved to Advanced).
- **Validation:** backend unit **100/100**; frontend **22/22** Vitest.

## Previous (2026-07-06): Admin dashboard density, HR ops labels/search, balance filters, server clock

- **Admin dashboard:** Smaller attention/snapshot tiles (6-column attention row); **Recent audit** removed from dashboard (still on **Audit & Health** tab); Users & audit pages use compact headers instead of large banners; quick actions in a 2-column grid.
- **HR Operations:** Lifecycle tabs renamed — **Resign / deactivate**, **Rejoin**, **Promotion**, **Transfer** (horizontal scroll on submenu). Staff search on lifecycle forms now passes `is_active` to the API so inactive staff appear on Rejoin and active-only lists are correct.
- **Balance Summary report:** Designation dropdown filters to designations held by staff in the selected department (`GET /designations?department_code=`).
- **Top bar:** Live **server date & time** (with seconds), synced from `GET /api/v1/system/time`.
- **Validation:** backend unit **100/100**; frontend **19/19** Vitest.

## Previous (2026-07-06): Frontend startup fix

- **Holiday calendar:** Removed accidental duplicate `workMode` import in `HolidayCalendarPage.tsx` — was breaking Vite transform on page load.
- **Notification bell:** Removed unused `loadUnreadCount` helper (unread refresh already in `useEffect`).
- **Validation:** frontend build ✓; Vitest **19/19**.

## Previous (2026-07-05): Nodal desk, notification routing, holiday calendar

- **Notifications:** Clicking a bell item now switches Staff/Desk mode as needed and opens the right screen — approval/SLA → **Approval inbox** (`/approvals?app=`); decisions → **My applications** (`/my-apps?app=`).
- **Nodal Desk overhaul:** Role-aware dashboard (HOD vs Nodal Officer labels), clickable pending items, quick-action toolbar, removed stub **Team calendar** / **Delegation** tabs; `/approver-dashboard` redirects to `/hod`; inbox breadcrumbs fixed.
- **Holiday calendar:** Reachable from Nodal Desk in desk mode (no forced staff switch); default filter **All**; dynamic year list; clearer empty state when no holidays seeded for the year.
- **Tests:** backend unit **100/100**; frontend **19/19** Vitest.

## Previous (2026-07-05): Admin nav, dense tables, HOD trail, login notifications

- **Admin sidebar:** Leave & Attendance hidden for ADMIN (system account — not a staff assignable role; same as Profile/Claims/Payroll).
- **Movement trail:** HOD/Nodal who see an item in the approval inbox can now view the trail (matches inbox rules; fixes 403 for HOD).
- **Approver notifications:** Leave submit now resolves the department-specific HOD/nodal approver (shared resolver with approvals).
- **Dense tables:** Default `.data-table` padding tightened app-wide; Admin Console Users & roles + Audit tables use compact data-table styling.
- **Notifications bell:** Refreshes unread count when user/token becomes available after login (not only on 60s poll).
- **Tests:** backend unit **100/100**; frontend **15/15** Vitest.

## Previous (2026-07-05): Employee lifecycle sub-tabs + hardening

- **HR Operations tabs:** Replaced single **Lifecycle** tab with four submenu tabs — **Deactivate**, **Reactivate**, **Change designation**, **Transfer** — each with a dedicated form (searchable employee picker, up to 200 rows).
- **Removed duplicate:** **Assign as HOD** removed from lifecycle (use **Masters → HOD Assignments** only).
- **Backend:** Shared `employee_lifecycle` service — deactivate clears HOD role + `dept_hod_assignments`; designation change syncs **category_id** + staff group + leave bootstrap; transfer updates department + staff group; all actions write **audit_log** (`EMPLOYEE_*`). Legacy API actions (`resign`, `rejoin`, `promote`, `demote`) still accepted as aliases.
- **Profile edit:** Department, designation, category, and active status are **read-only** on profile — must use lifecycle tabs (links from profile + toolbar).
- **Tests:** backend unit **98/98**; frontend **14/14** Vitest.

## Previous (2026-07-05): Global submenu tabs + compact data-first UI

- **Submenu tabs:** Every main-menu section (Profile, Leave & Attendance, Claims, Payroll, Performance, Nodal Desk, HR Operations, Reports & Data, Admin Console, Admin Tools, Masters) now shows **all sibling pages as tabs** at the top when you open any item — same tabs on section overview dashboards. Single source: `frontend/src/config/navSections.ts` + `SubmenuTabsNav` / `SectionLayout`.
- **Compact layout:** Tighter `.page` / `.card` spacing; duplicate page titles and nav card grids removed where tabs carry context; module dashboards use summary tables.
- **Tests:** backend unit **96/96**; frontend **14/14** Vitest; frontend build ✓.

## Previous (2026-07-05): Nodal office staff — assign like HOD

- **UI:** Masters → Nodal Offices back to **HOD-style table** — Manage opens officer picker + office staff section (no master–detail, no username/password form).
- **Office staff:** Pick an **onboarded employee** (same pattern as nodal officer / HOD); upgrades their existing login to `NODAL_OFFICE` under that office. Remove reverts to `STAFF`.
- **API:** `POST /nodal-offices/{id}/clerical-logins` accepts `employee_id`; `DELETE …/office-staff/{user_id}` to unassign. Legacy username-only create still works for old data.
- **Tests:** backend unit **96/96**; frontend **14/14** Vitest.

## Previous (2026-07-05): Nodal Offices UI redesign (superseded)

- **Masters → Nodal Offices:** Replaced single table + hidden row expand with **master–detail layout** — office list on the left, detail panel on the right (sticky on desktop).
- **Clerical staff:** Add-login form is always visible in a highlighted panel when an office is selected (no more buried "Clerical (N)" link).
- **Nodal officer:** Always-editable dropdown + Save in the detail panel; summary chips show active offices, offices needing officer, total clerical logins.
- **Tests:** frontend **14/14** Vitest (unchanged).

## Previous (2026-07-05): Approval movement trail

- **Movement trail:** Staff and approvers in the chain can see who submitted, who acted at each workflow step (with date and remarks), who it was forwarded to, and **currently with whom** for pending applications.
- **API:** `GET /leave-applications/{id}/approval-trail` — enriched payload (submitted_by, steps, current_with); access limited to applicant, past/current approvers, and admin.
- **UI:** Timeline panel on **My Applications** (detail) and **Approval Inbox** cards.
- **Tests:** backend unit **96/96**; frontend **14/14** Vitest.

## Previous (2026-07-05): Leave UX, layout width, six-day week

- **Leave & Attendance nav:** Shared tab bar (`LeaveAttendanceLayout`) stays visible on Overview, Apply, My applications, Ledger, Attendance, Holiday calendar — no more disappearing submenu when drilling in.
- **Balance → ledger:** Staff clicking a leave balance opens that type's ledger directly (`/leave-account?ledger=EL`) — summary + transactions only, not the full multi-type table.
- **After submit:** Apply leave redirects to **My applications** with the new app selected.
- **Notifications:** Staff no longer get in-app/email on submit (`APP_SUBMITTED`); only the approver is notified. Decision events (approved/rejected) still notify staff.
- **Withdraw removed (UI):** Pending applications cannot be self-withdrawn — avoids HOD missing a withdrawal; use **Cancel** after approval (needs approver sign-off).
- **Layout width:** Removed shell `max-w-screen-xl` cap and redundant page `max-w-*` on key staff pages; scrollbars only when needed (`overflow-y: auto`).
- **Working week:** Saturday is a working day; **Sunday only** is weekend (attendance, leave day counts, CL span rules). Central helper: `backend/app/services/working_days.py`.
- **Tests:** backend unit **96/96**; frontend **14/14** Vitest.

## Previous (2026-07-05): Notifications, leave UX, admin email

- **Notifications:** Templates shortened to one-line in-app style (not letter HTML). Approver gets `APPROVAL_REQUEST` on submit; rejection remarks + emp_code fixed. Bell shows subject + app number only; click opens application (`/my-apps?app=` or `/approvals?app=`).
- **Admin email:** Admin Tools → **Email Settings** — configure SMTP/from address in DB; **Email log** (admin-only) with retry. Env vars still fallback when DB unset.
- **Leave balance UX:** Removed misleading sum of all types as “available”. Home shows EL/CL per category; duplicate balance grid removed. Leave hub is canonical per-type view; pills link to ledger (`/leave-account?ledger=EL`). Ledger shows **pending** applications (informational, delta 0).
- **Profile:** Profile dashboard restored **summary card** + Service Record link (under development page).
- **Holiday calendar:** Staff read-only calendar at `/holidays-calendar` (API allows STAFF).
- **Attendance:** Pipeline hidden for STAFF; simpler personal table columns.
- **Nav:** Collapsed menu reopen uses **right chevrons** (not hamburger). **Backspace** goes back when not editing a field.
- **Banners:** Leave hub identity/aggregate hero removed; slim headers kept.
- **Tests:** backend unit **96/96**; frontend **14/14** Vitest. Re-run seeds to refresh notification templates: `cd backend && python seeds/run.py`.

## Previous (2026-07-05): Leave policy UI consolidation

- **Single editor:** Masters → **Leave Policy** (was Entitlements) now has the full category-first editor — initialize missing rules, days/year, credit frequency, tenure pools, gender, max times.
- **Admin matrix removed:** Admin Console no longer has a separate Leave Policy Matrix module. **Policy gaps** card links to Masters → Leave Policy. Old `/admin?module=policy` redirects there.
- **Leave Types unchanged:** behavioural rules (half-day, sandwich, MC) stay on Leave Types tab only.
- **Tests:** backend unit **96/96**; frontend **14/14** Vitest; frontend build ✓.

## Previous (2026-07-05): Workflow simulate entitlement gate

- **Your instinct was right:** Simulate previously matched workflow chains even when the leave type is **not entitled** for that staff category (e.g. FACULTY + ANNUAL_RES). Real leave apply already blocked that via Entitlements; simulate did not.
- **Fix:** Simulate now requires category + leave type and checks **Entitlements** first (`is_category_leave_type_eligible`), same matrix as apply. UI leave-type dropdown filters to entitled types for the chosen category; no more "any category / any leave type".
- **Tests:** backend unit **96/96** (+2 message tests); verified FACULTY+ANNUAL_RES blocked, JR_ACAD+ANNUAL_RES allowed.

## Previous (2026-07-05): Workflows master UI fix

- **Root cause:** Masters → Workflows listed 30+ inactive E2E test configs (alphabetically first), burying the 5 real chains; long left column scrolled the Simulate panel out of view.
- **UI:** Default view shows **active workflows only**; optional "Show inactive" toggle; left list scrolls independently; Simulate panel stays sticky on the right.
- **Data cleanup:** Removed 30 inactive `E2E_*` / `ASCII Test*` configs from dev DB. Script: `cd backend && python scripts/purge_test_workflows.py`. E2E dupe probe now deletes its temp config after the 409 assertion.
- **Tests:** backend unit **94/94** (unchanged).

## Previous (2026-07-05): Workflows master overhaul + route simulation fix

- **Root cause:** Simulation filtered by day range but leave apply did not — same inputs could show different chains.
- **Shared resolver:** `backend/app/services/workflow_resolver.py` — one matching rule for simulate, leave apply, and list (category → leave type → day range; most-specific wins).
- **Masters UI:** Workflows tab — category/leave-type dropdowns for simulation, day-range labels on configs, clearer match/no-match output; list API uses 2 queries instead of N+1.
- **Bug fix:** New workflow steps now persist `skip_if_self_applicant` on create.
- **Tests:** backend unit **94/94** (7 new workflow resolver tests).

## Previous (2026-07-05): Concise UI guidance text

- **Copy trim:** Removed or shortened multi-line page descriptions, Masters tab blurbs, dashboard card subtitles, admin attention hints (shown only when action needed), panel intros (nodal/HOD/entitlements/holidays), form hints, and login footers — titles and tabs carry context instead.
- **Tests:** frontend **14/14** Vitest (unchanged).

## Previous (2026-07-05): Admin sidebar duplicate nav + work-mode toggle

- **Admin sidebar:** Removed duplicate **HR Operations** and **Reports & Data** entries (copy-paste bug for non-toggle roles like ADMIN).
- **Staff/Desk toggle:** Modern sliding pill control in the sidebar header (right of **HRMS** / **HRMS (Admin)**) for HOD/Nodal Officer only.
- **Sidebar collapse:** Prominent `<<` button in the sidebar header (right of logo); when hidden, a clear menu button appears in the top bar to reopen. Sidebar nav no longer forces a scrollbar track.
- **Tests:** frontend **14/14** Vitest (unchanged).

## Previous (2026-07-05): Visible scrollbars app-wide

- **Scroll UX:** Global scrollbar styling (10px, visible slate track) + `.app-scroll-y` utility on main content, sidebar nav, and dropdown panels. Flex layout uses `min-h-0` so long pages scroll inside the shell instead of clipping. Login/standalone pages inherit scrollbar styling via `html`.
- **Tests:** frontend **14/14** Vitest (unchanged).

## Previous (2026-07-05): Admin staff numbers (ADM) + profile staff no. edit

- **Administration staff numbers:** Non-faculty admin category now auto-assigns **`ADM`** prefix (e.g. `ADM0001`), not `DEP`. `DEP` kept only as legacy manual series. Seed `023_admin_staff_group_adm.py` adds ADM sequence + updates `staff_group` on existing admin rows.
- **Profile full edit:** Staff number is **editable** (updates employee + linked login username); duplicate staff numbers rejected (409).
- **Staff number integrity:** `GET /employees/check-staff-number` for fast duplicate probe; onboard uses atomic sequence allocation + manual prefix validation; profile edit re-checks employee + login username; sequence counter bumps when a number is assigned manually or edited.
- **Prior same session:** Admin uses **ADM** prefix; profile staff number editable; whole-day leave credits; personal panel first in edit.
- **Tests:** backend unit **86/86**; frontend **14/14** Vitest. Run `cd backend && python seeds/run.py` on existing DBs for ADM sequence.

## Previous (2026-07-05): Onboard leave credits, staff group, profile edit UX

- **Sidebar toggle:** Header button hides/shows left nav on desktop and mobile; preference persisted (`useUiStore`). Main content expands to full width when menu is hidden.
- **Senior Resident designation:** Legacy short name `"Senior Resident"` merged into **Senior Resident (Academic)** / **(Non-Academic)** via seed `022_remove_legacy_sr_designation.py` (re-runs idempotent logic from seed 020). Run `cd backend && python seeds/run.py` on existing DBs if dropdown still shows the old name.
- **Profile/onboard text fields:** Caret no longer jumps to end when editing mid-field — `commitFilteredInputChange` in `employeeForm.ts` applied across `AddStaffForm`, `EmployeeProfileContent`, `AddressFields`, `ValidatedTextInput`, `ValidatedDateInput`.
- **Test data policy:** Removed 21 auto-seeded demo employees (seed 012); kept owner's 6 `test*` staff. Seed 012 now skips sample staff unless `SEED_SAMPLE_STAFF=1` or `purge_test_data.py --reseed`. Agents must not add test data without owner request.
- **Tests:** backend unit **86/86**; frontend **13/13** Vitest.

## Previous (2026-07-05): Testing infrastructure + production fixes

- **Automated tests:** backend **100/100** pytest (unit + integration + ASGI e2e harness); frontend **12/12** Vitest. CI workflow: `.github/workflows/ci.yml`.
- **Test maintenance:** `.cursor/rules/testing.mdc` — update/add tests when touching related APIs, leave rules, auth, or workflows.
- **E2E helpers:** `backend/tests/helpers.py`, `backend/tools/ensure_e2e_users.py` (idempotent journey users; does **not** purge manual DB data). Playwright globalSetup uses ensure script, not full seed purge.
- **Production fixes this session:** pending-balance SQL cast (`leave_transaction.py`); leave app numbers use **max seq** not count (avoids duplicate `app_number`); workflow seed **021** + e2e setup enforce **HOD → Nodal (2 steps, final at step 2)** — removes legacy 3-step configs.
- **Removed obsolete:** leave form templates API/page (`leave_form_templates.py`, `LeaveFormsPage.tsx`).
- **Manual test data:** owner adds staff visually; names start with `test`. **Agents must not seed demo/sample staff unless the owner asks.** Purge agent/demo rows: `cd backend && python scripts/purge_non_test_staff.py` (keeps `test*` employees + admin). Full wipe: `scripts/purge_test_data.py`. Demo staff only via `--reseed` or `SEED_SAMPLE_STAFF=1`. E2E cleans **HRMS\*** / **RES001** test rows only.
- **Run tests:** see `docs/TESTING.md` — `cd backend && pytest -q`; `cd frontend && npm run test -- --run`.

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
frontend/src/pages/     UI screens (one file per screen/panel)
frontend/src/api/endpoints.ts   all REST client modules
docs/                   architecture, security, go-live runbook
scripts/db_sync.py      cross-platform DB snapshot sync
```

**Navigation:** Hub & Spoke — landing dashboards with **hover-dropdown** sub-nav in `App.tsx` (all roles, including Admin). **Masters** (`/masters`) is the single hub for departments, designations, leave types, **leave policy** (entitlements), holidays, and workflows. **Admin Console** (`/admin`) covers operations only: dashboard (incl. policy gap alerts), users & roles, audit & health. **Admin Tools**: maintenance, broadcasts, workflow(s), bulk roles.

---

## Roles (summary)

Six login roles only. **Registrar** and **Establishment Officer** are designations and nodal-office functions — not separate system roles.

| Role | Scope | Key capability |
|---|---|---|
| `ADMIN` | All | System config, user mgmt, audit, impersonation, masters |
| `DIRECTOR` | All | Read-only institutional view (Executive Director) |
| `NODAL_OFFICER` | Nodal office (Establishment or Registrar) | Final leave approver — staff matching that office's leave scheme |
| `NODAL_OFFICE` | Under nodal officer | Clerical — onboarding, directory, reports, profile edit, manual leave entries (no approval) |
| `HOD` | Own dept | First-stage approver |
| `STAFF` | Own record | Apply leave, view balances, edit own non-critical profile |

**Removed (2026-07-04):** `ESTABLISHMENT_OFFICER`, `REGISTRAR`, `DEAN_ACADEMIC` — covered by nodal officers + designation master. Migration `o5p6q7r8s9t0` remaps existing users.

**Nodal leave workflow:** `Staff → HOD (step 1) → Nodal Officer (step 2, FINAL)` — routed by **employee category**, not department:
- **Regular staff** (CCS: faculty, nursing, admin) → **Establishment** nodal office officer
- **Residents** (JR/SR academic & non-academic) → **Registrar** nodal office officer

Masters → **Nodal Offices** manages offices, nodal officers, and office staff (clerical desk role). Leave step 2 routes by employee leave scheme only (no department mapping). Multiple nodal offices per staff type are supported. Office staff are **onboarded employees** assigned to `NODAL_OFFICE` — not separate username logins.

**Owner spec mapping:** Staff = `STAFF`; HOD = `HOD`; Nodal Officer = `NODAL_OFFICER`; Nodal office clerical = `NODAL_OFFICE` (profile edit + manual entries, no approvals); Super Admin = `ADMIN`.

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
| Onboard / resign / rejoin / promote | — | — | ✓ lifecycle tabs (nodal) | ✓ |
| Reports | — | — | ✓ | — |
| Custom leave adjustments | — | — | ✓ nodal officer scoped | ✓ |
| Manual leave entries (balance) | — | — | ✓ nodal officer + nodal office scoped | ✓ |
| Balance overview + filters | — | — | ✓ `/balance-overview` | — |
| NODAL_OFFICE view-only logins | — | — | ✓ clerical under nodal officer (no approve) | ~ via user create |
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

**Masters UI:** Departments/designations — **Add** button top-right (form collapsed by default); inline edit + activate/deactivate. **Nodal Offices** — table like HOD: Manage → pick nodal officer + assign office staff from onboarded employees (role upgrade, not separate login). **HOD Assignments** — one row per department; staff picker from that department + Save (departments managed in Departments tab). **Leave Types** — create/edit collapsed by default; validation rules as toggles (no raw JSON). **Leave Policy** — category tabs; full entitlement editor (days, credit freq, tenure pools, gender, initialize missing). **Holidays** — closed/RH filter (closed default), add form collapsed; RH = any 2 per staff per year. **Workflows** — edit config matching rules + approval steps.

**Sample data:** Owner adds staff via onboard form (`test*` names). Demo seed (20 named staff) is **opt-in only** — `purge_test_data.py --reseed` or `SEED_SAMPLE_STAFF=1`. Re-purge extras: `python scripts/purge_non_test_staff.py`. Full wipe: `scripts/purge_test_data.py`.

**HR Operations:** Bulk CSV import **removed** from nav and UI — onboard one employee at a time only.

**Latest (2026-07-01):** **Repo file naming cleanup** — removed legacy `Phase*Pages` / `phase*_endpoints` files; split into domain-named pages (`ApplyLeavePage`, `ReportsPage`, master panels, etc.); merged leave APIs into `endpoints.ts`; removed obsolete build-instruction PDFs/scripts/temp artifacts. Frontend `npm run build` ✓.

**Latest (2026-07-01):** **CCS/DoPT Casual Leave** — CL may attach to weekends/holidays (not debited); 8-day calendar absence cap; sandwich ban with EL/HPL; half-day CL → next-day regular leave exception; Apply UX guidance + span preview; seed `014_cl_dopt_rules`. Tests + frontend build ✓.

**Latest (2026-07-01):** **Layout + home dashboard** — breadcrumbs moved to top bar (left of notifications/user); page headers slimmed (no card banner). Home dashboard shows live leave stats, pending apps, approver inbox preview, quick actions, compact module chips. Frontend build ✓.

**Latest (2026-07-03):** **Profile + dashboard polish** — shared `EmployeeProfileContent` for self (`/profile`) and HR (`/employees/:id`) views; extended `PATCH /employees/me` for contact/address/personal fields; home dashboard live stats + approver widgets respect Staff/Desk toggle; breadcrumbs via `pageMeta` store in top bar; `workMode` helpers in `utils/workMode.ts`. Frontend `npm run build` ✓.

**Latest (2026-07-04):** **Onboard increment + leave credits + error messages** — next increment auto-fill corrected: Jul 2–Jan 1 joiners → upcoming 1 Jul (Jan 1 joiners included in July cycle); Jan 2–Jul 1 → upcoming 1 Jan. Onboarding form shows editable opening leave credits per leave type (auto from entitlement + DOJ; `GET /employees/onboarding-leave-credits`; saved via `onboarding_leave_credits` on create). Generic "Request failed" replaced with `formatHttpError` (shows API detail, HTTP status, or network message) on onboard, profile save, reports, change requests. Unit tests + frontend build ✓.

**Latest (2026-07-04):** **Onboard + profile edit polish** — JR Academic / Non-Academic designations map to correct staff groups (`PGJR` / `PGNA`); profile edit uses same dropdowns as onboard (marital status, blood group, caste); save-success messages show in page header banner (not floating toast). Backend + frontend unit tests; `npm run build` ✓.

**Latest (2026-07-04):** **Onboard staff-group auto-suggest** — selecting a designation again auto-fills staff group immediately (no department required first); local rules mirror backend + API confirm. Frontend build ✓.

**Latest (2026-07-04):** **Admin dashboard command centre** — Dashboard tab rebuilt as institution pulse: clickable attention cards (unmapped users, password resets, policy gaps, pending leaves, depts without HOD, maintenance mode), employee/user/master snapshot, users-by-role chips, recent audit preview, quick links, improved system health labels (failed notifications, backup age). New `GET /admin/summary` aggregates counts in one call. Frontend `npm run build` ✓.

**Latest (2026-07-04):** **Staff master duplicate checks** — onboarding and profile edit reject PAN, Aadhaar, NPS, mobile, email, bank account, and PFMS code if already registered to another employee (409 with staff number + name). Mobile/email also checked against alt-mobile/alt-email columns. **Profile edit validation** — same field rules as onboarding now run client-side before save (self + full edit modes). Unit tests + frontend build ✓.

**Prior (2026-07-04):** **Staff onboarding validation** — email, PAN, IFSC, and bank account show inline errors on blur (not only on save); date fields have calendar picker + "Stored as DD-MM-YYYY" hint; IFSC normalizes spaces and letter-O→zero in 5th position; bank account 9–18 digits only. Backend mirrors IFSC/bank rules. Unit tests + frontend build ✓.

**Latest (2026-07-04):** **Reports screen redesign** — tabbed report picker with per-report filters (labeled, contextual); **View report** loads on-screen table preview; **Export Excel/PDF/CSV** downloads unchanged files. Backend adds `format=json` preview on leave register, category summary, pending, calendar, payroll (payroll preview skips export audit log). Nodal scoping fixed on leave register + category summary. Payroll tab hidden for `NODAL_OFFICE`. Frontend `npm run build` ✓.

**Latest (2026-07-04):** **Staff vs Desk — separate screens** — for employee-linked `HOD`/`NODAL_OFFICER`, toggle now swaps **entire** nav + landing (not overlapped menus): Staff View = personal employee menus only (`/` home); Desk View = Nodal Desk + HR Operations/Reports only (`/hod` home). Wrong-mode routes redirect; personal pages blocked in Desk View. Frontend `npm run build` ✓.

**Latest (2026-07-04):** **HPL commutation + attendance pipeline** — commuted HPL is an apply-leave option (MC required, 2× HPL debit, 180-day lifetime cap, whole days only); standalone `COMMUTED` leave type removed; past-dated leave allowed automatically; `attendance_daily` table + `/attendance/report` (leave-derived stage 1; biometric review/final open). Migration `n4o5p6q7r8s9`, seed `019`. Unit tests + frontend build ✓.

**Latest (2026-07-04):** **Entitlement review + corrections** — CCL/ML/PL/EOL tenure pools no longer show misleading "Annual" credit (now `NONE` / "Tenure pool"); Faculty/Nursing EL/HPL restored to 30/20 days per year (half-yearly 15+15, 10+10); CL max stretch 8; resident ANNUAL_RES annual (not monthly); CCS ML tenure_extension removed. Seed `018`. Frontend build ✓.

**Latest (2026-07-03):** **Leave policy matrix + apply leave** — ML/PL/CCL as tenure pools with gender rules (CCL/ML female, PL male) and max-times-in-service; EL/HPL half-yearly (15+15, 10+10); policy matrix UI: year basis, eligibility, max times, Initialize missing rows; single-day leave (same from/to) counts 1 day; MC optional everywhere; HPL MC flag removed. Migration `m3n4o5p6q7r8`, seed `017`. Unit tests + frontend build ✓.

**Latest (2026-07-03):** **Leave lifecycle hardening** — cut-short via **Report rejoin** (`rejoin_date` on change-request); `actual_rejoin_date` on parent after approval; **retrospective apply** (past dates + MC, 30-day window); min-notice skipped for modifications; **recall restricted** to nodal/admin (staff use cancellation). Migration `l2m3n4o5p6q7`. Unit tests + frontend build ✓.

**Latest (2026-07-03):** **Category-only nodal routing + UX** — removed department → nodal mapping; leave routes by leave scheme only. Global save toasts on mutations. Staff category editable on profile (Admin + nodal). Nodal officer picker searches all staff. Migration `k1l2m3n4o5p6`. Frontend build ✓.

**Latest (2026-07-03):** **HOD + Nodal assignment UX** — Masters tabs: table of groups, **Manage** → pick staff → **Save**; backend accepts `employee_id`, upgrades role to HOD/NODAL_OFFICER.

**Latest (2026-07-02):** **Staff vs Desk view toggle** — for employee-linked `HOD`/`NODAL_OFFICER` logins, top-bar toggle now switches between **Staff View** and **Desk View**. Sidebar hides Nodal Desk in staff mode; approver pages (`/hod`, `/approvals`, `/team-leave`, `/forecast`) require Desk View for toggle-eligible users. Home dashboard approver widgets/actions now respect the selected view mode. Frontend build ✓.

**Latest (2026-07-02):** **Nodal officer assignment** — Masters → Nodal Offices lists all active staff for officer assignment (any category). Assigning upgrades role to `NODAL_OFFICER`. Frontend build ✓.

**Latest (2026-07-01):** **Nodal office manual leave entries** — `NODAL_OFFICE` clerical staff can search staff in their nodal office scope on Leave Ledger (`/leave-account`) and post manual balance entries (availed, credited, etc.) with required reason; same API as nodal officer, scoped by leave scheme. Frontend build ✓.

**Latest (2026-07-01):** **Nodal office routing** — `nodal_offices` master (Establishment/CCS, Registrar/RESIDENCY); leave step 2 resolves officer by applicant category; inbox/reports/employee scope by leave scheme; Masters → Nodal Offices UI; removed department managing office field. Migration `i9j0k1l2m3n4`; seeds `015`+`016`. Frontend build ✓.

**Latest (2026-07-01):** **Profile self-edit** — My Profile → View Profile (`/profile`) opens full e-Service Book in view mode with top-right Edit FAB. Staff update non-critical fields (contact, address, personal bio) via `PATCH /employees/me`. Nodal office (+ existing HR editors) get full edit on employee profiles including critical fields (dept, designation, IDs, banking). Frontend build ✓.

**Latest (2026-07-01):** **Date entry UX** — staff form dates are typed `YYYY-MM-DD` (auto-dashes) with calendar picker; validate instantly on 8 digits or calendar pick; invalid → inline warning + clear; profile/reports display as `DD-MM-YYYY`. **Enter** advances focus field-to-field on onboard form. Frontend build ✓.

**Latest (2026-07-01):** **Six-month realistic demo seeding** — added `backend/scripts/seed_six_month_demo.py` to quickly generate visual demo data (default 72 staff, 6 months history, mixed approved/rejected/withdrawn/pending leave states, role logins for HOD/Nodal/office chain). Verified local run created 288 leave applications; reports and balance overview endpoints respond with populated output.

**Prior (2026-07-01):** **Onboarding validation & profile view** — structured address (5 parallel fields per permanent/present); email/date/PAN/IFSC/mobile checks; unsaved-data warning when leaving onboard tab; employee profile page (`/employees/:id`) with view, edit, export JSON, print; actual reporting date removed from form (DOJ used). Frontend build + validation unit tests ✓.

**Prior (2026-07-01):** Staff registration form refinements — initials dropdown; Group A/B/C; prefixed staff numbers; field validation (name, NPS, PFMS). Migration `h8i9j0k1l2m3`.

**Prior (2026-06-30):** Staff numbers were one global 7-digit series (`1000001`–`1999999`); superseded by prefixed per-group sequences above.

**Prior fix (2026-06-30):** Sidebar submenu flyouts align correctly during impersonation.

**Not built yet (current priority):** Full **transaction logic** for the four core areas below — correct, reliable rules that govern how data moves and stays consistent.

**WIP / Uncommitted:** Leave policy overhaul (matrix UI, validation, seeds/migration `m3n4o5p6q7r8`), Apply Leave redesign, prior profile/dashboard slice.

---

## Core Transaction Logic — Build Roadmap

*Plain-language map for owner and agents. "Shell" = screens/APIs exist; "Transaction logic" = correct institutional rules still to implement or harden.*

### 1. User / employee registration

| Status | What exists | What transaction logic is still needed |
|---|---|---|
| Shell | Add employee form, CSV bulk import, auto-create login (username = emp code, temp password) | Full registration workflow: validation rules, approval before account goes live, linking user role (STAFF/HOD) at registration time, transfers between departments, deactivation/rejoin, password policy on first login |
| **Done (2026-07-01)** | **Auto staff number allotment** — per-group prefixed series (`FAC`, `NUR`, `NFS`, `DEP`, `CON`, `PGJR`, `PGNA`, `SRAC`, `SRNA` + 4 digits); numbers never reused | — |
| Shell | Admin can create standalone users (`users.py`) | Clear rule: when is a user created with vs without an employee record; roles centralized in `app/auth/roles.py` |
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
| Residency | JR_ACAD | 1 | Junior Resident (Academic) |
| Residency | JR_NA | 1 | Junior Resident (Non-Academic) |
| Residency | SR_ACAD | 1 | Senior Resident (Academic) |
| Residency | SR_NA | 1 | Senior Resident (Non-Academic) |

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
| **Master in DB** | 57 AIIMS departments loaded (seed `010` ran locally) | Hierarchy (parent depts) |
| Shell | CRUD: code, name, parent department | Cannot delete dept with active staff; transfers affecting approval chain |
| **Done (2026-07-01)** | **Nodal offices** — Establishment (CCS) + Registrar (residents); category-based leave routing | — |
| **Done (2026-07-03)** | **HOD Assignments** — one HOD per department via Masters tab | — |

**Suggested order:** Assign nodal officers in Masters → Nodal Offices (Establishment + Registrar).

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
| **Done (2026-07-03)** | **Leave lifecycle** — rejoin/cut-short, retrospective apply, recall nodal-only, `actual_rejoin_date` | — |
| **Done (2026-06-30)** | **Cancel/modify approved leave** — change-request workflow restores or adjusts balance on final approval | — |
| **Done (2026-06-30)** | **Validation engine** — MC requirement, min notice (EL), max stretch, workflow min/max days | **Done (2026-07-01)** CL DoPT rules: allow holiday/weekend attachment, 8-day absence span, EL/HPL sandwich ban, half-day emergency continuation |
| **Done (2026-06-30)** | **CL prefix/suffix** from config (legacy block flags for non-CL types) | — |
| **Done (2026-07-04)** | **Apply for Leave screen** — institutional proforma fields (applicant particulars, nature/period, leave account, purpose/contact, MC); PDF form catalogue removed | Acting arrangement field |
| **Done (2026-06-30)** | **Jan-1 annual credit scheduler** (optional, `ANNUAL_CREDIT_SCHEDULER_ENABLED`); manual button still available | — |
| Partial | Carry-forward (EL cap 300); one annual credit run (1 Jan) for CCS + residents | Year-end closing automation |

**Owner-confirmed leave policy (2026-06-30):**
- **Year boundary:** Calendar year (1 Jan – 31 Dec) for **both** regular staff and residents.
- **Regular staff (CCS):** Same rules for Faculty, Nursing, Admin — EL 30/yr, HPL 20/yr, CL 8/yr, etc. (seed `003`).
- **Residents:** Unified JR/SR rules — ANNUAL_RES **30/yr calendar** (pro-rata if joined mid-year), same annual pattern as staff; EOL/ML/PL tenure limits (seed `004`). **No monthly scheduler** (owner choice 2026-06-30).
- **Config approach:** Seed once (`python seeds/run.py`), then adjust in Masters → **Leave Policy**.

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

## Run Locally

```powershell
# Backend (backend/, venv activated)
python -m uvicorn main:app --reload    # http://127.0.0.1:8000

# Frontend
cd frontend && npm run dev             # http://localhost:5173
```

**Test accounts:** `admin` / `password` only (test staff purged). Use onboard form or `purge_test_data.py --reseed` to add sample users again.

**DB sync:** Only use `python scripts/db_sync.py pull|push` when user explicitly says **"with db"**. Otherwise code-only `git pull` / normal commit flow.

---

## Key Entry Points

| Area | Path / file |
|---|---|
| App shell & nav | `frontend/src/App.tsx` |
| Admin console UI | `frontend/src/pages/AdminDashboardPage.tsx` |
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
| **Before pilot / UAT** | Automated tests for critical journeys; fix security holes in active modules | CI pipeline ✓, leave e2e harness ✓, RBAC/integration tests ✓ — keep updated as features land |
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
| Phase-based file names | Confusing for developers only | ~~Optional rename sprint~~ **Done 2026-07-01** |
| No release tags for rollback | Rollback harder in emergency | Before first production deploy |

---

## Next Action

Onboard real staff via Masters → HR Operations, or run `purge_test_data.py --reseed` if you need quick demo users again. Then continue registration transaction logic hardening.


---

## Update Protocol (agents)

When updating this file after work:

1. Bump **Last updated** date.
2. Refresh **Current State** and **WIP / Uncommitted** from live `git status`.
3. Record durable changes (what shipped, what was validated).
4. Set **Next Action** to the concrete next step.
5. Do not duplicate session logs here — append detail to `HANDOFF.md` only when a full session summary is warranted.
