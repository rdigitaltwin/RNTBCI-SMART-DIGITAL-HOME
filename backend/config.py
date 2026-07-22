"""RNTBCI Smart Home Digital Twin - Application Configuration."""

import logging
import os
import secrets
from functools import lru_cache

from pydantic_settings import BaseSettings


def _resolve_jwt_secret() -> str:
    """Resolve JWT secret: Environment -> File -> Ephemeral (with warning)."""
    env_secret = os.getenv("JWT_SECRET_KEY")
    if env_secret:
        return env_secret

    secret_file = os.path.join(os.path.dirname(__file__), "..", "jwt_secret.txt")
    if os.path.exists(secret_file):
        with open(secret_file, "r") as f:
            file_secret = f.read().strip()
            if file_secret:
                return file_secret

    logging.warning(
        "JWT_SECRET_KEY not found in environment or jwt_secret.txt. "
        "Generating ephemeral secret. This instance will be isolated - "
        "tokens will NOT be valid across restarts or multiple instances."
    )
    return secrets.token_hex(32)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "RNTBCI Smart Home Digital Twin"
    app_version: str = "1.0.0"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/rntbci"
    database_sync_url: str = "postgresql://postgres:password@localhost:5432/rntbci"
    db_pool_size: int = 20
    db_max_overflow: int = 10

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # MQTT
    mqtt_broker_host: str = "localhost"
    mqtt_broker_port: int = 1883

    # CORS
    allowed_origins: str = "http://localhost:3000,http://localhost:5173,https://rntbci-project.vercel.app"

    # Rate Limiting
    rate_limit_per_minute: int = 100
    auth_rate_limit_per_minute: int = 10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"

    def get_allowed_origins_list(self) -> list[str]:
        """Parse comma-separated origins into a list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    def model_post_init(self, __context: object) -> None:
        """Resolve JWT secret after initialization."""
        if not self.jwt_secret_key:
            self.jwt_secret_key = _resolve_jwt_secret()


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
