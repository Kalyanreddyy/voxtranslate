"""Statistics and health check routes."""

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session, health_check
from app.models import Job, JobStatus
from app.pipeline.tasks import celery_app
from app.schemas import HealthResponse, StatsResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
async def get_stats(session: AsyncSession = Depends(get_session)) -> StatsResponse:
    """Get dashboard statistics."""
    try:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = now - timedelta(days=7)

        # Today's completed jobs
        today_query = select(func.count(Job.id)).where(
            and_(
                Job.status == JobStatus.COMPLETED,
                Job.completed_at >= today_start,
            )
        )
        today_result = await session.execute(today_query)
        today_count = today_result.scalar() or 0

        # Week's completed jobs
        week_query = select(func.count(Job.id)).where(
            and_(
                Job.status == JobStatus.COMPLETED,
                Job.completed_at >= week_start,
            )
        )
        week_result = await session.execute(week_query)
        week_count = week_result.scalar() or 0

        # Total completed jobs
        total_query = select(func.count(Job.id)).where(Job.status == JobStatus.COMPLETED)
        total_result = await session.execute(total_query)
        total_count = total_result.scalar() or 0

        # Active jobs
        active_query = select(func.count(Job.id)).where(
            Job.status.in_(
                [
                    JobStatus.DOWNLOADING,
                    JobStatus.TRANSCRIBING,
                    JobStatus.DETECTING_OST,
                    JobStatus.TRANSLATING,
                    JobStatus.EXPORTING,
                ]
            )
        )
        active_result = await session.execute(active_query)
        active_jobs = active_result.scalar() or 0

        # Queued jobs
        queued_query = select(func.count(Job.id)).where(Job.status == JobStatus.QUEUED)
        queued_result = await session.execute(queued_query)
        queued_jobs = queued_result.scalar() or 0

        # Failed jobs
        failed_query = select(func.count(Job.id)).where(Job.status == JobStatus.FAILED)
        failed_result = await session.execute(failed_query)
        failed_jobs = failed_result.scalar() or 0

        # Average processing time
        avg_query = select(
            func.avg(func.extract("epoch", Job.completed_at - Job.submitted_at))
        ).where(Job.status == JobStatus.COMPLETED)
        avg_result = await session.execute(avg_query)
        avg_time = avg_result.scalar() or None

        # Cost today
        today_cost_query = select(func.sum(Job.cost_usd)).where(
            and_(
                Job.status == JobStatus.COMPLETED,
                Job.completed_at >= today_start,
            )
        )
        today_cost_result = await session.execute(today_cost_query)
        today_cost = today_cost_result.scalar() or 0

        # Cost week
        week_cost_query = select(func.sum(Job.cost_usd)).where(
            and_(
                Job.status == JobStatus.COMPLETED,
                Job.completed_at >= week_start,
            )
        )
        week_cost_result = await session.execute(week_cost_query)
        week_cost = week_cost_result.scalar() or 0

        # Total cost
        total_cost_query = select(func.sum(Job.cost_usd)).where(
            Job.status == JobStatus.COMPLETED
        )
        total_cost_result = await session.execute(total_cost_query)
        total_cost = total_cost_result.scalar() or 0

        return StatsResponse(
            today_count=today_count,
            week_count=week_count,
            total_count=total_count,
            active_jobs=active_jobs,
            queued_jobs=queued_jobs,
            failed_jobs=failed_jobs,
            avg_time_seconds=avg_time,
            cost_today=today_cost,
            cost_week=week_cost,
            cost_total=total_cost,
        )

    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve statistics",
        )


@router.get("/health", response_model=HealthResponse)
async def health_endpoint(session: AsyncSession = Depends(get_session)) -> HealthResponse:
    """System health check endpoint."""
    import redis

    timestamp = datetime.utcnow()
    db_status = "healthy"
    redis_status = "healthy"
    workers_active = 0

    # Check database
    db_healthy = await health_check()
    if not db_healthy:
        db_status = "unhealthy"

    # Check Redis
    try:
        redis_client = redis.from_url(settings.REDIS_URL)
        redis_client.ping()
    except Exception as e:
        logger.warning(f"Redis health check failed: {e}")
        redis_status = "unhealthy"

    # Check Celery workers
    try:
        stats = celery_app.control.inspect().stats()
        workers_active = len(stats) if stats else 0
    except Exception as e:
        logger.warning(f"Failed to get Celery stats: {e}")

    overall_status = (
        "healthy"
        if (db_status == "healthy" and redis_status == "healthy")
        else "degraded"
    )

    return HealthResponse(
        status=overall_status,
        database=db_status,
        redis=redis_status,
        workers_active=workers_active,
        timestamp=timestamp,
    )
