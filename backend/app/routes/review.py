"""Review workflow routes for transcription and translation approval."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Job, JobStatus
from app.pipeline.tasks import (
    celery_app,
    resume_after_transcription_review,
    resume_after_translation_review,
)
from app.schemas import (
    JobResponse,
    TranscriptionReviewRequest,
    TranslationReviewRequest,
)
from app.utils.events import publish_job_event
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["review"])


@router.get("/{job_id}/transcription", status_code=status.HTTP_200_OK)
async def get_transcription_for_review(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get current transcription data for editing."""
    try:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        if job.status != JobStatus.AWAITING_TRANSCRIPTION_REVIEW:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job is not awaiting transcription review (status: {job.status})",
            )

        return {
            "job_id": str(job.id),
            "video_title": job.video_title,
            "transcription": job.transcription,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting transcription for review {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve transcription",
        )


@router.get("/{job_id}/translation", status_code=status.HTTP_200_OK)
async def get_translation_for_review(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Get current translation data for editing."""
    try:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        if job.status != JobStatus.AWAITING_TRANSLATION_REVIEW:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job is not awaiting translation review (status: {job.status})",
            )

        return {
            "job_id": str(job.id),
            "video_title": job.video_title,
            "transcription": job.transcription,
            "translation": job.translation,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting translation for review {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve translation",
        )


@router.post("/{job_id}/review/transcription", response_model=JobResponse)
async def submit_transcription_review(
    job_id: UUID,
    review: TranscriptionReviewRequest,
    session: AsyncSession = Depends(get_session),
) -> JobResponse:
    """Submit edited transcription and resume pipeline."""
    try:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        if job.status != JobStatus.AWAITING_TRANSCRIPTION_REVIEW:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job is not awaiting transcription review (status: {job.status})",
            )

        # Update transcription with edited segments
        if job.transcription is None:
            job.transcription = {}

        job.transcription["segments"] = [
            {"start": seg.start, "end": seg.end, "text": seg.text} for seg in review.segments
        ]
        job.reviewer_notes = review.reviewer_notes
        job.transcription_reviewed_at = datetime.utcnow()

        await session.commit()
        logger.info(f"Transcription review submitted for job {job_id}")

        # Trigger resume task
        await publish_job_event(
            str(job_id), "review_submitted", {"stage": "transcription"}
        )
        task = resume_after_transcription_review.delay(str(job_id))
        logger.info(f"Dispatched resume_after_transcription_review task {task.id} for job {job_id}")

        await session.refresh(job)
        return JobResponse.model_validate(job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting transcription review for {job_id}: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit transcription review",
        )


@router.post("/{job_id}/review/translation", response_model=JobResponse)
async def submit_translation_review(
    job_id: UUID,
    review: TranslationReviewRequest,
    session: AsyncSession = Depends(get_session),
) -> JobResponse:
    """Submit edited translation and resume pipeline."""
    try:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        if job.status != JobStatus.AWAITING_TRANSLATION_REVIEW:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job is not awaiting translation review (status: {job.status})",
            )

        # Update translation with edited segments
        if job.translation is None:
            job.translation = {}

        job.translation["segments"] = [
            {
                "start": seg.start,
                "end": seg.end,
                "translation": seg.translation,
            }
            for seg in review.segments
        ]
        if review.summary:
            job.translation["summary"] = review.summary

        job.reviewer_notes = review.reviewer_notes
        job.translation_reviewed_at = datetime.utcnow()

        await session.commit()
        logger.info(f"Translation review submitted for job {job_id}")

        # Trigger resume task
        await publish_job_event(
            str(job_id), "review_submitted", {"stage": "translation"}
        )
        task = resume_after_translation_review.delay(str(job_id))
        logger.info(f"Dispatched resume_after_translation_review task {task.id} for job {job_id}")

        await session.refresh(job)
        return JobResponse.model_validate(job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting translation review for {job_id}: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit translation review",
        )


@router.post("/{job_id}/skip-review/transcription", response_model=JobResponse)
async def skip_transcription_review(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> JobResponse:
    """Skip transcription review and resume with original transcription."""
    try:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        if job.status != JobStatus.AWAITING_TRANSCRIPTION_REVIEW:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job is not awaiting transcription review (status: {job.status})",
            )

        job.transcription_reviewed_at = datetime.utcnow()
        job.reviewer_notes = "Transcription review skipped - approved as-is"

        await session.commit()
        logger.info(f"Transcription review skipped for job {job_id}")

        # Trigger resume task
        await publish_job_event(
            str(job_id), "review_skipped", {"stage": "transcription"}
        )
        task = resume_after_transcription_review.delay(str(job_id))
        logger.info(f"Dispatched resume_after_transcription_review task {task.id} for job {job_id}")

        await session.refresh(job)
        return JobResponse.model_validate(job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error skipping transcription review for {job_id}: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to skip transcription review",
        )


@router.post("/{job_id}/skip-review/translation", response_model=JobResponse)
async def skip_translation_review(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> JobResponse:
    """Skip translation review and resume with original translation."""
    try:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        if job.status != JobStatus.AWAITING_TRANSLATION_REVIEW:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job is not awaiting translation review (status: {job.status})",
            )

        job.translation_reviewed_at = datetime.utcnow()
        job.reviewer_notes = "Translation review skipped - approved as-is"

        await session.commit()
        logger.info(f"Translation review skipped for job {job_id}")

        # Trigger resume task
        await publish_job_event(
            str(job_id), "review_skipped", {"stage": "translation"}
        )
        task = resume_after_translation_review.delay(str(job_id))
        logger.info(f"Dispatched resume_after_translation_review task {task.id} for job {job_id}")

        await session.refresh(job)
        return JobResponse.model_validate(job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error skipping translation review for {job_id}: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to skip translation review",
        )


@router.post("/{job_id}/assign", response_model=JobResponse)
async def assign_job_to_user(
    job_id: UUID,
    username: str,
    session: AsyncSession = Depends(get_session),
) -> JobResponse:
    """Assign job to a linguist (admin only)."""
    try:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        job.assigned_to = username

        await session.commit()
        logger.info(f"Job {job_id} assigned to {username}")

        await session.refresh(job)
        return JobResponse.model_validate(job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning job {job_id}: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign job",
        )
