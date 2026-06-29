# Project Handoff Status

## Current State

**Stage:** Early active development — building **core transaction logic** (registration, departments, designations, leave mechanics). Phase 1–8 shell is foundation only.

**Next session:** Owner has **default field list** (staff registration), **department list**, and **designation list** ready to share. Start **Step 1: Masters** — import lists and align registration.

**Memory:** `PROJECT_CONTEXT.md` is the live handoff (auto-loaded by agents). This file holds session history.

---

## Session Summary (2026-06-29, continued — planning & handoff)

### 1. Project memory & development strategy
- Created `PROJECT_CONTEXT.md` and `.cursor/rules/project-memory.mdc` — agents auto-load memory; no need to ask for handoff each chat.
- Owner is **non-technical**; app is **early stage**; defer code-quality fixes until pilot/go-live triggers.
- **Deferred Improvements Backlog** captured in `PROJECT_CONTEXT.md` (CI, force-logout, etc.) — fix at optimum time, not now.

### 2. Quality review (deferred)
- Full quality assessment recorded in memory. Owner directed: **build features first**, harden before production.

### 3. Core transaction logic — build priority confirmed
Owner confirmed focus areas:
1. User / employee registration
2. Departments
3. Designations
4. Leave types and internal mechanics

Build sequence: Masters → Registration → Leave config → Leave transactions → Year-end.

### 4. Master data ready
Owner confirmed they have:
- Default **staff registration field list**
- **Department list**
- **Designation list**

To be provided at start of next session for Step 1 implementation.

### 5. Dedicated Admin Login & Strict Separation (same day, earlier)
- **Feature:** Added a dedicated, highly secure login portal (`/admin-login`) for system administrators with a distinct "System Administration" dark theme.
- **Strict Role Gatekeeping:**
  - Standard employees (`STAFF`, `HOD`, etc.) attempting to log in via `/admin-login` are immediately rejected.
  - Administrators (`ADMIN`) attempting to log in via the regular `/login` are blocked and redirected to the dedicated admin portal.
  - Ensures complete separation between employee workflows and system administration.

### 2. Branding & Encoding Fixes
- **Branding:** Simplified the login banners and sidebar/mobile headers from "AIIMS HRMS" and "AIIMS (Admin)" to a cleaner "HRMS" and "HRMS (Admin)".
- **Encoding:** Fixed a character encoding issue (mojibake) in `index.html` where an em-dash rendered as garbled text (`â€”`) in the browser tab title.

### 3. Admin Console UI Refinements
- **UI Optimization:** Standardized vertical spacing (`space-y-4`), padding (`p-4`), and grid gaps (`gap-4`) across all Admin Console screens (`Phase678Pages.tsx`) to achieve a professional data density.
- **Navigation Cleanup:** Removed the redundant horizontal scroll module menu from the Admin Dashboard, as all modules are easily accessible via the unified left sidebar hover-dropdown.
- **Menu Organization:** Relocated the "Admin Power Tools" (Impersonate, Maintenance, Broadcasts, Workflow Override, Audit Log, Bulk Roles) to the very bottom of the sidebar, below "System Config," for better logical grouping.

---

## Session Summary (2026-06-28)

### 1. Impersonation Feature ("Login As")
- **Feature:** Admin users can now log in as any other user without needing their password, specifically to view the system from their perspective and troubleshoot issues.
- **Backend:** Added `POST /api/v1/auth/impersonate/{target_user_id}` in `backend/app/api/v1/auth.py`. Embeds an `impersonated_by` claim in the JWT for audit traceability.
- **Frontend:** Updated Zustand `useAuthStore` to securely park the `adminToken` and `adminUser` state during impersonation. Added "Login As" action buttons to the Users & Roles table, and integrated a persistent amber "Impersonation Mode" banner in the main layout (`App.tsx`) to ensure visibility and allow exiting impersonation.

### 2. Sysadmin UI Adaptation
- **Bug/Issue:** The global layout treated pure `ADMIN` roles as standard employees, cluttering their sidebar with irrelevant modules (My Profile, Leave, Claims, etc.).
- **Fix:** Restructured the `App.tsx` navigation sidebar to conditionally hide all employee-centric modules when `role === 'ADMIN'`. Pure admins now exclusively see administrative menus (`HR Operations`, `Reports & Data`, `System Config`, `Admin Console`).
- **Routing:** Updated the root path (`/`) to automatically redirect `ADMIN` users to the `/admin` dashboard instead of loading the generic employee `HomeDashboardPage`.
- **Dynamic Context:** Using the "Login As" impersonation feature seamlessly switches the UI back into the standard employee view for the target user.

