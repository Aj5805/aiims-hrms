Here is the **final, fully integrated implementation plan**. All sections are now in a single, cohesive document, incorporating the critical feedback from DeepSeek and Notion, with the new policy matrix, migration protocols, report specifications, and operational runbooks woven directly into the relevant phases.


---


# AIIMS Bibinagar — Leave Management System

# Master Implementation Plan & Agent Handoff Log (FINAL)


---


## DOCUMENT PURPOSE


This is the **single source of truth** for all development agents working on this project.


Every agent must:

1\. Read the **Project Snapshot** and **Current Status** sections on arrival

2\. Read the **Immediate Next Action** block — that is your starting task

3\. On completion, update the **Agent Log** and rewrite the **Immediate Next Action** block

4\. Never begin work without reading this document first

5\. Never leave without updating this document


---


## PROJECT SNAPSHOT


| Item | Value |

|---|---|

| **Project name** | AIIMS Bibinagar Leave Management System (LMS) |

| **Client** | AIIMS Bibinagar, Establishment & Dean Academic Office |

| **Nature** | Internal LAN-only web application, Windows Server deployment |

| **Users** | ~1000 staff, <50 concurrent |

| **Primary offices** | Establishment (Regular staff), Dean Academic Office (Residents) |

| **Repo name** | `aiims-lms` (to be initialised) |

| **Design decisions doc** | Sections below — do not override without explicit instruction |


---


## TECH STACK (LOCKED)


| Layer | Choice | Rationale |

|---|---|---|

| **Backend** | FastAPI (Python 3.11+) | Async, auto OpenAPI docs, Pydantic validation |

| **ORM** | SQLAlchemy 2.0 + Alembic | Migration history is mandatory |

| **Database** | PostgreSQL 16 | Audit trails, complex leave arithmetic, future payroll integration |

| **Frontend** | React 18 + Vite + Tailwind CSS | Consistent with institutional preference |

| **Email** | `fastapi-mail` via Zoho SMTP | Institutional IDs @aiimsbibinagar.edu.in; app-password auth |

| **PDF generation** | WeasyPrint | HTML→PDF for leave sanction copies |

| **Background tasks** | APScheduler (inside FastAPI) | Email queue processing every 2 min |

| **Windows service** | Uvicorn + NSSM | FastAPI served as Windows background service |

| **Reverse proxy** | Nginx for Windows | LAN access via IP:80 or hostname |

| **Authentication** | JWT (access token 8h) + refresh token 7d | Role-based, no external SSO for v1 |

| **API Versioning** | `/api/v1/` prefix on all routes | Allows future breaking changes without disrupting live clients |

| **Caching** | `cachetools` in‑memory TTL cache | Redis deferred to v2 – Windows Redis is complex; in‑memory is sufficient for <50 users |

| **State Management** | TanStack Query + Zustand | Server state via React Query; local/UI state via Zustand |


---



### Timezone (Locked)
- **All business dates and day-boundaries follow IST (Asia/Kolkata).**
- UI accepts and displays dates/times in IST.
- Store timestamps in DB as `TIMESTAMPTZ` and treat them as IST for reporting; no DST handling required.
- Leave day counting uses **calendar dates in IST** (00:00–23:59 IST).

## TESTING STRATEGY (MANDATORY — NOT OPTIONAL)


> Every phase must ship with tests before moving to the next phase. No exceptions.


### Backend — pytest

| Layer | Tool | Coverage target |

|---|---|---|

| Unit: models, services, business logic | `pytest` + `pytest-asyncio` | 80% minimum |

| Integration: API endpoints + DB | `pytest` + `httpx AsyncClient` + test DB | All happy paths + critical failure paths |

| Leave arithmetic | Dedicated test suite | 100% — balances, pro-rata, carry-forward |

| Workflow resolution | Dedicated test suite | All routing permutations |


**Test DB:** Separate PostgreSQL database `aiims_lms_test`. Seeded fresh per test session via fixtures. Never runs against production DB.


**Key test cases that must exist (non-negotiable):**

\- Balance deduction: apply 10 days EL → balance reduces by exactly 10

\- Pro-rata for JR_NA joining mid-month: correct days credited

\- CL + holiday prefix: application rejected at API level

\- Workflow resolver: correct chain fires for each (category × leave_type × duration) combination

\- Duplicate application: overlapping dates for same employee → rejected

\- Concurrent balance deduction: two simultaneous approvals → only one succeeds (race condition test)

\- Resident leave year boundary: application spanning anniversary date → correct year split

\- Carry-forward cap: EL balance capped at 300 on year-end run

\- EOL tenure cap: JR_ACAD blocked after 30 days EOL in tenure

\- **Policy matrix tests:** half-day rounding, sandwich rule (holidays/weekends), CL prefix/suffix, mid-year pro-rata, approver modification, recall restoration


### Frontend — Vitest + React Testing Library

| Layer | Tool |

|---|---|

| Component unit tests | Vitest + React Testing Library |

| Form validation tests | Vitest (date range picker, half-day toggle, balance check) |

| API mock layer | MSW (Mock Service Worker) |


**Key frontend test cases:**

\- Leave form: to_date before from_date → error shown

\- Balance indicator: goes red when applied days > available balance

\- Approval inbox: only shows items matching user's role

\- PDF download button: only visible when status = APPROVED


### Performance baseline (updated – per‑endpoint)

| Endpoint | Target (p95) | Data volume |

|---|---|---|

| `GET /api/v1/leave-applications` (filtered) | < 500 ms | 1,000 employees, last 12 months |

| `POST /api/v1/leave-applications` | < 2 s (includes background email queue) | – |

| `GET /api/v1/reports/leave-register` | < 5 s | 1,000 employees, 2‑year range |

| `GET /api/v1/leave-applications/:id/sanction-pdf` | < 10 s | – |

| `POST /api/v1/auth/login` | < 200 ms | – |

| All other endpoints | < 300 ms | – |


**Tool:** `locust` — load test script in `tests/load/` for Phase 8.


### Pre-commit hooks (local, no CI server needed)

```

# .pre-commit-config.yaml

\- ruff (lint + format, Python)

\- mypy (type checking, Python)

\- eslint + prettier (JS/JSX)

\- pytest (run unit tests only, not integration — fast)

```


---


## SECURITY PROTOCOLS (COMPREHENSIVE)


### Authentication & Session

| Control | Implementation |

|---|---|

| JWT access token | 8h expiry, HS256, secret min 64 chars in `.env` |

| JWT refresh token | 7d expiry, stored in `HttpOnly` cookie (not localStorage) |

| Token blacklist on logout | Store invalidated JTI in Redis or `token_blacklist` PG table with TTL |

| Refresh token rotation | New refresh token issued on every use; old one invalidated |

| Failed login lockout | 5 attempts → 15‑min lockout, logged to audit_log |

| Session fixation | New token pair issued on password change |

| First-login forced reset | `must_change_password` flag on `users` table |

| Concurrent session control | v1: allow multiple sessions; v2: configurable |


**Add to schema — `token_blacklist` table:**

```

token\_blacklist

&nbsp; jti UUID PK          -- JWT ID claim

&nbsp; user\_id UUID FK

&nbsp; expires\_at TIMESTAMP -- cleanup job removes expired rows nightly

&nbsp; created\_at TIMESTAMP DEFAULT now()

```


### Authorisation (RBAC — Row Level)

**Critical rule: role alone is insufficient. Data scope must also be enforced.**


| Role | Can view leave applications of |

|---|---|

| STAFF | Own only |

| HOD | Own department employees |

| DEAN_ACADEMIC | All residents |

| ESTABLISHMENT_OFFICER | All regular staff |

| REGISTRAR | All regular staff |

| DIRECTOR | All |

| ADMIN | All |


Every `/leave-applications` list query must filter by `employee_scope(current_user)`. This is enforced in a reusable FastAPI dependency, not per‑endpoint. **Never trust frontend filtering alone.**




### Access Governance (Role Granting + Review)
- **Principle:** RBAC must be enforced server-side (already specified). This section governs *who can change access*.
- **Role grant authority (single-org):**
	- **ADMIN**: can create/activate/deactivate users, reset passwords, and assign operational roles (e.g., STAFF/HOD/ESTABLISHMENT/DEAN_ACADEMIC/REGISTRAR/DIRECTOR).
	- **DIRECTOR** (or delegated authority): final authority for assigning **ADMIN** role.
- **Maker-checker for privileged changes (recommended):**
	- Changes that grant **ADMIN** or expand scope (e.g., HOD → department head) require **two-person approval**: Maker = ADMIN, Checker = DIRECTOR (or designated authority).
	- All role changes must write to `audit_log` with: actor, before/after role, timestamp (IST), reason/remarks.
- **Periodic access review:**
	- Frequency: **Quarterly** (or monthly during first 3 months after go-live).
	- Output: export list of active users + roles + department scope; signed off by Establishment + Dean Academic + Director’s office.
	- Any leavers/transfers must be deactivated within **2 working days** of notice.
### Input Validation & Injection Prevention

| Threat | Control |

|---|---|

| SQL injection | SQLAlchemy ORM only — no raw SQL. JSONB queries use parameterised syntax |

| XSS in PDF | WeasyPrint renders HTML — sanitise all user‑supplied text via `bleach` before injecting into PDF template |

| Path traversal on file upload | Store files with UUID filename only; original filename stored in DB but never used in filesystem path |

| File upload type bypass | Check MIME type via `python‑magic` (not just extension); whitelist PDF/JPG/PNG |

| File size | 5MB hard limit enforced at FastAPI middleware level, not just frontend |

| JSONB injection | Validate JSONB structure via Pydantic before write; never trust raw JSONB from client |

