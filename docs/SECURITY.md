# SECURITY

Security posture for AIIMS HRMS. Most items below landed in Phase 8 (`054359e`); the password-change token refresh fix shipped in `0bbb590`.

## Authentication

- JWT access token is returned in the JSON body.
- Refresh token is stored in an httpOnly cookie with `SameSite=strict`, path `/api/v1/auth`, and 7-day max age.
- Password hashing uses bcrypt via `backend/app/auth/jwt.py`, controlled by `BCRYPT_ROUNDS`.
- Each user row carries `tokens_valid_from`; password changes invalidate older tokens.
- `change-my-password` immediately issues fresh tokens so forced-password-change users are not stranded with invalid credentials.

## Login lockout

Brute-force protection is persisted in `users.failed_login_attempts` and `users.locked_until`. Bad credentials increment the counter; successful login resets it. The test-user seed resets those columns on reseed so test accounts do not stay locked.

## Password policy

- Complexity is enforced on both admin reset and self-service change.
- New seeded staff users start with `must_change_password=true`.
- Self-service change requires the current password.

## Rate limiting

`slowapi` uses `get_remote_address` to throttle sensitive endpoints.

> **Critical production requirement:** uvicorn must run with `--proxy-headers --forwarded-allow-ips 127.0.0.1`. Behind nginx, omitting those flags makes every request appear to come from `127.0.0.1`, so the limiter would throttle all users together instead of by client IP.

## Upload validation

Upload validation currently applies to the two implemented import endpoints:

- `POST /api/v1/employees/import` accepts CSV only
- `POST /api/v1/leave-balances/opening/import` accepts XLSX only

Both are size-limited by `UPLOAD_MAX_SIZE_MB`. A separate attachment upload endpoint with an explicit PDF/JPG/PNG whitelist remains a planned backlog item.

## Authorization

Seven roles gate routes: `STAFF`, `HOD`, `ESTABLISHMENT_OFFICER`, `REGISTRAR`, `DEAN_ACADEMIC`, `DIRECTOR`, `ADMIN`. Reports and admin surfaces are role-restricted.

## Audit logging

Sensitive actions are written to `audit_log` and surfaced in the admin view. Known limitation: `before_state` is still stored as `{}`; see `docs/DECISIONS.md`.

## Transport and cookies

- HTTPS is terminated at nginx.
- `COOKIE_SECURE=True` is required in production so the refresh cookie carries `Secure`.
- The nginx certificate CN must match the real hostname.

## Secrets

`JWT_SECRET`, DB credentials, and the Zoho app password live only in `.env`; see `docs/CONFIGURATION.md`.

## Accepted gaps

- Email sending is disabled by default; launch posture is in-app notifications only.
- Audit `before_state` is not captured yet.
- Attachment upload endpoint is not built yet.