### 3. UI Fixes & Responsiveness Improvements
- Fixed structural `div` nesting and closing tag mismatches in `App.tsx` that caused frontend build failures (`TS17008`).
- Cleaned up duplicate state hooks and unused API calls in the global layout.
- Verified frontend compilation via `tsc -b && vite build` and backend syntax via Python compilation.

### 4. Cross-Platform Database Snapshot Sync
- **Feature:** Automated cross-platform syncing of the PostgreSQL test database snapshot via Git (`database/db_snap.sql`).
- **Implementation:** Created `scripts/db_sync.py` to seamlessly wrap `pg_dump` and `psql` for Windows & Mac portability, allowing the test database state to be ported exactly as it is across machines.
- **Agent Hand-off Protocol:** Updated local startup instructions to conditionally sync the database only when explicitly requested (`with db`), preventing accidental overwriting of local test data during normal `git pull` operations.

### 5. Admin Powers Implementation & UI Refactor
- **Features Implemented:** Added functional flows for Workflow Diagnostics & Override, System Maintenance Mode, Broadcast Management, Audit Log Explorer, and Bulk Role Matrix.
- **Backend:** Added new APIs in `admin.py` for audit logging (`/audit-log`) and bulk role updates (`/bulk-roles`). Audit logs now successfully track `impersonated_by` to trace actions back to the original admin during impersonation.
- **UI Refactor:** Refactored the UI for Admin Tools based on user feedback. The pop-up modal was completely removed. All tools are now accessible as direct, standalone links in the main sidebar (`/admin/tools/...`). Additionally, the main Admin Console dashboard link was converted into a hover-tree navigation (`NavDropdown`) linking directly to the various dashboard tabs.

---

## Session Summary (2026-06-27)

### 1. Header & Navigation UI Fixes
- **Bug:** The HOD login header text ("AIIMS HRMS") and navigation menu ("Approvals") were wrapping to a second row due to insufficient space and incorrect flex settings. The main menu dropdowns were also visually top-indented rather than vertically centered.
- **Fix:**
  - Added `whitespace-nowrap` to the main logo link and adjusted header flex container gaps (`gap-6` to `gap-4`, `gap-3` to `gap-2`).
  - Switched the navigation menu from `flex-wrap` to `flex-nowrap`.
  - Refactored `NavDropdown` in `App.tsx` to maintain identical DOM structure for items with and without landing pages, preventing bounding box discrepancies.
  - Replaced the invisible hover buffer `pb-2` with `py-2` in `NavDropdown` to balance vertical padding, restoring perfect vertical centering.
  - Added `whitespace-nowrap` to `NavDropdown` triggers and the right-side user info container to prevent word-wrapping for longer role names like `NODAL_OFFICER`, keeping the banner uniformly on a single row.

### 2. Nodal Officer Account Management
- **Feature:** Nodal Officers can now add and modify `STAFF` and `HOD` accounts, strictly restricted to the departments they are assigned to manage.
- **Backend:** 
  - Updated `_EDITOR_ROLES` in `employees.py` and modified `update_user` in `users.py`.
  - Added strict department validation checks using `dept_nodal_assignments`.
  - Disabled Bulk Import for Nodal Officers.
- **Frontend:** 
  - Updated `EMPLOYEE_MASTER_ROLES` in `App.tsx` to allow Nodal Officers access to the Employee Directory.
  - Hid the Bulk Import button for Nodal Officers in `EmployeeListPage.tsx`.

### 3. Data-Dense, Monochrome UI Overhaul
- **Aesthetic Shift:** Transitioned the dashboards (`Home`, `Approver`, `HOD`, `Performance`) from a "rainbow" color scheme to a premium, data-dense Monochrome (Slate/Indigo) layout. All cards are now crisp white with indigo hover states.
- **Global Density:** Compressed the `App.tsx` shell (Sidebar `w-64` to `w-56`, Header `h-16` to `h-12`) and reduced padding/font sizes in `NavDropdown` to maximize scannability without scrolling.
- **Dashboard Density:** Cut grid gaps from `gap-6` to `gap-3` and minimized padding across all modular dashboard cards.
- **Login Redesign:** Rebuilt `/login` with an immersive, dark glassmorphism aesthetic (`backdrop-blur-2xl`, deep slate gradients).
- **Typography:** Upgraded global font to `Inter` for crisp legibility at small sizes.