| Mass assignment | Pydantic `model_config = ConfigDict(extra='forbid')` on all request schemas |


### API Security

| Control | Implementation |

|---|---|

| Rate limiting | `slowapi`: 5/min on auth, 100/min on general endpoints, 10/min on export endpoints |

| CORS | Restrict to server's own LAN IP in production (not `*`) |

| HTTPS | Self‑signed cert via Nginx (LAN). HTTP → HTTPS redirect enforced. Document cert installation for Windows. |

| Security headers | Nginx adds: `X‑Frame‑Options: DENY`, `X‑Content‑Type‑Options: nosniff`, `Referrer‑Policy: no‑referrer`, `Content‑Security‑Policy` |

| Request size limit | Nginx + FastAPI: max body 10MB |

| Sensitive data in logs | Logger filters: mask email, remarks, names in DEBUG output. INFO and above: IDs only. |


### Data Security

| Control | Implementation |

|---|---|

| Password hashing | `bcrypt` with cost factor 12 |

| Secrets in code | Zero tolerance — pre‑commit hook rejects commits containing SMTP passwords or JWT secrets |

| `.env` never committed | `.gitignore` enforced; `.env.example` with dummy values only |

| Audit log immutability | PostgreSQL trigger: `BEFORE UPDATE OR DELETE ON audit_log → RAISE EXCEPTION` |

| Backup encryption | `pg_dump` output piped through `gpg` symmetric encryption before storage |

| File storage | Uploaded files stored outside web root (`/uploads/` not inside `static/`) |

| Data retention | Leave applications: permanent. Audit logs: 7 years (statutory). Notification queue: 90 days. Export files: 1 year. Cleanup job in Phase 8. |


### Known Gaps Accepted for v1 (Document Here)

| Gap | Accepted risk | Mitigation |

|---|---|---|

| No 2FA | Low risk on LAN‑only | v2 consideration |

| Self‑signed TLS cert | Browser warning on first visit | Document cert install for all machines |

| No WAF | Internal LAN, no internet exposure | Acceptable |

| No penetration test | Internal system | UAT includes manual security review |


---


## LEAVE POLICY RULE MATRIX (Arithmetic & Logic) — SINGLE SOURCE OF TRUTH


> **Purpose:** Every rule here is testable as a unit test case. No ambiguity — if it's not here, it doesn't exist.


| Rule Category | Rule | Implementation |

|---|---|---|
| **Comp-Off claim requirement** | Any staff may apply for Comp-Off only with **remarks** and **supporting document upload** (mandatory). | UI: enforce remarks + attachment required for leave_type=COMP_OFF. Backend: validate and reject if missing. |

| **Half‑day** | Allowed only if `leave_types.is_half_day_allowed = TRUE`. | Applied days stored as `0.5`. Two half‑days on same date are **not** permitted. |

| **Half‑day session** | `FN` = 0.5 day, `AN` = 0.5 day. | No additional rounding. Credit/debit numeric remains `0.5`. |

| **Sandwich rule (holidays between leave days)** | If a holiday falls **between** two leave days (e.g., Wed & Fri, Thu is a gazetted holiday), the holiday **is not counted** as leave. | Day count logic: iterate over date range, skip dates in `holiday_master` **only if** they are enclosed by leave days on both sides. |

| **Sandwich rule (weekends)** | Weekends (Sat/Sun) are **not counted** as leave for CCS staff unless they are part of a continuous leave chain. | Same logic as holidays: skip if enclosed. |

| **CL prefix/suffix** | CL cannot be **prefixed** or **suffixed** to holidays. | Validation rule: `(from_date - 1)` and `(to_date + 1)` must **not** be a holiday. |

| **Mid‑year joining (pro‑rata)** | Days credited = (days_per_year / 365) × (days remaining in leave year). Rounded **up** to 0.5 day increments. | Decimal days (e.g., 2.5) stored exactly; rounding applied only on final **display**. |

| **Approver modification impact** | If approver modifies dates/days, the **balance is recomputed** atomically on final approval. | The balance deduction is re‑run using the modified dates, not the original application. Audit log captures both. |

| **Medical Certificate (MC) rules** | If `requires_mc = TRUE`, MC document is mandatory at submission time. MC issue date must be within 3 days of leave start date (configurable). | Backend: reject if missing/outside window. Admin configurable via `validation_rules` JSONB. |
| **Backdated leave** | Applications with `from_date` < today are **not allowed** for v1. | Validation: `from_date >= current_date` at submission time. |

| **Recall balance restoration** | On RECALLED, balance is **fully restored** for the days originally approved, minus any LOP days already processed. | LOP processing is v2, so v1 restores full days. |


---


## MISSING WORKFLOW SCENARIOS (Added to Plan)


These must be handled in Phase 4 — not afterthoughts:


**1. Approver is the applicant (HOD applying for their own leave)**

Resolution: Skip HOD step, escalate directly to next level. Configured in `workflow_steps` via `skip_if_self_applicant BOOLEAN` flag — add this column to `workflow_steps`.


**2. Acting arrangement / Leave delegation**

