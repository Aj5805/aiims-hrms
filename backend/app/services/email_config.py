"""Runtime email configuration — DB (admin panel) with env fallback."""

import json
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

EMAIL_CONFIG_KEY = "email_config"


@dataclass
class EmailConfig:
    smtp_host: str
    smtp_port: int
    from_email: str
    app_password: str
    sending_enabled: bool


def _env_defaults() -> EmailConfig:
    return EmailConfig(
        smtp_host=settings.ZOHO_SMTP_HOST,
        smtp_port=settings.ZOHO_SMTP_PORT,
        from_email=settings.ZOHO_EMAIL,
        app_password=settings.ZOHO_APP_PASSWORD,
        sending_enabled=settings.EMAIL_SENDING_ENABLED,
    )


async def load_email_config(db: AsyncSession) -> EmailConfig:
    base = _env_defaults()
    result = await db.execute(
        text("SELECT value FROM system_settings WHERE key = :key"),
        {"key": EMAIL_CONFIG_KEY},
    )
    row = result.fetchone()
    if not row or row.value is None:
        return base
    raw = row.value
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return base
    elif isinstance(raw, dict):
        data = raw
    else:
        return base
    return EmailConfig(
        smtp_host=str(data.get("smtp_host") or base.smtp_host),
        smtp_port=int(data.get("smtp_port") or base.smtp_port),
        from_email=str(data.get("from_email") or base.from_email),
        app_password=str(data.get("app_password") or base.app_password),
        sending_enabled=bool(data.get("sending_enabled", base.sending_enabled)),
    )


def mask_email_config(config: EmailConfig) -> dict:
    return {
        "smtp_host": config.smtp_host,
        "smtp_port": config.smtp_port,
        "from_email": config.from_email,
        "app_password_set": bool(config.app_password),
        "sending_enabled": config.sending_enabled,
    }