---

## Session Summary (2026-06-26)

### 1. Notification Body Fix
- **Bug:** Notification bell was displaying raw HTML tags as text (`<p>Dear...`) and garbled em-dashes (`â€"`) in subjects.
- **Fix (frontend):** Added `stripHtml()` helper in `Phase678Pages.tsx` to strip HTML to clean plain text for the bell dropdown.
- **Fix (backend):** Corrected mojibake encoding in `seeds/versions/005_email_templates.py` (UTF-8 em-dashes now stored correctly). Seed now **updates** existing rows on re-run.

### 2. Nodal Routing System (New Feature)
**Architecture:** Replaced the flat `ESTABLISHMENT_OFFICER → REGISTRAR` chain with a configurable, department-aware `HOD → NODAL_OFFICER` routing system.

| Component | File | Change |
|---|---|---|
| Migration `0003` | `alembic/versions/0003_nodal_routing.py` | New `dept_nodal_assignments` table |
| Model | `app/models/employee.py` | `DeptNodalAssignment` ORM model |
| Auth scope | `app/auth/dependencies.py` | `NODAL_OFFICER` role gets dept-scoped employee view |
| Leave approvals | `app/api/v1/leave_approvals.py` | `_resolve_approver_user` now department-aware for `NODAL_OFFICER`; inbox query uses nodal assignment JOIN; action auth validates dept mapping |
| Seed `008` | `seeds/versions/008_nodal_routing_test_data.py` | Full 10×10 test dataset (see below) |

**Leave workflow for nodal routing:**
```
Staff → HOD (dept, step 1) → NODAL_OFFICER (dept-specific, step 2, FINAL)
```

**Test accounts (all password: `password`):**
| Username | Role |
|---|---|
| `admin` | ADMIN (central, no employee) |
| `testStaff1`..`testStaff10` | STAFF |
| `testHod1`..`testHod10` | HOD (one per dept) |
| `testNodal1`..`testNodal10` | NODAL_OFFICER (one per dept, final) |

Also seeded: `testDept1-10`, `testDesig1-10`, `testLeaveType1-10`, 100 leave balance records (15 days each).

### 3. Category Landing Pages & e-Service Book (Hub & Spoke UI)
- **Architecture:** Transitioned from a simple top-navbar to a "Hub & Spoke" dashboard model, mimicking enterprise ERPs (e.g. Workday, SAP).
- **Navigation (`App.tsx`):** Added Hover Dropdowns for all major modules. The headers themselves are now clickable links pointing to central landing dashboards.
- **Dashboards:**
  - **Home (`/`):** A centralized landing page with a welcome banner and quick-links to all hubs.
  - **My Profile (`/profile-dashboard`):** Landing page for e-Service Book and Dependents, featuring a sleek user summary banner.
  - **Leave & Attendance (`/leave-dashboard`):** Dedicated space for leave applications, history, and balances (re-purposed from old Staff Profile). Employee details removed and UI shrunk for higher data density.
  - **Claims & Advances (`/claims`):** Hub for LTC, CEA, EHS, TA, Telephone claims.
  - **Payroll & Finance (`/payroll`):** Hub for Salary Slips, Annual Summary, Form 16.
  - **Performance (`/performance`):** Hub for APAR and Training logs.
- **Under Construction Pages:** Created a standardized placeholder component for pending CCS modules.

### 4. Database Seed Cleansing (Leave Types)
- **Action:** Executed a SQL truncate on `leave_types` and its dependents (`leave_entitlement_rules`, `leave_balances`, `leave_applications`).
- **Fix:** Removed hardcoded CCS and Resident rules from `002_leave_types.py`, `003_ccs_entitlement_rules.py`, and `004_resident_entitlement_rules.py` to allow the Admin panel to cleanly seed them as needed.