When HOD is on leave, a designated alternate (stored in `acting_arrangement_emp_id` on the HOD's own leave application) inherits the inbox. API checks: if assigned approver has an approved leave overlapping today → route to acting arrangement person instead.


**3. Recall of approved leave**

Post‑approval, employee may want to cancel (returned early from leave). Flow: Employee requests recall → Establishment/HOD confirms → balance restored → audit logged. Add status `RECALLED` to `leave_applications.status` enum.


**4. Concurrent overlapping applications (race condition)**

Two applications for overlapping dates must be blocked. Enforce via PostgreSQL constraint:

```sql

-- Partial exclusion constraint using btree\_gist extension

CREATE EXTENSION IF NOT EXISTS btree\_gist;

ALTER TABLE leave\_applications

ADD CONSTRAINT no\_overlapping\_approved\_leave

EXCLUDE USING gist (

&nbsp; employee\_id WITH =,

&nbsp; daterange(from\_date, to\_date, '\[]') WITH &&

) WHERE (status IN ('SUBMITTED','UNDER\_REVIEW','APPROVED'));

```


**5. Balance race condition on simultaneous approval**

Final approval step must use `SELECT ... FOR UPDATE` on `leave_balances` row before deducting. Prevents double deduction if two approvers act simultaneously on two different applications for the same employee.


**6. Browser support**

Minimum: Chrome 90+, Edge 90+, Firefox 88+. No IE11 support. Document this. Government machines often have old Chrome — test explicitly on Chrome 90.


---


## DESIGN DECISIONS (LOCKED — DO NOT CHANGE WITHOUT ANNOTATING HERE)


### Staff categories in scope (v1)

\- **Regular Staff:** Faculty, Nursing, Non‑Faculty/Admin → CCS (Leave) Rules 1972 full compliance

\- **Residents:** JR Academic, SR Academic, JR Non‑Academic, SR Non‑Academic → Residency scheme

\- **Deferred to v2:** Contract staff, Outsourced staff, MBBS students, Interns, Paramedical students


### Leave year definitions

\- Regular Staff → Financial year (1 Apr – 31 Mar)

\- Residents → Joining‑date anniversary year (dynamic per employee)


### Leave types in scope
- **Compensatory Off (Comp-Off)** — claimable by any staff with remarks + supporting document upload; approval flow same as normal leave.

CCS full suite: EL, HPL, Commuted Leave, CL, ML, PL, CCL, EOL, OD, Study Leave, Sabbatical

Resident scheme: Annual leave (pro‑rata), EOL, ML, PL per GoI rules


### CL combining rule

Strict CCS — CL cannot be combined with other leave types or prefixed/suffixed with holidays.

Stored as a configurable rule in `leave_types.validation_rules` JSON. Can be relaxed per admin config.


### Approval workflow

\- Rule‑based configurator (Option A): Leave type + duration thresholds → approver chain

\- No auto‑approvals ever

\- No hard‑coded chains — all routing via `workflow_configs` + `workflow_steps` tables

\- Dean Academic Office handles all resident leave

\- Establishment handles regular staff leave (Registrar configurable)


### Notifications

\- In‑app (all staff) + Email (staff with `has_institutional_email = true`)

\- Graceful fallback: staff without institutional email → in‑app only, no error thrown

\- Email via Zoho SMTP with 12‑digit app password (stored in `.env`, never in code)

\- Async queue via `notification_queue` table, APScheduler polls every 2 min, max 3 retries

\- **Email flood protection:** batch size = 5 per poll; rate limit 10 emails/minute per Zoho free tier


### PDF leave orders

\- Optional, on‑demand post‑approval

\- Simple formatted HTML→PDF via WeasyPrint

\- No signature blocks, no DSC


### Integrations (v1: none, but interface‑ready)

\- Payroll: LOP days + encashment data exportable as structured CSV/Excel

\- Biometric: `attendance_raw` table reserved in schema, not populated in v1


### Deployment

\- Windows Server (spec TBD by IT)

\- Accessible on LAN via `http://<server‑ip>` or hostname

\- `.env` file holds all secrets — never committed to repo

\- NSSM runs FastAPI as Windows Service

\- Nginx for Windows as reverse proxy on port 80

\- **Rollback plan:** documented in `deployment/ROLLBACK.md` — includes DB migration downgrade, code revert to previous Git tag, frontend rollback, and data restore procedure.


---


## DATABASE SCHEMA (19 TABLES)


### Group 1 — Identity & Auth

```

users

&nbsp; id UUID PK

&nbsp; username VARCHAR(50) UNIQUE NOT NULL

&nbsp; password\_hash TEXT NOT NULL

&nbsp; employee\_id UUID FK → employees.id UNIQUE

&nbsp; role VARCHAR(30) NOT NULL  -- STAFF | HOD | DEAN\_ACADEMIC | REGISTRAR | ESTABLISHMENT | DIRECTOR | ADMIN

&nbsp; is\_active BOOLEAN DEFAULT true

&nbsp; must\_change\_password BOOLEAN DEFAULT false

&nbsp; last\_login TIMESTAMP

&nbsp; created\_at TIMESTAMP DEFAULT now()

&nbsp; updated\_at TIMESTAMP DEFAULT now()

```


### Group 2 — Employee Master

```

employee\_categories

&nbsp; id UUID PK

&nbsp; code VARCHAR(20) UNIQUE NOT NULL   -- FACULTY | NURSING | ADMIN | JR\_ACAD | SR\_ACAD | JR\_NA | SR\_NA

&nbsp; name VARCHAR(100) NOT NULL

&nbsp; leave\_scheme VARCHAR(20) NOT NULL  -- CCS | RESIDENCY

&nbsp; tenure\_based BOOLEAN DEFAULT false

&nbsp; tenure\_months INT                  -- 36 for JR/SR Acad, 6 for JR/SR NA

&nbsp; created\_at TIMESTAMP DEFAULT now()


departments

&nbsp; id UUID PK

&nbsp; code VARCHAR(20) UNIQUE NOT NULL

&nbsp; name VARCHAR(150) NOT NULL

&nbsp; parent\_dept\_id UUID FK → departments.id (nullable)

&nbsp; managing\_office VARCHAR(50)        -- ESTABLISHMENT | DEAN\_ACADEMIC | REGISTRAR

&nbsp; created\_at TIMESTAMP DEFAULT now()


designations

&nbsp; id UUID PK

&nbsp; name VARCHAR(150) NOT NULL

&nbsp; grade\_pay\_level VARCHAR(20)        -- 7th CPC pay level

&nbsp; category\_id UUID FK → employee\_categories.id

&nbsp; created\_at TIMESTAMP DEFAULT now()


employees

&nbsp; id UUID PK

&nbsp; emp\_code VARCHAR(20) UNIQUE NOT NULL

&nbsp; name VARCHAR(200) NOT NULL

&nbsp; gender VARCHAR(10) NOT NULL        -- MALE | FEMALE | OTHER

&nbsp; dob DATE

&nbsp; doj DATE NOT NULL                  -- date of joining — critical for resident leave year

&nbsp; category\_id UUID FK → employee\_categories.id NOT NULL

&nbsp; department\_id UUID FK → departments.id NOT NULL

&nbsp; designation\_id UUID FK → designations.id NOT NULL

&nbsp; reporting\_officer\_id UUID FK → employees.id (nullable)

&nbsp; email VARCHAR(255)

&nbsp; has\_institutional\_email BOOLEAN DEFAULT false

&nbsp; personal\_email VARCHAR(255)        -- fallback for future use, not used in v1

&nbsp; is\_active BOOLEAN DEFAULT true

&nbsp; created\_at TIMESTAMP DEFAULT now()

&nbsp; updated\_at TIMESTAMP DEFAULT now()

```


### Group 3 — Leave Configuration

```

leave\_types

&nbsp; id UUID PK

&nbsp; code VARCHAR(20) UNIQUE NOT NULL   -- EL | HPL | CL | ML | PL | CCL | EOL | OD | STUDY | SABBATICAL | ANNUAL\_RES | COMP\_OFF

&nbsp; name VARCHAR(100) NOT NULL

&nbsp; scheme VARCHAR(20) NOT NULL        -- CCS | RESIDENCY | BOTH

&nbsp; is\_accumulating BOOLEAN DEFAULT false

&nbsp; max\_accumulation INT               -- e.g., 300 for EL

&nbsp; requires\_mc BOOLEAN DEFAULT false

&nbsp; min\_days\_for\_mc INT                -- e.g., HPL > 3 days needs MC

&nbsp; count\_holidays BOOLEAN DEFAULT true

&nbsp; is\_half\_day\_allowed BOOLEAN DEFAULT false

&nbsp; carry\_forward BOOLEAN DEFAULT false

&nbsp; encashable BOOLEAN DEFAULT false

&nbsp; validation\_rules JSONB             -- CL-no-prefix, EL-min-notice, etc.

&nbsp; created\_at TIMESTAMP DEFAULT now()


leave\_entitlement\_rules

&nbsp; id UUID PK

&nbsp; category\_id UUID FK → employee\_categories.id NOT NULL

&nbsp; leave\_type\_id UUID FK → leave\_types.id NOT NULL

&nbsp; year\_ref VARCHAR(20) NOT NULL      -- FINANCIAL | CALENDAR | JOINING\_DATE

&nbsp; days\_per\_year NUMERIC(5,2)

&nbsp; prorata\_rate NUMERIC(4,2)          -- days per month (for residency scheme: 2.5)

&nbsp; year1\_days NUMERIC(5,2)            -- override for year1 (JR Acad: 30, yr2/3: 36)

&nbsp; year2\_plus\_days NUMERIC(5,2)

&nbsp; max\_at\_a\_stretch INT

&nbsp; max\_in\_tenure NUMERIC(5,2)         -- EOL: 30 days per tenure

&nbsp; carry\_forward BOOLEAN DEFAULT false

&nbsp; special\_rules JSONB                -- exam\_extension, tenure\_extension, no\_combination flags

&nbsp; UNIQUE(category\_id, leave\_type\_id)

&nbsp; created\_at TIMESTAMP DEFAULT now()


holiday\_master

&nbsp; id UUID PK

&nbsp; year INT NOT NULL

&nbsp; holiday\_date DATE NOT NULL

&nbsp; holiday\_name VARCHAR(200) NOT NULL

&nbsp; holiday\_type VARCHAR(20) NOT NULL  -- GAZETTED | RESTRICTED | OPTIONAL

&nbsp; applicable\_to VARCHAR(20) DEFAULT 'ALL'  -- ALL | REGULAR | RESIDENT

&nbsp; UNIQUE(holiday\_date, holiday\_type)

&nbsp; created\_at TIMESTAMP DEFAULT now()

```


### Group 4 — Leave Transactions

```

leave\_balances

&nbsp; id UUID PK

&nbsp; employee\_id UUID FK → employees.id NOT NULL

&nbsp; leave\_type\_id UUID FK → leave\_types.id NOT NULL

&nbsp; leave\_year INT NOT NULL            -- YYYY of year start

&nbsp; year\_start\_date DATE NOT NULL      -- Apr 1 for regular; joining anniversary for residents

&nbsp; opening\_balance NUMERIC(6,2) DEFAULT 0

&nbsp; credited NUMERIC(6,2) DEFAULT 0

&nbsp; availed NUMERIC(6,2) DEFAULT 0

&nbsp; lop\_days NUMERIC(6,2) DEFAULT 0

&nbsp; closing\_balance NUMERIC(6,2) GENERATED ALWAYS AS (opening\_balance + credited - availed) STORED

&nbsp; last\_updated TIMESTAMP DEFAULT now()

&nbsp; UNIQUE(employee\_id, leave\_type\_id, leave\_year)


leave\_applications

&nbsp; id UUID PK

&nbsp; app\_number VARCHAR(30) UNIQUE NOT NULL  -- LMS/2026/00001 auto-generated

&nbsp; employee\_id UUID FK → employees.id NOT NULL

&nbsp; leave\_type\_id UUID FK → leave\_types.id NOT NULL

&nbsp; from\_date DATE NOT NULL

&nbsp; to\_date DATE NOT NULL

&nbsp; applied\_days NUMERIC(5,2) NOT NULL

&nbsp; is\_half\_day BOOLEAN DEFAULT false

&nbsp; half\_day\_session VARCHAR(10)           -- FN | AN

&nbsp; reason TEXT NOT NULL

&nbsp; address\_during\_leave TEXT

&nbsp; status VARCHAR(20) DEFAULT 'DRAFT'

&nbsp;   -- DRAFT | SUBMITTED | UNDER\_REVIEW | APPROVED | REJECTED | RETURNED | WITHDRAWN | CANCELLED | RECALLED

&nbsp; acting\_arrangement\_emp\_id UUID FK → employees.id (nullable)

&nbsp; current\_step\_order INT DEFAULT 1       -- tracks where in workflow

&nbsp; submitted\_at TIMESTAMP

&nbsp; last\_action\_at TIMESTAMP

&nbsp; created\_at TIMESTAMP DEFAULT now()

&nbsp; updated\_at TIMESTAMP DEFAULT now()


leave\_documents

&nbsp; id UUID PK

&nbsp; application\_id UUID FK → leave\_applications.id NOT NULL

&nbsp; doc\_type VARCHAR(30) NOT NULL          -- MEDICAL\_CERTIFICATE | SUPPORTING\_DOC | OTHER

&nbsp; file\_path TEXT NOT NULL                -- relative path on server

&nbsp; original\_filename VARCHAR(255) NOT NULL

&nbsp; file\_size\_kb INT

&nbsp; uploaded\_by UUID FK → users.id NOT NULL

&nbsp; uploaded\_at TIMESTAMP DEFAULT now()

```


### Group 1b — Token Blacklist (Security)

```

token\_blacklist

&nbsp; jti UUID PK              -- JWT ID claim (jti from token payload)

&nbsp; user\_id UUID FK → users.id NOT NULL

&nbsp; expires\_at TIMESTAMP NOT NULL   -- cleanup job removes rows past this date nightly

&nbsp; created\_at TIMESTAMP DEFAULT now()

&nbsp; INDEX on expires\_at (for cleanup job performance)

```


### Group 5 — Workflow Engine

```

workflow\_configs

&nbsp; id UUID PK

&nbsp; config\_name VARCHAR(200) NOT NULL

&nbsp; category\_id UUID FK → employee\_categories.id (nullable — null = all categories)

&nbsp; leave\_type\_id UUID FK → leave\_types.id (nullable — null = all leave types)

&nbsp; min\_days INT DEFAULT 1

&nbsp; max\_days INT                           -- null = unlimited

&nbsp; is\_active BOOLEAN DEFAULT true

&nbsp; version INT DEFAULT 1

&nbsp; created\_by UUID FK → users.id NOT NULL

&nbsp; created\_at TIMESTAMP DEFAULT now()

&nbsp; updated\_at TIMESTAMP DEFAULT now()


&nbsp; -- Matching priority: most specific wins (category+leave+duration beats generic)

&nbsp; -- Admin UI shows priority order and allows reordering


workflow\_steps

&nbsp; id UUID PK

&nbsp; config\_id UUID FK → workflow\_configs.id NOT NULL

&nbsp; step\_order INT NOT NULL

&nbsp; approver\_role VARCHAR(50) NOT NULL

&nbsp;   -- HOD | DEAN\_ACADEMIC | ESTABLISHMENT\_OFFICER | REGISTRAR | DIRECTOR | SPECIFIC\_USER

&nbsp; approver\_office VARCHAR(50)            -- for display / notification routing

&nbsp; specific\_approver\_id UUID FK → users.id (nullable — used when role = SPECIFIC\_USER)

&nbsp; sla\_hours INT DEFAULT 48               -- escalation trigger

&nbsp; is\_final\_authority BOOLEAN DEFAULT false

&nbsp; skip\_if\_self\_applicant BOOLEAN DEFAULT true  -- HOD applying own leave: this step auto-skips

&nbsp; escalation\_rule JSONB                  -- {auto_forward: true, escalate_to_role: "DIRECTOR", ...}

&nbsp; UNIQUE(config\_id, step\_order)

&nbsp; created\_at TIMESTAMP DEFAULT now()


leave\_approvals

&nbsp; id UUID PK

&nbsp; application\_id UUID FK → leave\_applications.id NOT NULL

&nbsp; step\_id UUID FK → workflow\_steps.id NOT NULL

&nbsp; approver\_id UUID FK → users.id NOT NULL

&nbsp; step\_order INT NOT NULL

&nbsp; action VARCHAR(20) NOT NULL            -- APPROVED | REJECTED | RETURNED | FORWARDED | MODIFIED | RECALLED

&nbsp; remarks TEXT

&nbsp; modified\_from\_date DATE               -- if approver partially modifies dates

&nbsp; modified\_to\_date DATE

&nbsp; modified\_days NUMERIC(5,2)

&nbsp; acted\_at TIMESTAMP DEFAULT now()

```


### Group 6 — Notifications & Communication

```

notification\_queue

&nbsp; id UUID PK

&nbsp; application\_id UUID FK → leave\_applications.id NOT NULL

&nbsp; recipient\_id UUID FK → users.id NOT NULL

&nbsp; channel VARCHAR(10) NOT NULL           -- EMAIL | IN\_APP

&nbsp; subject TEXT

&nbsp; body TEXT NOT NULL

&nbsp; status VARCHAR(10) DEFAULT 'PENDING'   -- PENDING | SENT | FAILED | SKIPPED

&nbsp; retry\_count INT DEFAULT 0

&nbsp; scheduled\_at TIMESTAMP DEFAULT now()

&nbsp; sent\_at TIMESTAMP

&nbsp; error\_message TEXT

&nbsp; created\_at TIMESTAMP DEFAULT now()


email\_templates

&nbsp; id UUID PK

&nbsp; event\_code VARCHAR(50) UNIQUE NOT NULL

&nbsp;   -- APP\_SUBMITTED | APP\_APPROVED | APP\_REJECTED | APP\_MODIFIED

&nbsp;   -- APP\_WITHDRAWN | APPROVAL\_REQUEST | SLA\_BREACH | BALANCE\_LOW

&nbsp; subject\_template TEXT NOT NULL         -- Jinja2 templating

&nbsp; body\_template TEXT NOT NULL            -- Jinja2 templating

&nbsp; is\_active BOOLEAN DEFAULT true

&nbsp; updated\_at TIMESTAMP DEFAULT now()

```


### Group 7 — Audit & Export

```

audit\_log

&nbsp; id UUID PK

&nbsp; actor\_id UUID FK → users.id NOT NULL

&nbsp; entity\_type VARCHAR(50) NOT NULL       -- leave\_application | leave\_balance | workflow\_config | user | etc.

&nbsp; entity\_id UUID NOT NULL

&nbsp; action VARCHAR(50) NOT NULL            -- CREATE | UPDATE | DELETE | STATUS\_CHANGE | LOGIN | EXPORT

&nbsp; before\_state JSONB

&nbsp; after\_state JSONB

&nbsp; ip\_address INET

&nbsp; user\_agent TEXT

&nbsp; created\_at TIMESTAMP DEFAULT now()

&nbsp; -- NO updates or deletes on this table. Append-only enforced via trigger.

&nbsp; -- Partitions: by year (e.g., audit\_log\_2026) for performance.


payroll\_export\_log

&nbsp; id UUID PK

&nbsp; export\_from DATE NOT NULL

&nbsp; export\_to DATE NOT NULL

&nbsp; export\_type VARCHAR(20) NOT NULL       -- LOP | ENCASHMENT | FULL

&nbsp; exported\_by UUID FK → users.id NOT NULL

&nbsp; file\_path TEXT

&nbsp; record\_count INT

&nbsp; summary JSONB                          -- {total\_lop\_days, employees\_affected, ...}

&nbsp; exported\_at TIMESTAMP DEFAULT now()


-- Reserved for v2 biometric integration (schema ready, not populated in v1)

attendance\_raw

&nbsp; id UUID PK

&nbsp; employee\_id UUID FK → employees.id NOT NULL

&nbsp; punch\_in TIMESTAMP

&nbsp; punch\_out TIMESTAMP

&nbsp; source VARCHAR(20) DEFAULT 'BIOMETRIC'

&nbsp; device\_id VARCHAR(50)

&nbsp; imported\_at TIMESTAMP DEFAULT now()

```



### Group 8 — Payroll Foundation (Reserved Schema, v1.1/v2)

> No payroll logic in v1 — this is **reserved structure** so payroll can start immediately after LMS go-live without retrofitting migrations.

```
salary_structures

&nbsp; id UUID PK

&nbsp; code VARCHAR(30) UNIQUE NOT NULL      -- e.g., PAY_MATRIX_7, PAY_MATRIX_11

&nbsp; name VARCHAR(150) NOT NULL            -- e.g., Level 7 (PB-2)

&nbsp; description TEXT

&nbsp; is_active BOOLEAN DEFAULT true

&nbsp; created_at TIMESTAMP DEFAULT now()

&nbsp; updated_at TIMESTAMP DEFAULT now()


employee_salary_assignments

&nbsp; id UUID PK

&nbsp; employee_id UUID FK → employees.id NOT NULL

&nbsp; structure_id UUID FK → salary_structures.id NOT NULL

&nbsp; basic_pay NUMERIC(10,2) NOT NULL

&nbsp; pay_level VARCHAR(10) NOT NULL        -- e.g., Level-7, Level-11

&nbsp; grade_pay NUMERIC(8,2)                -- optional

&nbsp; effective_from DATE NOT NULL

&nbsp; increment_due_date DATE

&nbsp; is_active BOOLEAN DEFAULT true

&nbsp; created_at TIMESTAMP DEFAULT now()

&nbsp; updated_at TIMESTAMP DEFAULT now()

&nbsp; UNIQUE(employee_id, effective_from)
```

---


## RESIDENT LEAVE ENTITLEMENT SEED DATA


| Category | Leave type | Rule | Year ref | Yr1 days | Yr2+ days | Pro-rata/mo | Max tenure | Carry fwd | Special |

|---|---|---|---|---|---|---|---|---|---|

| JR_ACAD | ANNUAL_RES | Per year | JOINING_DATE | 30 | 36 | — | — | No | exam_extension_flag |

| SR_ACAD | ANNUAL_RES | Per year | JOINING_DATE | 24 | 30 | — | — | No | exam_extension_flag |

| JR_NA | ANNUAL_RES | Pro-rata | JOINING_DATE | — | — | 2.5 | 6mo | No | contract_term_bound |

| SR_NA | ANNUAL_RES | Pro-rata | JOINING_DATE | — | — | 2.5 | 6mo | No | **VERIFY locally** |

| JR_ACAD | EOL | Tenure cap | TENURE | — | — | — | 30 days | No | tenure_extension |

| SR_ACAD | EOL | Tenure cap | TENURE | — | — | — | 30 days | No | tenure_extension |

| ALL_RES | ML | GoI rules | — | 180 days | — | — | — | — | tenure_extension |

| ALL_RES | PL | GoI rules | — | 15 days | — | — | — | — | — |


⚠️ SR_NA leave entitlement marked **VERIFY** — pull AIIMS Bibinagar establishment circular for SR(NA) before seeding.


---


## PHASED DEVELOPMENT PLAN


### PHASE 0 — Project Scaffolding & Infrastructure

**Goal:** Empty project runs on Windows Server, DB connects, health check passes.

**Estimated effort:** 1 session


\- \[ ] 0.1 Initialise Git repo `aiims-lms/`

\- \[ ] 0.2 Backend scaffold: `FastAPI` project structure, `pyproject.toml`, virtual env

\- \[ ] 0.3 Frontend scaffold: `Vite + React 18 + Tailwind` inside `aiims-lms/frontend/`

\- \[ ] 0.4 `.env.example` file with all required keys documented

\- \[ ] 0.5 `docker-compose.yml` for local dev PostgreSQL (dev only — production uses native PG on Windows)

\- \[ ] 0.6 Alembic initialised, `env.py` configured

\- \[ ] 0.7 `GET /health` endpoint returning DB ping status

\- \[ ] 0.8 CORS configured for LAN (allow all origins in dev, restrict to server IP in prod)

\- \[ ] 0.9 Nginx config file for Windows + NSSM service config documented

\- \[ ] 0.10 README with Windows Server deployment steps

\- \[ ] 0.11 `pytest` configured with `pytest-asyncio`, `httpx`, test DB connection in `pytest.ini`

\- \[ ] 0.12 `tests/` folder structure: `unit/`, `integration/`, `load/`

\- \[ ] 0.13 Vitest + React Testing Library + MSW configured in frontend

\- \[ ] 0.14 `.pre-commit-config.yaml`: ruff, mypy, eslint, prettier, pytest (unit only)

\- \[ ] 0.15 `token_blacklist` table added to schema plan (JWT logout invalidation)

\- \[ ] 0.16 `btree_gist` PostgreSQL extension documented for concurrent leave constraint

\- \[ ] 0.17 Create `ONBOARDING.md` (developer setup guide) and `TROUBLESHOOTING.md`

\- \[ ] 0.18 Create `deployment/ROLLBACK.md` with rollback procedure

\- \[ ] 0.19 Create `python init_admin.py` script to bootstrap first admin user

\- \[ ] 0.20 Add DB connection pool configuration: `pool_size=20`, `max_overflow=10`, `pool_timeout=30`, `pool_pre_ping=True`

\- \[ ] 0.21 Create `deployment/OPS_RUNBOOK.md` skeleton (log rotation, crash recovery, SSL renewal)


**Exit criteria:** `uvicorn main:app` runs, `/health` returns 200, Alembic can generate migrations, `pytest tests/unit` runs with 0 tests but 0 errors.


---


### PHASE 1 — Database: Full Schema + Seed Data

- [ ] 1.X Payroll Foundation (reserved): create `salary_structures` and `employee_salary_assignments` tables (schema only; no v1 logic).

**Goal:** All 19 tables created via Alembic migrations. Core seed data loaded.

**Estimated effort:** 1–2 sessions


\- \[ ] 1.1 SQLAlchemy models for all 19 tables (Groups 1–7)

\- \[ ] 1.2 Alembic migration: `001_initial_schema.py`

\- \[ ] 1.3 Seed script: `seeds/versions/001_leave_types.py` — all CCS leave types with validation_rules JSON

\- \[ ] 1.4 Seed script: `seeds/versions/002_employee_categories.py` — 7 categories

\- \[ ] 1.5 Seed script: `seeds/versions/003_leave_entitlement_rules.py` — CCS rules for regular staff

\- \[ ] 1.6 Seed script: `seeds/versions/004_resident_entitlement_rules.py` — residency scheme (with VERIFY flag for SR_NA)

\- \[ ] 1.7 Seed script: `seeds/versions/005_email_templates.py` — all 8 event_codes

\- \[ ] 1.8 Seed script: `seeds/versions/006_default_workflow_configs.py` — baseline chains for each category

\- \[ ] 1.9 Audit log append-only trigger: `BEFORE UPDATE OR DELETE → RAISE EXCEPTION`

\- \[ ] 1.10 `closing_balance` generated column verified

\- \[ ] 1.11 All FK constraints, CHECK constraints, UNIQUE constraints verified

\- \[ ] 1.12 `token_blacklist` table created with index on `expires_at`

\- \[ ] 1.13 `btree_gist` extension enabled; overlapping leave exclusion constraint applied to `leave_applications`

\- \[ ] 1.14 Nightly token_blacklist cleanup registered in APScheduler

\- \[ ] 1.15 Yearly partitioning for `audit_log` (create partition tables for 2026, 2027, etc.)

\- \[ ] 1.16 Indexes added on `audit_log(created_at DESC)`, `(entity_type, entity_id)`, `(actor_id)`


**Exit criteria:** `alembic upgrade head` + seed scripts produce clean DB. `psql \\dt` shows all 19 tables plus partitions. Manual overlap insert attempt raises constraint violation. Audit log delete attempt raises exception.


---


### PHASE 2 — Auth & Employee Master

**Goal:** Login works. Admin can manage employees. CSV import from payroll dump works.

**Estimated effort:** 2 sessions


\- \[ ] 2.1 `POST /api/v1/auth/login` — JWT issue; access token 8h HS256; refresh token 7d in HttpOnly cookie

\- \[ ] 2.2 `POST /api/v1/auth/refresh` — rotate refresh token (old invalidated, new issued); access token renewed

\- \[ ] 2.3 `POST /api/v1/auth/logout` — add access token JTI to `token_blacklist`; clear refresh cookie

\- \[ ] 2.4 Role middleware: `STAFF | HOD | DEAN_ACADEMIC | REGISTRAR | ESTABLISHMENT | DIRECTOR | ADMIN`; every protected route checks token against blacklist

\- \[ ] 2.4a `employee_scope(current_user)` FastAPI dependency — returns employee ID filter based on role; applied to ALL list endpoints returning leave data

\- \[ ] 2.4b `bcrypt` cost factor 12 for password hashing; `must_change_password` flag enforced at middleware level

\- \[ ] 2.4c `slowapi` rate limiting: `/api/v1/auth/login` 5/min per IP; general endpoints 100/min; export endpoints 10/min

\- \[ ] 2.5 `GET/POST/PUT /api/v1/employees` — CRUD with audit logging

\- \[ ] 2.6 `POST /api/v1/employees/import` — CSV import from payroll dump

&nbsp; - Mapping: emp_code, name, gender, dob, doj, category, department, designation, email, (optional) basic_pay, pay_level

&nbsp; - Duplicate detection by emp_code

&nbsp; - Error rows returned in response, not silently dropped

&nbsp; - Auto-creates `users` record with temp password = emp_code (force reset on first login)

&nbsp; - **Validation:** pre-import check that all department/designation codes exist

\- \[ ] 2.7 `GET/POST/PUT /api/v1/departments` CRUD

\- \[ ] 2.8 `GET/POST/PUT /api/v1/designations` CRUD

\- \[ ] 2.9 `GET/POST/PUT /api/v1/users` — admin user management

\- \[ ] 2.10 Password reset flow (admin-triggered, no email reset in v1)


**Frontend:**

\- \[ ] 2.11 Login page (no white background — use `#F0F4F8` or dark slate per UI rules)

\- \[ ] 2.12 Employee master list with search/filter

\- \[ ] 2.13 Employee add/edit form

\- \[ ] 2.14 CSV import wizard (upload → preview → confirm → result summary)

\- \[ ] 2.15 Department & designation management screens

\- \[ ] 2.16 Use TanStack Query for data fetching, Zustand for auth/UI state


**Exit criteria:** Admin can log in, import a 50-row CSV, and manage employee records.


---


### PHASE 3 — Leave Configuration & Opening Balances

**Goal:** Admin configures leave rules, workflow chains, and enters opening balances for Day Zero (01-Jan-2026).

**Estimated effort:** 2 sessions


\- \[ ] 3.1 `GET/POST/PUT /api/v1/leave-types` — read‑mostly, admin-editable

\- \[ ] 3.2 `GET/POST/PUT /api/v1/leave-entitlement-rules` — per category per leave type

\- \[ ] 3.3 `GET/POST/PUT /api/v1/holiday-master` — annual holiday list management

\- \[ ] 3.4 Workflow config API:

&nbsp; - `GET/POST /api/v1/workflow-configs`

&nbsp; - `PUT /api/v1/workflow-configs/:id`

&nbsp; - `GET/POST/PUT/DELETE /api/v1/workflow-configs/:id/steps`

&nbsp; - Priority resolution logic: most specific match (category + leave_type + duration) wins

&nbsp; - **Audit trail for workflow changes**: every change to `workflow_configs` or `workflow_steps` is logged to a separate `workflow_config_audit` table (or the main audit_log)

\- \[ ] 3.5 `POST /api/v1/leave-balances/opening` — bulk entry endpoint

&nbsp; - Accepts array of {emp_code, leave_type_code, opening_balance}

&nbsp; - Maps to `leave_balances` with `year_start_date` computed from employee category

&nbsp; - Idempotent — re‑run safe, duplicate = update not insert

\- \[ ] 3.6 `POST /api/v1/leave-balances/opening/import` — Excel import for establishment's existing file

&nbsp; - Column mapping configurable (column names in establishment Excel are not structured)

&nbsp; - Preview before commit


**Frontend:**

\- \[ ] 3.7 Leave types configuration screen

\- \[ ] 3.8 Entitlement rules matrix view (category × leave type grid)

\- \[ ] 3.9 Holiday master — year-wise list, add/edit/delete

\- \[ ] 3.10 Workflow configurator UI:

&nbsp; - List of configs with priority order

&nbsp; - Step builder: role selector, SLA hours, final authority flag

&nbsp; - "Simulate" button: enter category + leave type + days → shows which chain will fire

&nbsp; - Workflow config version history viewer (read‑only)

\- \[ ] 3.11 Opening balance entry screen:

&nbsp; - Employee lookup

&nbsp; - Leave type multi-row entry

&nbsp; - Bulk Excel import with column mapper


**Exit criteria:** Admin configures 3 workflow chains. Opening balances loaded for 5 test employees. Simulate shows correct routing.


---


### PHASE 4 — Leave Application & Approval Workflow

- [ ] 4.X `POST /api/v1/leave-approvals/bulk-action` — bulk approve (max 50)
	- Input: [{application_id, action, remarks}]
	- All-or-nothing transaction; rollback on any failure


**Goal:** Staff can apply for leave. Approvers can act. Status flows correctly end-to-end.

**Estimated effort:** 3 sessions


\- \[ ] 4.1 `POST /api/v1/leave-applications` — submit application

&nbsp; - Balance check before submission

&nbsp; - **Holiday‑ & weekend‑aware day count per policy matrix** (skip enclosed holidays/weekends)

&nbsp; - CL validation: no prefix/suffix with holidays, no combination with other leave types

&nbsp; - Half‑day support: FN/AN

&nbsp; - Auto‑assign `app_number` (LMS/YYYY/NNNNN)

&nbsp; - Workflow chain resolved at submission time (snapshot stored, not re‑resolved on each action)

\- \[ ] 4.2 `GET /api/v1/leave-applications` — list with filters (status, date range, leave type, employee)

\- \[ ] 4.3 `GET /api/v1/leave-applications/:id` — full detail with approval trail

\- \[ ] 4.4 `PUT /api/v1/leave-applications/:id/withdraw` — only in SUBMITTED or UNDER_REVIEW status

\- \[ ] 4.5 `POST /api/v1/leave-approvals/:application_id/action` — approver acts

&nbsp; - Actions: APPROVED | REJECTED | FORWARDED | MODIFIED

&nbsp; - MODIFIED: approver changes dates/days, applicant notified

&nbsp; - APPROVED at final step: balance deducted, notification fired

&nbsp; - Rejected: reason mandatory, balance unchanged, notification fired

\- \[ ] 4.6 `GET /api/v1/leave-approvals/inbox` — approver's pending queue (role‑filtered)

\- \[ ] 4.7 `GET /api/v1/leave-applications/:id/approval-trail` — full step-by-step history

\- \[ ] 4.8 SLA breach detection: APScheduler job checks for steps overdue beyond `sla_hours`, fires escalation notification

\- \[ ] 4.9-ext Self‑applicant skip: if applicant = step approver, step auto‑skips to next level (uses `skip_if_self_applicant` flag on `workflow_steps`)

\- \[ ] 4.10-ext Acting arrangement routing: if assigned approver has APPROVED leave overlapping today → route to their `acting_arrangement_emp_id`

\- \[ ] 4.11-ext Recall flow: APPROVED → employee requests recall → Establishment confirms → status = RECALLED, balance restored (per policy matrix)

\- \[ ] 4.12-ext Concurrent overlap constraint: `btree_gist` exclusion constraint blocks overlapping applications at DB level

\- \[ ] 4.13-ext Balance deduction: `SELECT FOR UPDATE` on `leave_balances` row at final approval step


**Frontend:**

\- \[ ] 4.9 Leave application form:

&nbsp; - Employee sees own leave type options based on category

&nbsp; - Date range picker with real‑time day count (holiday‑ & weekend‑aware)

&nbsp; - Balance indicator while selecting dates

&nbsp; - Half‑day toggle

&nbsp; - Acting arrangement field

&nbsp; - Document upload (MC for HPL/Commuted)

&nbsp; - Address during leave

&nbsp; - Error boundaries for each major component

&nbsp; - Retry logic on API failures (TanStack Query built‑in)

\- \[ ] 4.10 My applications list with status badges and timeline

\- \[ ] 4.11 Approval inbox (HOD / Dean / Registrar / Director view):

&nbsp; - Sortable by SLA urgency

&nbsp; - One‑click approve/reject/forward with remarks

&nbsp; - Modification mode: change dates inline before approving

&nbsp; - Full application detail panel

\- \[ ] 4.12 Approval trail view (step‑by‑step visual timeline)

\- \[ ] 4.13 Department leave calendar (clash visibility for HOD)

\- \[ ] 4.14 Mobile‑friendly adapters for approval actions (touch targets ≥44px)


**Exit criteria:** Full end‑to‑end: Staff applies → HOD approves → Director approves → balance deducted → notification sent. Rejection flow tested. Withdrawal tested.


---


### PHASE 5 — Leave Accounts & Balance Management

- [ ] 5.X `GET /api/v1/leave-balances/:employee_id/project?from_date=...&to_date=...` — balance projection (hypothetical leave)
	- Returns: current balance → projected balance after hypothetical leave
	- Used in leave application form to show "Projected Balance After Leave"
	- Cache TTL: 5 minutes


**Goal:** Complete leave account visibility for staff and establishment. Year‑end carry‑forward processing.

**Estimated effort:** 2 sessions


\- \[ ] 5.1 `GET /api/v1/leave-balances/:employee_id` — all leave type balances for employee

\- \[ ] 5.2 `GET /api/v1/leave-balances/:employee_id/ledger/:leave_type_id` — full transaction ledger

\- \[ ] 5.3 `POST /api/v1/leave-balances/credit/annual` — annual EL/HPL credit run (admin trigger, financial year)

\- \[ ] 5.4 `POST /api/v1/leave-balances/carryforward` — year‑end carry‑forward run with accumulation cap enforcement (EL max 300 days, per policy matrix)

\- \[ ] 5.5 `PUT /api/v1/leave-balances/:id/manual-adjust` — admin/establishment can adjust with mandatory reason (audit logged)

\- \[ ] 5.6 Resident balance recalculation: pro‑rata recompute on contract term completion or extension


**Frontend:**

\- \[ ] 5.7 My Leave Account page (staff view):

&nbsp; - Balance card per leave type

&nbsp; - Visual bar: used / available / max

&nbsp; - Full ledger on expand

\- \[ ] 5.8 Employee leave account (admin/establishment view):

&nbsp; - Same as staff view but for any employee

&nbsp; - Manual adjust button with reason modal

\- \[ ] 5.9 Year‑end processing screen (admin):

&nbsp; - Preview carry‑forward computation before commit

&nbsp; - Annual credit preview

&nbsp; - One‑click execute with confirmation


**Exit criteria:** Leave account page accurate after multiple applications. Carry‑forward run tested with 10 employees.


---


### PHASE 6 — Notifications System

**Goal:** Email + in‑app notifications fire correctly for all workflow events.

**Estimated effort:** 1 session


\- \[ ] 6.1 Notification service: `services/notifications.py`

&nbsp; - Queue writer: writes to `notification_queue` with channel routing logic

&nbsp; - `has_institutional_email` check — skips EMAIL channel silently if false

\- \[ ] 6.2 APScheduler job: `jobs/email_sender.py`

&nbsp; - Polls `notification_queue` every 2 min for PENDING EMAIL items

&nbsp; - **Batch processing:** process max 5 emails per poll; enforce rate limit of 10 emails/minute (Zoho free tier)

&nbsp; - On failure: retry with exponential backoff (max 3 retries)

&nbsp; - Fallback: if Zoho SMTP unavailable, log error and queue remains PENDING; admin can retry later

\- \[ ] 6.3 In‑app notification endpoint: `GET /api/v1/notifications` — unread count + list

\- \[ ] 6.4 `PUT /api/v1/notifications/:id/read` — mark read

\- \[ ] 6.5 `PUT /api/v1/notifications/read-all`

\- \[ ] 6.6 Jinja2 template rendering for email body (HTML emails)

\- \[ ] 6.7 `.env` keys: `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`, `ZOHO_EMAIL`, `ZOHO_APP_PASSWORD`

\- \[ ] 6.8 Windows local SMTP relay as fallback (configured in Phase 9) – not required for go‑live, but documented.


**Events that trigger notifications:**

| Event | Recipients |

|---|---|

| APP_SUBMITTED | Applicant (confirmation) + Next approver |

| APPROVAL_REQUEST | Current step approver |

| APP_APPROVED (intermediate) | Applicant + Next approver |

| APP_APPROVED (final) | Applicant + Applicant's HOD (if HOD wasn't final approver) |

