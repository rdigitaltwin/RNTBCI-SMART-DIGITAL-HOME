"""RNTBCI Smart Home Digital Twin - Database Connection & Session Management."""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug_sql,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
    pool_recycle=3600,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yield a database session per request."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> bool:
    """Create all tables with robust retries. Used for development bootstrapping."""
    import asyncio
    import logging
    
    logger = logging.getLogger(__name__)

    def check_and_drop_legacy(sync_conn):
        from sqlalchemy import inspect, text
        inspector = inspect(sync_conn)
        if inspector.has_table("home_power_history"):
            columns = [col['name'] for col in inspector.get_columns("home_power_history")]
            if "base_load_kw" not in columns or "ev_charger_kw" not in columns:
                sync_conn.execute(text("DROP TABLE home_power_history CASCADE"))

        # Migrate device_power_history: old schema had device_name, mode, kw, kvar, etc.
        # New schema only has: device_id, timestamp, total_power_consumption_kw
        if inspector.has_table("device_power_history"):
            columns = [col['name'] for col in inspector.get_columns("device_power_history")]
            if "total_power_consumption_kw" not in columns:
                sync_conn.execute(text("DROP TABLE device_power_history CASCADE"))

        # Auto-migrate execution_mode column on devices table if missing
        if inspector.has_table("devices"):
            columns = [col['name'] for col in inspector.get_columns("devices")]
            if "execution_mode" not in columns:
                sync_conn.execute(text("ALTER TABLE devices ADD COLUMN execution_mode VARCHAR(32) DEFAULT 'simulation'"))

    max_retries = 5
    base_delay = 2

    async def ensure_postgres_device_type_enum() -> None:
        """Add new DeviceType labels to the existing Postgres enum.

        create_all does not ALTER existing enum types. SQLAlchemy persists
        DeviceType by member *name* (EV_VEHICLE), not the value (ev_vehicle).
        ADD VALUE must run in AUTOCOMMIT so later inserts can use the label.
        """
        from sqlalchemy import text as sa_text

        if "postgresql" not in settings.database_url:
            return
        # Name (SQLAlchemy default) and value (in case an earlier hotfix added it).
        labels = ("EV_VEHICLE", "ev_vehicle", "NEBULIZER", "nebulizer")
        async with engine.connect() as conn:
            await conn.execution_options(isolation_level="AUTOCOMMIT")
            for label in labels:
                try:
                    await conn.execute(
                        sa_text(f"ALTER TYPE devicetype ADD VALUE IF NOT EXISTS '{label}'")
                    )
                except Exception as exc:
                    logger.warning("Could not add enum label %s: %s", label, exc)

    for attempt in range(1, max_retries + 1):
        try:
            await ensure_postgres_device_type_enum()
            async with engine.begin() as conn:
                await conn.run_sync(check_and_drop_legacy)
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database initialized successfully.")
            return True
        except ConnectionRefusedError as e:
            logger.error(f"Database connection refused (Attempt {attempt}/{max_retries}). Is PostgreSQL running on the specified host/port?")
        except Exception as e:
            logger.error(f"Database initialization failed (Attempt {attempt}/{max_retries}): {e}")
            
        if attempt < max_retries:
            delay = base_delay ** attempt
            logger.info(f"Retrying database connection in {delay} seconds...")
            await asyncio.sleep(delay)
            
    logger.critical("Max database connection retries reached. The application will start, but database-dependent features will fail.")
    return False


async def close_db() -> None:
    """Dispose of the database engine."""
    await engine.dispose()
