"""Database configuration and session management."""

import logging
from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
)
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import Base

logger = logging.getLogger(__name__)

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    future=True,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={
        "timeout": 10,
        "command_timeout": 10,
    },
)

# Create async session factory
async_session_maker = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting a database session."""
    async with async_session_maker() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Session error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables() -> None:
    """Create all tables in the database."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created successfully")


async def drop_tables() -> None:
    """Drop all tables from the database. Use with caution."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    logger.warning("Database tables dropped")


async def health_check() -> bool:
    """Check database connectivity."""
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
            return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False
