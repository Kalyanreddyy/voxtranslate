"""FastAPI application factory and configuration."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import create_tables, health_check
from app.routes import batch, chunks, jobs, stats, review, users

logger = logging.getLogger(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for application startup/shutdown."""
    # Startup
    logger.info("VoxTranslate backend starting...")
    try:
        await create_tables()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

    # Database health check
    db_healthy = await health_check()
    if not db_healthy:
        logger.warning("Database health check failed at startup")

    yield

    # Shutdown
    logger.info("VoxTranslate backend shutting down...")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Video translation pipeline backend",
        lifespan=lifespan,
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(jobs.router, prefix="/api", tags=["jobs"])
    app.include_router(stats.router, prefix="/api", tags=["stats"])
    app.include_router(batch.router, prefix="/api", tags=["batch"])
    app.include_router(review.router, prefix="/api", tags=["review"])
    app.include_router(users.router, prefix="/api", tags=["users"])
    app.include_router(chunks.router, prefix="/api", tags=["chunks"])

    # Root endpoint
    @app.get("/")
    async def root():
        """Root endpoint."""
        return {
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "running",
        }

    # Health check endpoint
    @app.get("/health")
    async def health():
        """Basic health check endpoint."""
        return {"status": "ok", "app": settings.APP_NAME}

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        """Handle uncaught exceptions."""
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "detail": str(exc)},
        )

    return app


# Create application instance
app = create_app()