### 5. General Navigation & UI/UX Updates
- Fixed CSS hover dead-zones in `App.tsx` dropdowns (switched `mt-1` to `pt-1` invisible wrapper).
- **Leave Account View (`Phase5Pages.tsx`):**
  - Removed bulky balance cards in favor of a clean, dense data table.
  - Extracted the Financial Year into a global "Leave Year" dropdown filter.
  - Implemented auto-loading of balances on mount.
  - Fully removed the overly complex "Balance Projection" feature to simplify the UX.

### 6. Ledger Approval Chain Fix
- **Bug:** Ledger view was displaying all global and departmental approval chains instead of just the one applicable to the selected leave type.
- **Fix (backend):** Updated the `get_ledger` endpoint in `leave_balances.py` to order chains by specificity (`category_id` and `leave_type_id`) and limit to `1`, mirroring the logic used in leave applications.

### 7. Approver & Admin UI Redesign
- **Approver Workspace (`ApproverDashboardPage.tsx`):** Created a dedicated, hub-style dashboard for HOD and Nodal Officers displaying dynamic "Acting As" roles, an Approval Inbox, and Team Calendar links.
- **Approval Inbox Polish:** Refined `ApprovalInboxPage` to use wide sleek cards, color-coded SLA and Pending hours indicators, and inline Approve/Forward/Reject buttons.
- **System Config Matrices (`Phase3Pages.tsx`):** Standardized all tables (Leave Types, Entitlement Rules, Holidays, Workflows, Opening Balances) to match the sleek UI, using padded data grids and unified `PageHeader` components.

---

## Full Role Hierarchy

| Role | Data Scope | Key Capability |
|---|---|---|
| `ADMIN` | All | System config, user mgmt, audit |
| `DIRECTOR` | All | Read-only institutional view |
| `REGISTRAR` | CCS staff | Approver in old chain; reports/payroll |
| `ESTABLISHMENT_OFFICER` | CCS staff | Masters, employee CRUD, balances, reports |
| `DEAN_ACADEMIC` | Residents | Final approver for resident leave |
| `HOD` | Own department | First-stage approver |
| `NODAL_OFFICER` | Assigned depts | Final approver in nodal chain |
| `STAFF` | Own record | Apply leave, view balances |

---

## Available Features
- JWT Authentication with mandatory first-login password change, account lockout, token blacklist
- Core Entities: Departments, Designations, Employees, bulk CSV import
- Dynamic Multi-stage Leave Workflows (configurable; supports HOD → Nodal and HOD → Estab → Registrar)
- **Configurable dept→nodal officer mapping** (`dept_nodal_assignments` table)
- Robust Leave Balance arithmetic with concurrent protections
- Automated in-app + email notifications (HTML templates, encoding fixed)
- Security: rate-limiting (SlowAPI), strict RBAC, employee data scoping
- Sanction PDF generation & payroll CSV exports
- Reports: leave register, abstract, balance summary, leave calendar
- **Staff Profile Page** at `/profile`
- Admin dashboard with audit log, health metrics, force-logout

---

## Syncing & Running Locally (Mac & Windows)
**Agent Instruction:** Only sync the database if the user explicitly includes "with db" in their hand-off or push/pull request. If they simply say "take hand off" or "push/pull", only sync the code normally without touching the database snapshot.

**1. Code & Database Sync (when explicitly requested "with db"):**
- **Pulling:** `python scripts/db_sync.py pull` (Pulls code AND restores DB snapshot).
- **Pushing:** `python scripts/db_sync.py push` (Dumps DB to snapshot, commits, and pushes code).

**2. Standard Code Sync (default):**
- **Pulling:** `git pull`
- **Pushing:** standard `git add`, `git commit`, `git push` flow.

**3. Start the Servers:**
| Service | Command (with environment activated) | URL |
|---|---|---|
| Backend | `cd backend && python -m uvicorn main:app --reload` | http://127.0.0.1:8000 |
| Frontend | `cd frontend && npm run dev` | http://localhost:5173 |

## Next Steps

1. **New session:** Owner shares staff registration fields, department list, designation list.
2. **Step 1:** Load masters into system; align registration screens.
3. **Step 2–4:** Registration flow → leave config → leave transaction engine.
4. Defer production hardening per `PROJECT_CONTEXT.md` until pilot/go-live.
5. Reference `docs/GO_LIVE_RUNBOOK.md` when deployment approaches.
