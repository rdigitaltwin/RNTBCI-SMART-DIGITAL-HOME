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
        "Generating and saving a new secret to jwt_secret.txt. "
        "For production, set JWT_SECRET_KEY in your environment."
    )
    new_secret = secrets.token_hex(32)
    try:
        with open(secret_file, "w") as f:
            f.write(new_secret)
    except IOError:
        logging.warning("Could not write to jwt_secret.txt. Generating ephemeral secret.")
        
    return new_secret


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "RNTBCI Smart Home Digital Twin"
    app_version: str = "1.0.0"
    debug: bool = False
    debug_sql: bool = False

    # Database (prefer DATABASE_URL; or assemble from DB_* when injected by ECS secrets)
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/rntbci"
    database_sync_url: str = "postgresql://postgres:password@localhost:5432/rntbci"
    database_ssl: bool = False  # set DATABASE_SSL=true for RDS / managed Postgres
    db_host: str = ""
    db_port: int = 5432
    db_user: str = ""
    db_password: str = ""
    db_name: str = "rntbci"
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
        """Resolve JWT secret and validate Database URL after initialization."""
        if not self.jwt_secret_key:
            self.jwt_secret_key = _resolve_jwt_secret()

        # Assemble DATABASE_URL from discrete DB_* env vars when provided (ECS Secrets)
        if self.db_host and self.db_user and self.db_password:
            from urllib.parse import quote_plus

            user = quote_plus(self.db_user)
            password = quote_plus(self.db_password)
            host = self.db_host
            port = self.db_port
            name = self.db_name or "rntbci"
            self.database_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{name}"
            self.database_sync_url = f"postgresql://{user}:{password}@{host}:{port}/{name}"

        # Parse and sanitize database URL for asyncpg (Standardize PaaS URLs)
        url = self.database_url
        if url.startswith("postgres://"):
            self.database_url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://"):
            self.database_url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Detect SSL from query string or DATABASE_SSL env; strip sslmode for asyncpg
        lower = self.database_url.lower()
        if "sslmode=require" in lower or "sslmode=verify" in lower or self.database_ssl:
            self.database_ssl = True
        if "?" in self.database_url:
            base, _, query = self.database_url.partition("?")
            kept = [
                part
                for part in query.split("&")
                if part and not part.lower().startswith("sslmode=")
            ]
            self.database_url = f"{base}?{'&'.join(kept)}" if kept else base

        # Log environment securely (without passwords)
        env_type = "Local" if "localhost" in self.database_url or "127.0.0.1" in self.database_url else "Remote/PaaS"
        
        try:
            # Safely extract host details for logging
            safe_url = self.database_url.split("@")[-1] if "@" in self.database_url else self.database_url.split("//")[-1]
            safe_host = safe_url.split("/")[0]
            safe_db = safe_url.split("/")[-1].split("?")[0] if "/" in safe_url else "unknown"
            
            logging.info(f"Environment: {env_type}")
            logging.info(f"Database Host: {safe_host}")
            logging.info(f"Database Name: {safe_db}")
            logging.info(f"SSL Enabled: {self.database_ssl}")
        except Exception:
            logging.warning("Could not safely parse DATABASE_URL for logging.")


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
