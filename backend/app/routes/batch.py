"""Batch job processing routes."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Job, JobStatus
from app.pipeline.tasks import process_video
from app.schemas import BatchCreate, BatchResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/batch", tags=["batch"])


@router.post("", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
async def create_batch_jobs(
    batch_create: BatchCreate,
    session: AsyncSession = Depends(get_session),
) -> BatchResponse:
    """Create multiple translation jobs from a list of URLs."""
    job_ids = []

    try:
        for url in batch_create.urls:
            # Create job record
            job = Job(
                youtube_url=str(url),
                source_language=batch_create.language_hint or "en",
                status=JobStatus.QUEUED,
                current_stage="queued",
                progress_pct=0,
                submitted_by="batch_api",
            )

            session.add(job)
            await session.flush()

            # Dispatch Celery task
            task = process_video.delay(str(job.id))
            logger.info(f"Batch: Created job {job.id} with Celery task {task.id}")

            job_ids.append(job.id)

        await session.commit()
        return BatchResponse(job_ids=job_ids, count=len(job_ids))

    except Exception as e:
        logger.error(f"Error creating batch jobs: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create batch jobs: {str(e)}",
        )
