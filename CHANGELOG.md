# CHANGELOG

All notable changes to AIIMS HRMS. This is commit-oriented for now because release tags have not been cut yet; see `docs/DECISIONS.md` ADR-002.

## [Unreleased]

Roll back by commit hash until `v*` tags exist.

### Added

- Notifications are wired end to end: workflow events now enqueue and display in-app notifications, the NotificationBell is live, and email remains config-gated behind `EMAIL_SENDING_ENABLED`. The APScheduler sender uses a PostgreSQL advisory lock so one worker sends each batch. - `0bbb590`

### Fixed

- Forced-password-change lockout loop: `change-my-password` now returns fresh tokens and the SPA stores them after `tokens_valid_from` changes. - `0bbb590`

## Build history

| Commit | Summary |
| --- | --- |
| `0bbb590` | Notifications wired end to end plus auth token refresh fix |
| `054359e` | Phase 8 security hardening: DB-backed login lockout, password complexity, slowapi rate limiting, upload validation |
| `a5acbb3` | Phase 7 reports and admin: locked-column exports, role gates, audit log, health dashboard |
| `72527e6` | Phase 6 to 8 frontend screens |
| `de87e51` | Production go-live runbook refresh |
| `afccf15` | Phase 5 leave accounts: idempotent credit, carry-forward, projection |
| `5924402` | Deployment dry-run: HTTPS to SPA to API proxy to secure cookie |
| `09894f29` | Baseline through phases 0 to 4 |

## Verification snapshot

- Playwright: `6/6` core journeys (`J1` to `J6`)
- pytest: `42 passed`
- `typecheck:e2e`: green

## Planned

See `docs/DECISIONS.md` and `docs/MASTER_PLAN_AND_PATH_FORWARD.md` for the remaining work: release tags, real email enablement, persisted immutable leave ledger, resident pro-rata, audit `before_state` capture, projection-cache invalidation, payroll NIC mapping, and an attachment upload endpoint.