| APP_REJECTED | Applicant |

| APP_MODIFIED | Applicant |

| APP_WITHDRAWN | All previous approvers who had acted |

| SLA_BREACH | Approver (reminder) + their superior |


**Frontend:**

\- \[ ] 6.8 Notification bell in navbar: unread badge count

\- \[ ] 6.9 Notification drawer: list, mark read, click → goes to application

\- \[ ] 6.10 Email log viewer (admin): full queue visibility, failed items, manual retry trigger


**Exit criteria:** Submit leave → email arrives in institutional inbox within 2 minutes.


---


### PHASE 7 — Reports & Payroll Export

- [ ] 7.X `GET /api/v1/reports/leave-calendar` — department-wise leave calendar (approved only)
	- Access: Establishment, Registrar, Director


**Goal:** All MIS reports operational. LOP/encashment data exportable for payroll.

**Estimated effort:** 2 sessions


\- \[ ] 7.1 Leave Register — employee‑wise, date range, all leave types

\- \[ ] 7.2 Leave Abstract — department‑wise summary, monthly/quarterly/annual

\- \[ ] 7.3 Category‑wise report — regular vs resident breakdown

\- \[ ] 7.4 LOP Report — employees with leave without pay in a period

\- \[ ] 7.5 Pending applications report — aged analysis (pending > N days)

