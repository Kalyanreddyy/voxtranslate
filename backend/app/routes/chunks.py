"""Chunk management routes for multi-linguist job splitting."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Job, JobStatus
from app.pipeline.tasks import (
    celery_app,
    filter_segments_by_range,
    merge_chunks,
)
from app.schemas import ChunkResponse, JobResponse, SplitRequest
from app.utils.events import publish_job_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["chunks"])


@router.post("/{job_id}/split", response_model=list[ChunkResponse])
async def split_job(
    job_id: UUID,
    request: SplitRequest,
    session: AsyncSession = Depends(get_session),
) -> list[ChunkResponse]:
    """
    Split a completed job into chunks for multi-linguist review.

    The parent job must be in awaiting_transcription_review or awaiting_translation_review status.
    Child jobs will be created with filtered segments matching each chunk's time range.
    """
    try:
        # Get parent job
        result = await session.execute(select(Job).where(Job.id == job_id))
        parent_job = result.scalar_one_or_none()

        if not parent_job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        # Validate parent job status
        if parent_job.status not in [
            JobStatus.AWAITING_TRANSCRIPTION_REVIEW,
            JobStatus.AWAITING_TRANSLATION_REVIEW,
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job must be awaiting review to split (current status: {parent_job.status})",
            )

        if not request.chunks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one chunk must be provided",
            )

        logger.info(f"Splitting job {job_id} into {len(request.chunks)} chunks")

        created_chunks = []

        # Create child jobs for each chunk
        for chunk_idx, chunk_def in enumerate(request.chunks):
            logger.info(f"Creating child job {chunk_idx + 1}/{len(request.chunks)}")

            # Filter transcription segments for this chunk
            filtered_transcription = None
            if parent_job.transcription:
                segments = parent_job.transcription.get("segments", [])
                filtered_segments = filter_segments_by_range(segments, chunk_def.start, chunk_def.end)
                filtered_transcription = {"segments": filtered_segments}

            # Filter translation segments for this chunk
            filtered_translation = None
            if parent_job.translation:
                segments = parent_job.translation.get("segments", [])
                filtered_segments = filter_segments_by_range(segments, chunk_def.start, chunk_def.end)
                filtered_translation = {"segments": filtered_segments}
                # Copy summary if it exists
                if "summary" in parent_job.translation:
                    filtered_translation["summary"] = parent_job.translation["summary"]

            # Determine child job status based on parent status
            child_status = parent_job.status

            # Create child job
            child_job = Job(
                youtube_url=parent_job.youtube_url,
                video_title=parent_job.video_title,
                source_language=parent_job.source_language,
                duration_seconds=parent_job.duration_seconds,
                size_bytes=parent_job.size_bytes,
                status=child_status,
                current_stage=parent_job.current_stage,
                progress_pct=100,
                submitted_by=parent_job.submitted_by,
                started_at=parent_job.started_at,
                metadata_=parent_job.metadata_,
                transcription=filtered_transcription,
                translation=filtered_translation,
                ost_detection=parent_job.ost_detection,
                cost_usd=parent_job.cost_usd / len(request.chunks),
                assigned_to=chunk_def.assign_to,
                transcription_reviewed_at=parent_job.transcription_reviewed_at,
                translation_reviewed_at=parent_job.translation_reviewed_at,
                reviewer_notes=f"Chunk {chunk_idx + 1} of {len(request.chunks)}: {chunk_def.start} - {chunk_def.end}",
                is_parent="N",
                parent_job_id=parent_job.id,
                chunk_index=chunk_idx,
                chunk_start=chunk_def.start,
                chunk_end=chunk_def.end,
                chunk_count=len(request.chunks),
                chunks_completed=0,
            )

            session.add(child_job)
            await session.flush()

            created_chunks.append(
                ChunkResponse(
                    chunk_index=chunk_idx,
                    chunk_start=chunk_def.start,
                    chunk_end=chunk_def.end,
                    assigned_to=chunk_def.assign_to,
                    status=str(child_status),
                    job_id=child_job.id,
                )
            )

            logger.info(f"Created child job {child_job.id} for chunk {chunk_idx + 1}")

        # Update parent job to mark as parent
        parent_job.is_parent = "Y"
        parent_job.chunk_count = len(request.chunks)

        await session.commit()

        logger.info(f"Successfully split job {job_id} into {len(request.chunks)} chunks")
        await publish_job_event(
            str(job_id),
            "job_split",
            {
                "chunk_count": len(request.chunks),
                "child_job_ids": [str(chunk.job_id) for chunk in created_chunks],
            },
        )

        return created_chunks

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error splitting job {job_id}: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to split job: {str(e)}",
        )


@router.get("/{job_id}/chunks", response_model=list[JobResponse])
async def get_chunks(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> list[JobResponse]:
    """
    List all chunks for a parent job.

    Returns child jobs ordered by chunk_index.
    """
    try:
        # Verify parent job exists and is a parent
        result = await session.execute(select(Job).where(Job.id == job_id))
        parent_job = result.scalar_one_or_none()

        if not parent_job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        if parent_job.is_parent != "Y":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job {job_id} is not a parent job",
            )

        # Get all child jobs ordered by chunk_index
        result = await session.execute(
            select(Job)
            .where(Job.parent_job_id == job_id)
            .order_by(Job.chunk_index)
        )
        child_jobs = result.scalars().all()

        return [JobResponse.model_validate(job) for job in child_jobs]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chunks for job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve chunks",
        )


@router.post("/{job_id}/merge", response_model=JobResponse)
async def merge_chunks_endpoint(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> JobResponse:
    """
    Manually trigger merge of all approved chunks.

    All child chunks must be in COMPLETED status.
    """
    try:
        # Get parent job
        result = await session.execute(select(Job).where(Job.id == job_id))
        parent_job = result.scalar_one_or_none()

        if not parent_job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        if parent_job.is_parent != "Y":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job {job_id} is not a parent job",
            )

        # Get all child jobs
        result = await session.execute(
            select(Job).where(Job.parent_job_id == job_id)
        )
        child_jobs = result.scalars().all()

        if not child_jobs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent job has no child chunks",
            )

        # Validate all chunks are completed
        for child in child_jobs:
            if child.status != JobStatus.COMPLETED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Child job {child.id} is not completed (status: {child.status})",
                )

        logger.info(f"Dispatching merge_chunks task for parent job {job_id}")

        # Dispatch merge task
        task = merge_chunks.delay(str(job_id))
        logger.info(f"Dispatched merge_chunks task {task.id} for parent job {job_id}")

        await publish_job_event(str(job_id), "merge_started", {"chunk_count": len(child_jobs)})

        await session.refresh(parent_job)
        return JobResponse.model_validate(parent_job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error merging chunks for job {job_id}: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to merge chunks: {str(e)}",
        )


@router.post("/{job_id}/reassign-chunk", response_model=JobResponse)
async def reassign_chunk(
    job_id: UUID,
    assign_to: str,
    session: AsyncSession = Depends(get_session),
) -> JobResponse:
    """
    Reassign a chunk to a different linguist.

    The chunk job must still be in awaiting_transcription_review or awaiting_translation_review status.
    """
    try:
        # Get chunk job
        result = await session.execute(select(Job).where(Job.id == job_id))
        chunk_job = result.scalar_one_or_none()

        if not chunk_job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        if chunk_job.parent_job_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job {job_id} is not a chunk job",
            )

        # Validate status
        if chunk_job.status not in [
            JobStatus.AWAITING_TRANSCRIPTION_REVIEW,
            JobStatus.AWAITING_TRANSLATION_REVIEW,
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chunk job must be awaiting review to reassign (current status: {chunk_job.status})",
            )

        chunk_job.assigned_to = assign_to
        await session.commit()

        logger.info(f"Reassigned chunk job {job_id} to {assign_to}")
        await publish_job_event(
            str(job_id),
            "chunk_reassigned",
            {"assigned_to": assign_to},
        )

        await session.refresh(chunk_job)
        return JobResponse.model_validate(chunk_job)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reassigning chunk job {job_id}: {e}")
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reassign chunk: {str(e)}",
        )
