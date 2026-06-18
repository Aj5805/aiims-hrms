# DECISIONS

Architecture Decision Log. Each entry records a conscious choice: deliberate gaps and tradeoffs, not bugs. Future agents should not change an accepted decision without revisiting it here first.

*Format: Context -> Decision -> Status -> Consequences.*

---

### ADR-001 - Launch with in-app notifications only; email gated off

- **Context:** Email (Zoho SMTP) is fully wired but requires real credentials and adds an external dependency.
- **Decision:** Ship with `EMAIL_SENDING_ENABLED=False`; in-app notifications carry the launch.
- **Status:** Accepted.
- **Consequences:** No outbound email until creds plus flag are set. Enabling is config-only (see `docs/OPERATIONS.md`).

### ADR-002 - Defer git tags / `v1.0.0`

- **Context:** `deployment/ROLLBACK.md` references tags that do not exist yet.
- **Decision:** Do not cut tags yet; create them when explicitly requested.
- **Status:** Accepted (deferred).
- **Consequences:** Tag-based rollback is not available yet; use commit hashes meanwhile.

### ADR-003 - Leave ledger stays schema-derived for launch

- **Context:** Balances and history can be derived from applications and balances.
- **Decision:** Derive the ledger rather than maintain a dedicated append-only transaction table.
- **Status:** Accepted for launch.
- **Consequences:** There is no separate immutable audit trail of every balance mutation yet.

### ADR-004 - Audit `before_state` remains `{}`

- **Context:** Full before/after diffs add complexity across all mutating paths.
- **Decision:** Record action and `after_state` now; leave `before_state` as an empty placeholder.
- **Status:** Accepted (temporary).
- **Consequences:** Audit entries lack prior-value context until implemented.

### ADR-005 - Projection cache is per-worker with short TTL

- **Context:** Balance projection is read-heavy and exact invalidation is costly.
- **Decision:** Cache per worker with roughly a five-minute TTL and no active cross-worker invalidation.
- **Status:** Accepted.
- **Consequences:** Projections can lag until the TTL expires.

### ADR-006 - Resident pro-rata recompute is deferred

- **Context:** It needs a contract-lifecycle event model that does not exist yet.
- **Decision:** Defer implementation.
- **Status:** Accepted (deferred).
- **Consequences:** Safe only if no resident contract changes term at launch.

### ADR-007 - `notify_event` does not commit

- **Context:** Notifications are enqueued inside workflow request handlers.
- **Decision:** The caller owns the transaction; `notify_event` only enqueues.
- **Status:** Accepted.
- **Consequences:** Notifications stay atomic with the workflow change. Callers must commit.

### ADR-008 - Single email poller via PostgreSQL advisory lock

- **Context:** Running the scheduler in four workers would otherwise duplicate sends.
- **Decision:** Elect one sender per tick with `pg_try_advisory_lock(123456789)`.
- **Status:** Accepted.
- **Consequences:** Keeping `--workers 4` is safe even when email is enabled.

### ADR-009 - Notification bell uses optimistic unread updates

- **Context:** Refetching after every mark-read feels laggy.
- **Decision:** Update the badge locally and let the 60-second poll reconcile later.
- **Status:** Accepted.
- **Consequences:** Badge count can diverge briefly from server state.

### ADR-010 - uvicorn must run with proxy headers in production

- **Context:** Behind nginx, every request otherwise appears to come from `127.0.0.1`.
- **Decision:** Run uvicorn with `--proxy-headers --forwarded-allow-ips 127.0.0.1`.
- **Status:** Accepted (mandatory).
- **Consequences:** Omitting it breaks per-client rate limiting and can throttle all users together.

### ADR-011 - Production target is Windows plus NSSM plus nginx plus PostgreSQL 16

- **Context:** The real target environment is an on-prem AIIMS Windows server.
- **Decision:** Use uvicorn under NSSM, nginx for TLS and SPA/API serving, and PostgreSQL 16.
- **Status:** Accepted.
- **Consequences:** Operations remain Windows and PowerShell specific.
