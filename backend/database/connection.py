"""RNTBCI Smart Home Digital Twin - Database Connection & Session Management."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
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


async def get_db() -> AsyncSession:
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


async def init_db() -> None:
    """Create all tables. Used for development bootstrapping."""
    def check_and_drop_legacy(sync_conn):
        from sqlalchemy import inspect, text
        inspector = inspect(sync_conn)
        if inspector.has_table("home_power_history"):
            columns = [col['name'] for col in inspector.get_columns("home_power_history")]
            if "base_load_kw" not in columns:
                sync_conn.execute(text("DROP TABLE home_power_history CASCADE"))
                
    async with engine.begin() as conn:
        await conn.run_sync(check_and_drop_legacy)
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Dispose of the database engine."""
    await engine.dispose()