\- \[ ] 7.6 Balance summary — all employees, all leave types, as of date

\- \[ ] 7.7 **Reporting Column Definitions (Locked):**

&nbsp; - **Leave Register:** Emp Code, Name, Dept, Leave Type, From, To, Days, Status, Approval Date → Excel (xlsx) + PDF

&nbsp; - **Payroll Export (LOP):** Emp Code, Name, Dept, Month, LOP Days, Reason → CSV (format per AIIMS Finance NIC spec; placeholder mapping configurable)

&nbsp; - **Category-wise Summary:** Category, Total Staff, Total Leave Days (by type), Avg per staff → Excel

&nbsp; - **Pending Applications (aged):** App #, Employee, Leave Type, Submitted Date, Days Pending, Current Approver → PDF

\- \[ ] 7.8 Payroll export:

&nbsp; - `POST /api/v1/exports/payroll` — generates LOP + encashment CSV for a date range

&nbsp; - Logs to `payroll_export_log`

&nbsp; - Returns file download

\- \[ ] 7.9 All reports: Excel export (openpyxl) + PDF export (WeasyPrint)

\- \[ ] 7.10 Leave sanction copy PDF: `GET /api/v1/leave-applications/:id/sanction-pdf`

&nbsp; - Only available when status = APPROVED

