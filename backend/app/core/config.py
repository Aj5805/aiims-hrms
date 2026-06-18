"""Application settings loaded from environment / .env."""

from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode


class Settings(BaseSettings):
    APP_ENV: str = "development"

    DATABASE_URL: str = "postgresql+asyncpg://aiims_hrms:aiims_hrms@localhost:5432/aiims_hrms"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://aiims_hrms:aiims_hrms@localhost:5432/aiims_hrms"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_PRE_PING: bool = True

    JWT_SECRET: str = "local-dev-insecure-secret-change-before-shared-use"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = False

    CORS_ORIGINS: Annotated[
        list[str],
        NoDecode,
    ] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    ZOHO_SMTP_HOST: str = "smtp.zoho.in"
    ZOHO_SMTP_PORT: int = 587
    ZOHO_EMAIL: str = ""
    ZOHO_APP_PASSWORD: str = ""

    RATE_LIMIT_AUTH: str = "5/minute"
    RATE_LIMIT_GENERAL: str = "100/minute"
    RATE_LIMIT_EXPORT: str = "10/minute"

    UPLOAD_MAX_SIZE_MB: int = 5
    UPLOAD_DIR: str = "uploads"
    BACKUP_DIR: str = "backups"

    BCRYPT_ROUNDS: int = 12

    @field_validator("APP_ENV")
    @classmethod
    def validate_app_env(cls, value: str) -> str:
        normalized = value.strip().lower()
        allowed = {"development", "local", "test", "staging", "production"}
        if normalized not in allowed:
            raise ValueError(f"APP_ENV must be one of: {', '.join(sorted(allowed))}")
        return normalized

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, value: str, info):
        app_env = info.data.get("APP_ENV", "development")
        if app_env in {"staging", "production"} and (
            value == "local-dev-insecure-secret-change-before-shared-use" or len(value) < 32
        ):
            raise ValueError(
                "JWT_SECRET must be explicitly set to a strong value outside local/test development"
            )
        return value

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            if value == "*":
                return ["*"]
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, value: list[str], info) -> list[str]:
        app_env = info.data.get("APP_ENV", "development")
        if app_env not in {"development", "local", "test"} and "*" in value:
            raise ValueError("CORS_ORIGINS cannot use '*' outside local/test development")
        return value

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
