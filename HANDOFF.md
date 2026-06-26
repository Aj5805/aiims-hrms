# Project Handoff Status

## Current State
The AIIMS HRMS project has successfully completed Phase 8 and two additional post-phase feature sessions.

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
  - **My Profile (`/profile-dashboard`):** Landing page for e-Service Book and Dependents.
  - **Leave & Attendance (`/leave-dashboard`):** Dedicated space for leave applications, history, and balances (re-purposed from old Staff Profile). Employee details removed.
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

## Running Locally

| Service | Command | URL |
|---|---|---|
| Backend | `cd backend && .venv\Scripts\python.exe -m uvicorn main:app --reload` | http://127.0.0.1:8000 |
| Frontend | `cd frontend && npm run dev` | http://localhost:5173 |
| Seed data | `cd backend && .venv\Scripts\python.exe seeds\run.py` | — |
| Migrations | `cd backend && .venv\Scripts\python.exe -m alembic upgrade head` | — |

## Next Steps
The project is functionally complete with the nodal routing and profile page additions.
Reference `docs/GO_LIVE_RUNBOOK.md` for production deployment instructions.