&nbsp; - WeasyPrint HTML template with AIIMS Bibinagar header


**Frontend:**

\- \[ ] 7.11 Reports hub page with report type selector

\- \[ ] 7.12 Filter panels per report (date range, department, category, employee)

\- \[ ] 7.13 Inline preview table + Export buttons (Excel / PDF)

\- \[ ] 7.14 Payroll export screen: date range → preview summary → download CSV

\- \[ ] 7.15 Export history: list of past payroll exports with download links


**Exit criteria:** Leave register downloadable as Excel. Payroll export CSV generated and logged.


---


### PHASE 8 — Admin Panel, Audit & Hardening

**Goal:** Full admin control. Audit trail accessible. Security hardened for production.

**Estimated effort:** 1–2 sessions


\- \[ ] 8.1 Audit log viewer: filter by entity, actor, date, action type

\- \[ ] 8.2 Failed login attempt tracking (5 attempts → 15‑min lockout)

\- \[ ] 8.3 Session management: force logout any user (admin)

\- \[ ] 8.4 Password policy enforcement: min 8 chars, 1 upper, 1 number, 1 special

\- \[ ] 8.5 First‑login forced password change

\- \[ ] 8.6 HTTPS config guide (self‑signed cert for LAN — Nginx)

\- \[ ] 8.7 Database backup script (`pg_dump` → scheduled Windows Task)

