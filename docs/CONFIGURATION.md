# CONFIGURATION

All runtime configuration is environment-driven via `backend/.env`, loaded by `backend/app/core/config.py`. Copy `backend/.env.example` to `.env` and set values per environment. The production boot guard intentionally refuses to start on unsafe placeholder config.

## Environment variables

| Variable | Example | Required | Notes |
| --- | --- | --- | --- |
| `APP_ENV` | `development`, `test`, `staging`, `production` | Yes | Accepted values are `development`, `local`, `test`, `staging`, `production` |
| `DATABASE_URL` | `postgresql+asyncpg://aiims_hrms:<pw>@localhost:5432/aiims_hrms` | Yes | Async application connection |
| `DATABASE_URL_SYNC` | `postgresql+psycopg2://aiims_hrms:<pw>@localhost:5432/aiims_hrms` | Yes | Sync connection for Alembic and direct SQL helpers |
| `DB_POOL_SIZE` | `20` | No | SQLAlchemy async pool size |
| `DB_MAX_OVERFLOW` | `10` | No | Pool overflow allowance |
| `DB_POOL_TIMEOUT` | `30` | No | Pool checkout timeout in seconds |
| `DB_POOL_PRE_PING` | `True` | No | Enables stale-connection pre-ping |
| `JWT_SECRET` | 32+ random chars | Yes | Must not be the dev placeholder in staging or production |
| `JWT_ALGORITHM` | `HS256` | No | Current token algorithm |
| `ACCESS_TOKEN_EXPIRE_HOURS` | `8` | No | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | No | Refresh cookie lifetime |
| `COOKIE_SECURE` | `True` or `False` | Yes | Must be `True` on HTTPS; use `False` for local HTTP |
| `CORS_ORIGINS` | `https://<hostname>` | Yes | Comma-separated allowlist; only local/test may use `*` |
| `ZOHO_SMTP_HOST` | `smtp.zoho.in` | If email on | SMTP relay host |
| `ZOHO_SMTP_PORT` | `587` | If email on | STARTTLS port |
| `ZOHO_EMAIL` | `hrms@example.org` | If email on | Sender and SMTP login |
| `ZOHO_APP_PASSWORD` | `...` | If email on | Zoho app password |
| `EMAIL_SENDING_ENABLED` | `False` | No | Master switch for outbound email |
| `RATE_LIMIT_AUTH` | `5/minute` | No | Login and refresh limit |
| `RATE_LIMIT_GENERAL` | `100/minute` | No | Default app limit |
| `RATE_LIMIT_EXPORT` | `10/minute` | No | Report export limit |
| `UPLOAD_MAX_SIZE_MB` | `5` | No | Max upload size for validated import endpoints |
| `UPLOAD_DIR` | `uploads` | No | Upload storage path |
| `BACKUP_DIR` | `backups` | No | Backup output path |
| `BCRYPT_ROUNDS` | `12` | No | Password hashing cost |

## Dev vs prod

| Setting | Local dev | Production |
| --- | --- | --- |
| `APP_ENV` | `development` | `production` |
| `COOKIE_SECURE` | `False` | `True` |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Explicit HTTPS hostname only |
| `JWT_SECRET` | Placeholder accepted | Strong 32+ char secret required |
| DB port | local cluster, usually `5432` | real production cluster, usually `5432` |
| Test users | seeded | auto-skipped |
| Email | usually off | off until real creds and flag are set |

## Boot guard

On startup the app validates production and staging settings. It will refuse to boot if `JWT_SECRET` is still the placeholder or too short, or if `CORS_ORIGINS` contains `*` outside local/test environments. `COOKIE_SECURE=True` remains an operational requirement for HTTPS deployments.

## Email

Email is wired but disabled by default. To enable it, set `EMAIL_SENDING_ENABLED=True` and provide `ZOHO_EMAIL` plus `ZOHO_APP_PASSWORD`. The sender is safe under multiple uvicorn workers because it elects a single batch poller with a PostgreSQL advisory lock.

## Secrets

`.env` is never committed. Treat `JWT_SECRET`, DB credentials, and the Zoho app password as secrets. Rotating `JWT_SECRET` invalidates all issued tokens and forces re-login.
