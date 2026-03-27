#!/usr/bin/env python
"""Management CLI for VoxTranslate backend."""

import asyncio
import logging

import click

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@click.group()
def cli():
    """VoxTranslate backend management commands."""
    pass


@cli.command()
def init_db():
    """Initialize database and create tables."""
    from app.db import create_tables

    asyncio.run(create_tables())
    click.echo("Database initialized successfully")


@cli.command()
def drop_db():
    """Drop all database tables. USE WITH CAUTION."""
    if click.confirm("Are you sure you want to drop all tables?"):
        from app.db import drop_tables

        asyncio.run(drop_tables())
        click.echo("Database tables dropped")
    else:
        click.echo("Cancelled")


@cli.command()
@click.option("--host", default="0.0.0.0", help="Server host")
@click.option("--port", default=8000, help="Server port")
@click.option("--reload", is_flag=True, help="Auto-reload on code changes")
def run_api(host: str, port: int, reload: bool):
    """Run the FastAPI server."""
    import uvicorn

    click.echo(f"Starting API server on {host}:{port}")
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info",
    )


@cli.command()
@click.option("--concurrency", default=4, help="Worker concurrency")
def run_worker(concurrency: int):
    """Run Celery worker."""
    from app.pipeline.tasks import celery_app

    click.echo(f"Starting Celery worker with concurrency={concurrency}")
    celery_app.worker_main(
        [
            "worker",
            "--loglevel=info",
            f"--concurrency={concurrency}",
        ]
    )


@cli.command()
def run_beat():
    """Run Celery Beat scheduler."""
    from app.pipeline.tasks import celery_app

    click.echo("Starting Celery Beat scheduler")
    celery_app.start(["beat", "--loglevel=info"])


@cli.command()
@click.option("--timeout", default=30, help="Health check timeout")
async def health_check(timeout: int):
    """Check system health."""
    import redis

    from app.db import health_check as db_health_check

    click.echo("Checking system health...")

    # Database
    db_ok = await db_health_check()
    click.echo(f"  Database: {'✓' if db_ok else '✗'}")

    # Redis
    try:
        from app.config import settings

        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        click.echo("  Redis: ✓")
    except Exception as e:
        click.echo(f"  Redis: ✗ ({e})")

    # Workers
    try:
        from app.pipeline.tasks import celery_app

        stats = celery_app.control.inspect().stats()
        worker_count = len(stats) if stats else 0
        click.echo(f"  Celery Workers: {worker_count} active")
    except Exception as e:
        click.echo(f"  Celery Workers: ✗ ({e})")


@cli.command()
@click.argument("job_id")
def retry_job(job_id: str):
    """Retry a failed job."""
    import uuid

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from app.config import settings
    from app.models import Job, JobStatus
    from app.pipeline.tasks import process_video

    async def _retry():
        engine = create_async_engine(settings.DATABASE_URL)
        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async with async_session() as session:
            try:
                job_uuid = uuid.UUID(job_id)
                result = await session.execute(select(Job).where(Job.id == job_uuid))
                job = result.scalar_one_or_none()

                if not job:
                    click.echo(f"Job {job_id} not found")
                    return

                if job.status != JobStatus.FAILED:
                    click.echo(f"Job is not failed (status: {job.status})")
                    return

                job.status = JobStatus.QUEUED
                job.current_stage = "queued"
                job.progress_pct = 0
                job.error_message = None

                await session.commit()

                # Dispatch task
                task = process_video.delay(job_id)
                click.echo(f"Job {job_id} queued for retry (task: {task.id})")

            except ValueError:
                click.echo("Invalid job ID format")

    asyncio.run(_retry())


@cli.command()
def show_config():
    """Display current configuration."""
    from app.config import settings

    click.echo("VoxTranslate Configuration:")
    click.echo(f"  Database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'configured'}")
    click.echo(f"  Redis: {settings.REDIS_URL}")
    click.echo(f"  Storage: {settings.STORAGE_PATH}")
    click.echo(f"  Debug: {settings.DEBUG}")
    click.echo(f"  CORS Origins: {settings.CORS_ORIGINS}")
    click.echo(f"  API Keys: ElevenLabs={'*' * 10 if settings.ELEVENLABS_API_KEY else 'NOT SET'}, Anthropic={'*' * 10 if settings.ANTHROPIC_API_KEY else 'NOT SET'}")


if __name__ == "__main__":
    cli()