\- \[ ] 8.8 Rate limiting on auth endpoints (`slowapi`)

\- \[ ] 8.9 File upload security: type whitelist (PDF, JPG, PNG only), size limit 5MB, scan filename

\- \[ ] 8.10 `.env` validation on startup: missing keys → app refuses to start with clear error

\- \[ ] 8.11 **In‑app health dashboard** (admin only): shows queue depth, DB pool usage, recent error rate, last backup time


**Windows Server Operational Runbook (OPS_RUNBOOK.md):**

\- \[ ] 8.12 **Log rotation:** Use `rotatelogs` or scheduled PowerShell to archive logs > 100MB daily; retain 90 days.

\- \[ ] 8.13 **Crash recovery:** NSSM configured with `AppRestartDelay = 5000` (5 seconds); on 3 consecutive crashes within 60 seconds, service stops and alerts IT support via email.

\- \[ ] 8.14 **SSL renewal:** Self‑signed cert valid 365 days; `renew_cert.bat` script with OpenSSL documented and scheduled annually.

\- \[ ] 8.15 **Backup verification:** Weekly automated restore test to secondary DB instance; row count verified against production; then dropped.


**Frontend:**

\- \[ ] 8.16 Audit log viewer with filters and pagination

\- \[ ] 8.17 System settings page: email config test, notification template editor

\- \[ ] 8.18 User management: activate/deactivate, role change, force password reset

\- \[ ] 8.19 Health dashboard page


**Exit criteria:** Audit log shows full trail of a leave application lifecycle. Failed login lockout works. OPS_RUNBOOK.md documented.


---


### PHASE 8.5 — Testing Suite & Security Hardening

**Goal:** Full test coverage in place. Security controls verified. System ready for UAT with confidence.

**Estimated effort:** 2–3 sessions


**Backend unit tests (`tests/unit/`):**

\- \[ ] 8.5.1 `test_leave_arithmetic.py` — balance deduction, pro‑rata, carry‑forward cap, EL accumulation cap

\- \[ ] 8.5.2 `test_workflow_resolver.py` — all (category × leave_type × duration) combinations resolve to correct chain

\- \[ ] 8.5.3 `test_resident_leave_year.py` — joining‑date anniversary boundary, mid‑month join pro‑rata

\- \[ ] 8.5.4 `test_cl_validation.py` — CL prefix/suffix with holidays rejected; CL+EL combination rejected

\- \[ ] 8.5.5 `test_eol_tenure_cap.py` — JR_ACAD blocked after 30 days EOL in tenure

\- \[ ] 8.5.6 `test_carry_forward.py` — EL capped at 300, HPL no carry‑forward

\- \[ ] 8.5.7 `test_pdf_generation.py` — various leave types, special characters, memory usage

\- \[ ] 8.5.8 `test_policy_matrix.py` — half‑day rounding, sandwich rule (holidays/weekends), mid‑year pro‑rata, approver modification, recall restoration


**Backend integration tests (`tests/integration/`):**

\- \[ ] 8.5.9 `test_auth_flow.py` — login, refresh, logout (token blacklisted), lockout after 5 failures

\- \[ ] 8.5.10 `test_leave_application_flow.py` — full lifecycle: submit → approve chain → balance deducted → notification queued

\- \[ ] 8.5.11 `test_rbac_scoping.py` — STAFF cannot view other employee's applications; HOD sees only own dept

\- \[ ] 8.5.12 `test_concurrent_applications.py` — overlapping dates rejected by DB constraint

\- \[ ] 8.5.13 `test_concurrent_balance.py` — simultaneous final approvals for same employee: only one succeeds

\- \[ ] 8.5.14 `test_self_applicant_skip.py` — HOD applying own leave: HOD step skipped

\- \[ ] 8.5.15 `test_file_upload_security.py` — wrong MIME type rejected, >5MB rejected, path traversal filename rejected

\- \[ ] 8.5.16 `test_payroll_export.py` — LOP days correct in CSV output

\- \[ ] 8.5.17 `test_nplus1.py` — assert query count doesn't exceed threshold for common list endpoints


**Frontend tests (`src/__tests__/`):**

\- \[ ] 8.5.18 `LeaveApplicationForm.test.jsx` — to_date < from_date error; balance red when over‑applied

\- \[ ] 8.5.19 `ApprovalInbox.test.jsx` — only role‑appropriate items rendered

\- \[ ] 8.5.20 `LeaveAccountCard.test.jsx` — balance numbers match API mock

\- \[ ] 8.5.21 `SanctionPDF.test.jsx` — download button hidden when status ≠ APPROVED

\- \[ ] 8.5.22 `ErrorBoundary.test.jsx` — falls back to error UI on unhandled exceptions


**Security verification:**

\- \[ ] 8.5.23 Verify `HttpOnly` cookie on refresh token (browser devtools test)

\- \[ ] 8.5.24 Verify token blacklist: logout → use old access token → 401

\- \[ ] 8.5.25 Verify RBAC: STAFF role JWT → attempt `/api/v1/leave-applications?employee_id=OTHER` → 403

\- \[ ] 8.5.26 Verify audit log immutability: attempt `DELETE FROM audit_log` → exception raised

\- \[ ] 8.5.27 Verify Nginx security headers present on all responses

\- \[ ] 8.5.28 Verify HTTPS redirect: HTTP request → 301 to HTTPS

\- \[ ] 8.5.29 Verify rate limit: 6th login attempt within 1 min → 429

\- \[ ] 8.5.30 Verify PDF XSS: `<script>` in leave reason → rendered as escaped text in PDF, not executed

\- \[ ] 8.5.31 Verify file upload: `.php` file with PDF MIME → rejected

\- \[ ] 8.5.32 Manual RBAC review: walk every API endpoint, confirm no endpoint lacks `employee_scope` dependency


**Load test (`tests/load/locustfile.py`):**

\- \[ ] 8.5.33 Simulate 50 concurrent users: browse inbox, submit application, view balance

\- \[ ] 8.5.34 Verify: response times meet per‑endpoint baselines; leave register report < 5s for 1000 employees

\- \[ ] 8.5.35 Document baseline results in `tests/load/BASELINE_RESULTS.md`


**Data hygiene:**

\- \[ ] 8.5.36 Data retention cleanup job: notification_queue > 90 days → delete; export files > 1 year → delete; schedule as Windows Task

\- \[ ] 8.5.37 Backup verification: run `pg_dump`, verify restore on a separate DB instance


**Exit criteria:** `pytest` passes with ≥80% backend coverage. All security verification items manually confirmed and ticked. Load test baseline documented.


---


### PHASE 8.6 — Test Data Generation

**Goal:** Generate synthetic test data for UAT and performance testing.

**Estimated effort:** 0.5 session


\- \[ ] 8.6.1 Create Faker‑based script `scripts/generate_test_data.py`

\- \[ ] 8.6.2 Generate 1000 employees with realistic departments, designations, and categories

\- \[ ] 8.6.3 Generate 3 years of historical leave applications (50k+ records) with realistic patterns

\- \[ ] 8.6.4 Generate opening balances for all employees

\- \[ ] 8.6.5 Anonymization script for production data (for UAT environment)

\- \[ ] 8.6.6 Document data generation process in `README.md`


---


### PHASE 9 — UAT, Data Migration & Go‑Live

> **Payroll module:** Build payroll logic **after** LMS go-live (v1.1). Payroll tables are reserved in schema (Group 8) and can start immediately after LMS stabilizes.


