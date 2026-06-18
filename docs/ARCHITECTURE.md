# ARCHITECTURE

System architecture for AIIMS HRMS — components, data model, and the core request/workflow flows.

## High-level topology

```
Browser ──HTTPS──> nginx ──┬──> static SPA (frontend/dist)
                           └──/api──> uvicorn (FastAPI, main:app, --workers 4)
                                          │
                                          ├──> PostgreSQL (asyncpg)
                                          └──> APScheduler (email batch poller)
```

In production nginx terminates TLS, serves the built SPA, and reverse-proxies `/api` to uvicorn on `127.0.0.1:8000`. In local dev the Vite dev server runs the SPA and the backend runs via `uvicorn main:app --reload`.

## Backend structure

- **`app/api/v1/`** — route handlers: `auth`, `leave_applications`, `leave_approvals`, reports, admin, notifications.
- **`app/services/`** — business logic: `notifications.py` (enqueue + render), `email_sender.py` (scheduler + SMTP), leave-accounting services.
- **`app/core/`** — `config.py` (settings + boot guard), `database.py` (async session factory).
- **`app/auth/`** — `jwt.py`: `hash_password`, `verify_password`, `create_access_token`, `create_refresh_token`.
- **`seeds/`** — versioned seeds (leave types, workflow config, email templates, test users).
- **`alembic/`** — schema migrations. **`main.py`** — app + lifespan (starts the email scheduler).

## Data model (core entities)

| Entity | Purpose |
| --- | --- |
| `users` | Login identity, role, `password_hash`, `must_change_password`, lockout (`failed_login_attempts`, `locked_until`), `tokens_valid_from`, link to `employee_id` |
| `employees` | HR master data (name, code, department, regular/resident) |
| `leave_types` | Leave categories with codes (e.g. EL, HPL) and accrual rules |
| `leave_balances` / accounts | Per-employee balances; credited annually, carried forward (EL cap 300) |
| `leave_applications` | A leave request; carries status and the generated app number `HRMS/<year>/<n>` |
| `leave_approvals` | Per-step approval records along the chain |
| `workflow_config` / `workflow_steps` | Defines the approval chain per employee category and step order |
| `notification_queue` | Pending/sent IN_APP + EMAIL notifications |
| `email_templates` | Jinja2 templates keyed by event code (APP_SUBMITTED, APP_APPROVED, …) |
| `audit_log` | Admin-visible record of sensitive actions |

## Auth model

- Login issues a short-lived **access token** (JSON body) + a **refresh token** in an httpOnly cookie (`Secure` in prod, `SameSite=strict`, scoped to `/api/v1/auth`).
- Passwords hashed with **bcrypt** (`BCRYPT_ROUNDS`, default 12).
- **Token invalidation:** each user row carries `tokens_valid_from`; a password change sets it to `now()`, invalidating all previously issued tokens. The self-service password-change endpoint therefore re-issues fresh tokens and the SPA stores them (prevents the post-change lockout loop).
- **RBAC:** role checks gate routes; the seven roles map to the approval chain.

## Approval workflow

Workflow is data-driven via `workflow_config` + `workflow_steps`:

- **Regular:** HOD → Establishment Officer → Registrar
- **Resident:** HOD → Dean (Academic)

Approver resolution picks the configured `specific_approver_id` if set, otherwise the active user holding the step's role. On each approve, the next step is notified via an `APPROVAL_REQUEST` event; final approval marks the application `APPROVED` and the leave balance is decremented.

## Notifications

1. A workflow event calls `notify_event(...)` (submit, approve, reject, modify, withdraw, approval-request).
2. `notify_event` loads the matching active `email_templates` row, renders it with Jinja2, and enqueues an `IN_APP` row (always) and an `EMAIL` row (skipped if the recipient has no institutional email) for each recipient. **It does not commit** — the calling request owns the transaction.
3. The in-app bell reads unread notifications; mark-read updates optimistically client-side, reconciled by a 60s poll.
4. `email_sender` runs on an APScheduler interval. Under `--workers 4`, a **PostgreSQL advisory lock** (`pg_try_advisory_lock(123456789)`) elects a single sender so emails aren't multiplied. Email send is gated entirely behind `EMAIL_SENDING_ENABLED`.

## Leave accounting

Balances are credited annually (EL 30/yr, HPL 20/yr) with carry-forward up to the EL cap (300). The current ledger is **schema-derived** from applications/balances rather than a dedicated immutable transaction table (see `DECISIONS.md`). A projection helper computes forward balances; it is cached per-worker with a short TTL.

## Request flow (apply for leave)

```
Staff submits  ->  POST /leave_applications  ->  validate balance + workflow
               ->  insert application (status PENDING, app number assigned)
               ->  notify_event(APP_SUBMITTED) enqueues IN_APP/EMAIL
               ->  commit
HOD approves   ->  POST approve  ->  record approval, advance step
               ->  notify_event(APP_APPROVED / APPROVAL_REQUEST to next)
               ->  final step -> status APPROVED, balance decremented
```