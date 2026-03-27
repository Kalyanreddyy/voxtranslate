"""Job management routes."""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.db import get_session
from app.models import Job, JobStatus
from app.pipeline.tasks import celery_app, process_video
from app.schemas import JobCreate, JobListResponse, JobResponse
from app.utils.events import get_job_events

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_create: JobCreate,
    session: AsyncSession = Depends(get_session),
) -> JobResponse:
    """Create a new translation job and dispatch to Celery."""
    try:
        from app.config import settings

        # Validate video duration
        max_duration = job_create.max_duration_seconds or settings.MAX_VIDEO_DURATION_SECONDS
        if max_duration and max_duration > settings.MAX_VIDEO_DURATION_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Max video duration cannot exceed {settings.MAX_VIDEO_DURATION_SECONDS} seconds",
            )

        # Create job record
        time_ranges = None
        if job_create.time_ranges:
            time_ranges = [{"start": tr.start, "end": tr.end} for tr in job_create.time_ranges]

        job = Job(
            youtube_url=str(job_create.youtube_url),
            source_language=job_create.language_hint or "en",
            status=JobStatus.QUEUED,
            current_stage="queued",
            progress_pct=0,
            submitted_by="user",
            assigned_to=job_create.assign_to,
            time_ranges=time_ranges,
        )

        session.add(job)
        await session.flush()  # Flush to get the ID
        await session.commit()

        # Dispatch Celery task
        task = process_video.delay(str(job.id))
        logger.info(f"Created job {job.id} with Celery task {task.id}")

        await session.refresh(job)
        return JobResponse.model_validate(job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating job: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create job: {str(e)}",
        )


@router.get("", response_model=JobListResponse)
async def list_jobs(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned user"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> JobListResponse:
    """List jobs with pagination and optional filtering."""
    try:
        # Build query
        query = select(Job)

        if status_filter:
            try:
                status_enum = JobStatus(status_filter)
                query = query.where(Job.status == status_enum)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status: {status_filter}",
                )

        if assigned_to:
            query = query.where(Job.assigned_to == assigned_to)

        # Count total
        count_result = await session.execute(select(func.count(Job.id)).select_from(Job))
        if status_filter:
            status_enum = JobStatus(status_filter)
            count_result = await session.execute(
                select(func.count(Job.id)).where(Job.status == status_enum)
            )
        total = count_result.scalar() or 0

        # Apply sorting and pagination
        query = query.order_by(desc(Job.created_at))
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await session.execute(query)
        jobs = result.scalars().all()

        pages = (total + page_size - 1) // page_size

        return JobListResponse(
            items=[JobResponse.model_validate(job) for job in jobs],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list jobs",
        )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> JobResponse:
    """Get a specific job by ID."""
    try:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        return JobResponse.model_validate(job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve job",
        )


@router.get("/{job_id}/events")
async def job_events(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """SSE endpoint for real-time job updates."""
    # Verify job exists
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    async def event_generator():
        """Generate SSE events for job updates."""
        try:
            async for event in get_job_events(str(job_id)):
                yield event
        except Exception as e:
            logger.error(f"Error in event generator for job {job_id}: {e}")
            yield f"data: {{'error': '{str(e)}'}}\n\n"

    return EventSourceResponse(event_generator())


@router.delete("/{job_id}", status_code=status.HTTP_200_OK)
async def cancel_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Cancel or delete a job."""
    try:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        # Cancel Celery task if in progress
        if job.status not in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
            # Try to revoke Celery task
            celery_app.control.revoke(str(job_id), terminate=True)

        # Update job status
        job.status = JobStatus.CANCELLED
        job.error_message = "Cancelled by user"
        job.updated_at = datetime.utcnow()

        await session.commit()
        logger.info(f"Cancelled job {job_id}")

        return {"message": f"Job {job_id} cancelled"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling job {job_id}: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel job",
        )


@router.post("/{job_id}/retry", response_model=JobResponse)
async def retry_job(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> JobResponse:
    """Retry a failed job."""
    try:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        if job.status != JobStatus.FAILED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job is not in failed state (current: {job.status})",
            )

        # Reset job status
        job.status = JobStatus.QUEUED
        job.current_stage = "queued"
        job.progress_pct = 0
        job.error_message = None
        job.updated_at = datetime.utcnow()

        await session.commit()

        # Dispatch new Celery task
        task = process_video.delay(str(job.id))
        logger.info(f"Retrying job {job_id} with Celery task {task.id}")

        await session.refresh(job)
        return JobResponse.model_validate(job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrying job {job_id}: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retry job",
        )


@router.get("/{job_id}/download")
async def download_job_output(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """Download the DOCX output file for a completed job."""
    from fastapi.responses import FileResponse

    try:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        if job.status != JobStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job is not completed (status: {job.status})",
            )

        if not job.output_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Output file not found",
            )

        import os

        if not os.path.exists(job.output_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Output file not found on disk",
            )

        filename = f"{job.video_title or 'translation'}_{job_id}.docx"
        return FileResponse(
            path=job.output_path,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading job output {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to download output",
        )