**Goal:** Real data loaded. Establishment team validates. System goes live.

**Estimated effort:** 1–2 sessions + user time


**Data Migration & Reconciliation Protocol:**

\- \[ ] 9.1 **Pre‑import validation script (`scripts/validate_master_data.py`)**:

&nbsp; - Verifies every `emp_code` maps to an existing `department_code` and `designation_code`.

&nbsp; - Validates `DOJ` format and ensures it is not in the future.

&nbsp; - Checks for duplicate emails / employee codes.

&nbsp; - Generates a **validation report** (`validation_errors.csv`) with row‑by‑row issues — import **blocks** on critical errors (e.g., missing category).

\- \[ ] 9.2 **Opening balance reconciliation**:

&nbsp; - After import, system generates a **reconciliation summary**:

&nbsp;   - Total EL opening balance (sum across employees)

&nbsp;   - Total CL opening balance

&nbsp;   - … per leave type

&nbsp; - This summary is compared against the **source Excel total** (provided by Establishment) — if mismatch > 0.1%, import is flagged for manual review.

\- \[ ] 9.3 Load real employee data from payroll dump (Phase 2 CSV import with validation)

\- \[ ] 9.4 Load opening leave balances from establishment Excel (Phase 3 import with reconciliation)

\- \[ ] 9.5 Configure real workflow chains per AIIMS Bibinagar sanctioning authority structure

\- \[ ] 9.6 Load holiday master for current year

\- \[ ] 9.7 Create real user accounts for HODs, Dean Academic, Registrar, Director, Establishment

\- \[ ] 9.8 UAT session 1: Establishment team — employee master, balance entry, workflow config

\- \[ ] 9.9 UAT session 2: Staff — apply for leave end‑to‑end

\- \[ ] 9.10 UAT session 3: Approvers — inbox, approve, reject, modify

\- \[ ] 9.11 UAT session 4: Reports — verify leave register against manual records

\- \[ ] 9.12 Fix list from UAT → prioritise → patch

\- \[ ] 9.13 Windows Service configured, Nginx live, LAN accessible

\- \[ ] 9.14 Backup schedule configured

\- \[ ] 9.15 **Go/No‑Go decision** – complete the **GO-LIVE / CUTOVER CHECKLIST (Production Readiness)** section below and attach the signed checklist to the go-live record (Establishment + Dean Academic + Registrar/Director as applicable).

\- \[ ] 9.16 Go‑live

\- \[ ] 9.17 Post‑go‑live monitoring (first 48 hours): watch error logs, queue depth, DB pool usage


---




## GO-LIVE / CUTOVER CHECKLIST (Production Readiness)
**Objective:** a single gate before enabling production use on the AIIMS LAN.

### A) Data readiness
- [ ] Employee master data validated (department/designation/category mappings complete)
- [ ] Opening balances imported and reconciled (spot-check ≥ 5% employees per category)
- [ ] Holiday calendar loaded for current + next year
- [ ] Test accounts disabled; default passwords rotated

### B) Functional acceptance
- [ ] UAT sign-off recorded (Establishment + Dean Academic + Registrar as applicable)
- [ ] All critical leave policy matrix cases executed and signed off (including Comp-Off with remarks + attachment)
- [ ] Reports: leave register + sanction PDFs + export outputs verified against expected formats

### C) Security & access governance
- [ ] ADMIN assignment restricted (Director/authority-approved)
- [ ] Role-change audit entries verified
- [ ] Password policy + lockout verified in staging
- [ ] Quarterly access review schedule and owner assigned

### D) Operational readiness
- [ ] Backup job configured and *restore test completed* on a separate machine
- [ ] Windows services (NSSM) configured for auto-restart; logs rotating
- [ ] Monitoring/alerts configured (health endpoint + error log review cadence)
- [ ] SMTP configured and test email delivery verified

### E) Performance & stability
- [ ] Smoke test under expected load (basic locust run or scripted concurrency)
- [ ] Key endpoints meet p95 targets or documented exceptions approved

### F) Cutover plan
- [ ] Cutover date/time approved (IST)
- [ ] Freeze window for master data changes communicated
- [ ] Rollback plan documented (restore DB backup + revert service config)
- [ ] Post go-live hypercare window defined (first 2 weeks)

## AGENT WORK LOG


> **Instructions for agents:** Add a new entry to this log every time you complete a session. Be specific — say what was built, what files were created/modified, and exactly what the next agent must do first.


---


### Entry 000 — Design & Planning

\- **Agent:** Claude (Planning session)

\- **Date:** 2026-06-16

\- **Status:** COMPLETED

\- **Work done:**

&nbsp; - Requirements elicited across 6 dialogue rounds (grill sessions)

&nbsp; - Tech stack decided: FastAPI + SQLAlchemy 2.0 + PostgreSQL + React 18 + Vite + Tailwind

&nbsp; - 18-table schema designed and documented

&nbsp; - Resident leave rules researched and encoded (SR_NA flagged for local verification)

&nbsp; - 9-phase development plan written

&nbsp; - This document created

\- **Files created:** `LEAVE_MGMT_IMPLEMENTATION_PLAN.md` (this file)

\- **Decisions deferred:**

&nbsp; - SR_NA leave entitlement → verify from AIIMS Bibinagar local circular before Phase 1 seed

&nbsp; - CL combining with restricted holidays → defaulted to strict CCS, configurable

&nbsp; - Contract/Outsourced staff → Phase v2

&nbsp; - MBBS students, Interns → Phase v2

&nbsp; - Biometric integration → v2 (schema slot reserved in `attendance_raw`)

&nbsp; - Payroll integration → v2 (export CSV ready in Phase 7, full integration later)


---


### Entry 001 — Testing & Security Audit

\- **Agent:** Claude (Security & Testing review session)

\- **Date:** 2026-06-16

\- **Status:** COMPLETED

\- **Work done:**

&nbsp; - Full gap analysis: testing and security were absent/superficial in v1 plan

&nbsp; - Added comprehensive TESTING STRATEGY section (pytest, Vitest, MSW, locust, pre-commit)

&nbsp; - Added comprehensive SECURITY PROTOCOLS section (JWT blacklist, RBAC row-level scoping, input validation, rate limiting, file upload security, audit log immutability, data retention)

&nbsp; - Added MISSING WORKFLOW SCENARIOS section (self-applicant skip, acting arrangement, recall flow, concurrent overlap constraint, balance SELECT FOR UPDATE, browser support)

&nbsp; - Schema additions: `token_blacklist` table (19th table), `skip_if_self_applicant` on `workflow_steps`, `RECALLED` status on `leave_applications`

&nbsp; - Phase 0 patched: test scaffolding, pre-commit, btree_gist documentation

&nbsp; - Phase 1 patched: token_blacklist table, btree_gist constraint, audit log trigger verification

&nbsp; - Phase 2 patched: HttpOnly cookie for refresh token, token rotation, blacklist check, employee_scope dependency, bcrypt, slowapi

&nbsp; - Phase 4 patched: self-applicant skip, acting arrangement routing, recall flow, overlap constraint, SELECT FOR UPDATE

&nbsp; - Phase 8.5 inserted: 33-item testing + security verification checklist before UAT

\- **Files modified:** `LEAVE_MGMT_IMPLEMENTATION_PLAN.md`

\- **Nothing deferred this session**


---


### Entry 002 — DeepSeek & Notion Critical Gap Triage & Final Integration

\- **Agent:** Claude (Gap triage & finalisation session)

\- **Date:** 2026-06-16

\- **Status:** COMPLETED

\- **Work done:**

&nbsp; - Reviewed DeepSeek's critical analysis and Notion's policy/operational feedback.

&nbsp; - Integrated **Leave Policy Rule Matrix** (half-day, sandwich rules, CL prefix, mid-year pro-rata, modification, recall).

&nbsp; - Added **Data Migration & Reconciliation Protocol** (validation script, reconciliation summary) to Phase 9.

&nbsp; - Added **Reporting Column Definitions & Format Specifications** to Phase 7.

&nbsp; - Added **Windows Server Operational Runbook** (OPS_RUNBOOK.md) with log rotation, crash recovery, SSL renewal, and backup verification to Phase 8.

&nbsp; - Updated Tech Stack and Testing sections to reflect new policy test cases.

\- **Files modified:** `LEAVE_MGMT_IMPLEMENTATION_PLAN.md` – Final comprehensive version.

\- **Next agent must:** Begin Phase 0 with the final requirements, ensuring all new items (init_admin.py, OPS_RUNBOOK.md, validation scripts) are included.


---


## ⚡ IMMEDIATE NEXT ACTION


**Starting phase:** Phase 0 — Project Scaffolding


**First task for incoming agent:**


1\. Create the repository structure as defined in Phase 0.

2\. Scaffold FastAPI `main.py` with lifespan, CORS, router registration placeholder (`/api/v1` prefix), `/health` endpoint.

3\. Configure SQLAlchemy async engine in `core/database.py` with connection pool settings.

4\. Implement in‑memory cache wrapper in `core/cache.py` using `cachetools.TTLCache`.

5\. Initialise Alembic, configure `env.py` for async SQLAlchemy.

6\. Scaffold Vite+React frontend with Tailwind, TanStack Query, and Zustand.

7\. Write `.env.example` and `README.md` with Windows Server deployment steps.

8\. Write `init_admin.py`, `ONBOARDING.md`, `TROUBLESHOOTING.md`, and the `OPS_RUNBOOK.md` skeleton.

9\. Update this log: confirm `/health` works, set next action to Phase 1.1.


**Do not begin Phase 1 until Phase 0 exit criteria are confirmed.**


---


*End of document. Always update before leaving.*

