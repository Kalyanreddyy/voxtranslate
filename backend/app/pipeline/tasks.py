from decimal import Decimal
"""Celery task definitions for the video translation pipeline."""

import json
import logging
from datetime import datetime

from celery import Celery
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import Job, JobStatus

logger = logging.getLogger(__name__)

# Create Celery app
celery_app = Celery(
    "voxtranslate",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)


def get_async_session():
    """Create async session for database operations."""
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DATABASE_ECHO,
        future=True,
        pool_pre_ping=True,
    )
    return sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def update_job_status(job_id: str, status: JobStatus, stage: str, progress: int):
    """Update job status in database."""
    import asyncio

    try:
        from sqlalchemy import select
        from sqlalchemy.ext.asyncio import AsyncSession

        engine = create_async_engine(
            settings.DATABASE_URL,
            echo=settings.DATABASE_ECHO,
            future=True,
        )
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as session:
            result = await session.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()

            if job:
                job.status = status
                job.current_stage = stage
                job.progress_pct = progress
                job.updated_at = datetime.utcnow()

                if stage == "downloading":
                    job.started_at = datetime.utcnow()

                await session.commit()
                logger.info(f"Updated job {job_id}: status={status}, stage={stage}, progress={progress}%")

    except Exception as e:
        logger.error(f"Error updating job status for {job_id}: {e}")


@celery_app.task(bind=True, name="process_video")
def process_video(self, job_id: str):
    """
    Main pipeline orchestrator - runs all 5 stages sequentially.
    Stages: download -> transcribe -> detect_ost -> translate -> export
    """
    import asyncio
    import traceback

    logger.info(f"Starting video processing for job {job_id}")

    try:
        # Run async operations
        asyncio.run(_process_video_async(job_id))
        return {"status": "success", "job_id": job_id}

    except Exception as e:
        logger.error(f"Pipeline error for job {job_id}: {e}\n{traceback.format_exc()}")
        asyncio.run(_set_job_failed(job_id, str(e)))
        raise


async def _process_video_async(job_id: str):
    """Async pipeline orchestration."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

    from app.pipeline.download import download_video
    from app.pipeline.detect_ost import detect_ost
    from app.pipeline.export_docx import create_docx
    from app.pipeline.transcribe import transcribe_video
    from app.pipeline.translate import translate_content
    from app.utils.events import publish_job_event

    engine = create_async_engine(settings.DATABASE_URL, echo=settings.DATABASE_ECHO)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            # Get job
            result = await session.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()

            if not job:
                logger.error(f"Job {job_id} not found")
                return

            # Stage 1: Download
            logger.info(f"[{job_id}] Stage 1: Downloading video")
            job.status = JobStatus.DOWNLOADING
            job.current_stage = "downloading"
            job.started_at = datetime.utcnow()
            await session.commit()
            await publish_job_event(job_id, "stage_start", {"stage": "downloading"})

            download_result = await download_video(job.youtube_url, settings.TEMP_PATH)
            job.metadata_ = download_result.get("metadata", {})
            job.video_title = download_result.get("title", "Unknown")
            job.duration_seconds = download_result.get("duration_seconds")
            job.size_bytes = download_result.get("size_bytes")
            job.progress_pct = 20
            await session.commit()
            await publish_job_event(
                job_id, "stage_complete", {"stage": "downloading", "progress": 20}
            )

            video_path = download_result["path"]

            # Handle time ranges if specified
            if job.time_ranges:
                logger.info(f"[{job_id}] Processing specified time ranges")
                from app.pipeline.download import trim_video

                time_ranges_list = job.time_ranges
                if isinstance(time_ranges_list, str):
                    time_ranges_list = json.loads(time_ranges_list)

                video_path = await trim_video(video_path, time_ranges_list, settings.TEMP_PATH)
                logger.info(f"[{job_id}] Using trimmed video: {video_path}")

            # Stage 2: Transcribe
            logger.info(f"[{job_id}] Stage 2: Transcribing audio")
            job.status = JobStatus.TRANSCRIBING
            job.current_stage = "transcribing"
            job.progress_pct = 30
            await session.commit()
            await publish_job_event(job_id, "stage_start", {"stage": "transcribing"})

            transcription = await transcribe_video(video_path, settings.ELEVENLABS_API_KEY)
            job.transcription = transcription
            job.progress_pct = 40
            job.cost_usd += Decimal("0.01")  # Placeholder cost
            await session.commit()
            await publish_job_event(
                job_id, "stage_complete", {"stage": "transcribing", "progress": 40}
            )

            # Pause for transcription review
            logger.info(f"[{job_id}] Pausing for transcription review")
            job.status = JobStatus.AWAITING_TRANSCRIPTION_REVIEW
            job.current_stage = "awaiting_transcription_review"
            await session.commit()
            await publish_job_event(
                job_id, "stage_pause", {"stage": "awaiting_transcription_review"}
            )
            return  # STOP here, wait for review

            # Stage 3: Detect OST
            logger.info(f"[{job_id}] Stage 3: Detecting original soundtrack")
            job.status = JobStatus.DETECTING_OST
            job.current_stage = "detecting_ost"
            job.progress_pct = 50
            await session.commit()
            await publish_job_event(job_id, "stage_start", {"stage": "detecting_ost"})

            ost_detection = await detect_ost(video_path, settings.ANTHROPIC_API_KEY)
            job.ost_detection = ost_detection
            job.progress_pct = 60
            job.cost_usd += Decimal("0.05")  # Placeholder cost
            await session.commit()
            await publish_job_event(
                job_id, "stage_complete", {"stage": "detecting_ost", "progress": 60}
            )

            # Stage 4: Translate
            logger.info(f"[{job_id}] Stage 4: Translating content")
            job.status = JobStatus.TRANSLATING
            job.current_stage = "translating"
            job.progress_pct = 70
            await session.commit()
            await publish_job_event(job_id, "stage_start", {"stage": "translating"})

            translation = await translate_content(
                job.transcription,
                ost_detection,
                job.source_language,
                settings.ANTHROPIC_API_KEY,
            )
            job.translation = translation
            job.progress_pct = 80
            job.cost_usd += Decimal("0.1")  # Placeholder cost
            await session.commit()
            await publish_job_event(
                job_id, "stage_complete", {"stage": "translating", "progress": 80}
            )

            # Pause for translation review
            logger.info(f"[{job_id}] Pausing for translation review")
            job.status = JobStatus.AWAITING_TRANSLATION_REVIEW
            job.current_stage = "awaiting_translation_review"
            await session.commit()
            await publish_job_event(
                job_id, "stage_pause", {"stage": "awaiting_translation_review"}
            )
            return  # STOP here, wait for review

            # Stage 5: Export
            logger.info(f"[{job_id}] Stage 5: Exporting to DOCX")
            job.status = JobStatus.EXPORTING
            job.current_stage = "exporting"
            job.progress_pct = 90
            await session.commit()
            await publish_job_event(job_id, "stage_start", {"stage": "exporting"})

            output_path = await create_docx(
                job_id,
                job.video_title,
                job.transcription,
                job.translation,
                job.ost_detection,
                settings.STORAGE_PATH,
            )

            job.output_path = output_path
            job.progress_pct = 100
            job.status = JobStatus.COMPLETED
            job.current_stage = "completed"
            job.completed_at = datetime.utcnow()
            await session.commit()
            await publish_job_event(
                job_id, "stage_complete", {"stage": "exporting", "progress": 100}
            )
            await publish_job_event(job_id, "job_complete", {"job_id": job_id})

            logger.info(f"[{job_id}] Job completed successfully")

        except Exception as e:
            logger.error(f"Pipeline error for {job_id}: {e}", exc_info=True)
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            await session.commit()
            await publish_job_event(job_id, "job_failed", {"error": str(e)})


async def _set_job_failed(job_id: str, error_message: str):
    """Mark job as failed."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

    from app.utils.events import publish_job_event

    engine = create_async_engine(settings.DATABASE_URL, echo=settings.DATABASE_ECHO)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            result = await session.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()

            if job:
                job.status = JobStatus.FAILED
                job.error_message = error_message
                job.completed_at = datetime.utcnow()
                await session.commit()
                await publish_job_event(job_id, "job_failed", {"error": error_message})

        except Exception as e:
            logger.error(f"Error setting job failed for {job_id}: {e}")


@celery_app.task(bind=True, name="resume_after_transcription_review")
def resume_after_transcription_review(self, job_id: str):
    """
    Resume pipeline after transcription review is approved.
    Continues from OST detection stage.
    """
    import asyncio
    import traceback

    logger.info(f"Resuming transcription review for job {job_id}")

    try:
        asyncio.run(_resume_after_transcription_review_async(job_id))
        return {"status": "success", "job_id": job_id}

    except Exception as e:
        logger.error(f"Error resuming transcription review for job {job_id}: {e}\n{traceback.format_exc()}")
        asyncio.run(_set_job_failed(job_id, str(e)))
        raise


async def _resume_after_transcription_review_async(job_id: str):
    """Async resume after transcription review."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

    from app.pipeline.detect_ost import detect_ost
    from app.utils.events import publish_job_event

    engine = create_async_engine(settings.DATABASE_URL, echo=settings.DATABASE_ECHO)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            result = await session.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()

            if not job:
                logger.error(f"Job {job_id} not found")
                return

            # Get video path from metadata
            video_path = (job.metadata_ or {}).get("path") or (job.metadata_ or {}).get("upload_path")
            if not video_path:
                raise ValueError("Video path not found in job metadata")

            # Stage 3: Detect OST
            logger.info(f"[{job_id}] Stage 3: Detecting original soundtrack")
            job.status = JobStatus.DETECTING_OST
            job.current_stage = "detecting_ost"
            job.progress_pct = 50
            await session.commit()
            await publish_job_event(job_id, "stage_start", {"stage": "detecting_ost"})

            ost_detection = await detect_ost(video_path, settings.ANTHROPIC_API_KEY)
            job.ost_detection = ost_detection
            job.progress_pct = 60
            job.cost_usd += Decimal("0.05")
            await session.commit()
            await publish_job_event(
                job_id, "stage_complete", {"stage": "detecting_ost", "progress": 60}
            )

            # Stage 4: Translate
            logger.info(f"[{job_id}] Stage 4: Translating content")
            job.status = JobStatus.TRANSLATING
            job.current_stage = "translating"
            job.progress_pct = 70
            await session.commit()
            await publish_job_event(job_id, "stage_start", {"stage": "translating"})

            from app.pipeline.translate import translate_content

            translation = await translate_content(
                job.transcription,
                ost_detection,
                job.source_language,
                settings.ANTHROPIC_API_KEY,
            )
            job.translation = translation
            job.progress_pct = 80
            job.cost_usd += Decimal("0.1")
            await session.commit()
            await publish_job_event(
                job_id, "stage_complete", {"stage": "translating", "progress": 80}
            )

            # Pause for translation review
            logger.info(f"[{job_id}] Pausing for translation review")
            job.status = JobStatus.AWAITING_TRANSLATION_REVIEW
            job.current_stage = "awaiting_translation_review"
            job.transcription_reviewed_at = datetime.utcnow()
            await session.commit()
            await publish_job_event(
                job_id, "stage_pause", {"stage": "awaiting_translation_review"}
            )

        except Exception as e:
            logger.error(f"Error resuming transcription review for {job_id}: {e}", exc_info=True)
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            await session.commit()
            await publish_job_event(job_id, "job_failed", {"error": str(e)})


@celery_app.task(bind=True, name="resume_after_translation_review")
def resume_after_translation_review(self, job_id: str):
    """
    Resume pipeline after translation review is approved.
    Continues to DOCX export stage.
    """
    import asyncio
    import traceback

    logger.info(f"Resuming translation review for job {job_id}")

    try:
        asyncio.run(_resume_after_translation_review_async(job_id))
        return {"status": "success", "job_id": job_id}

    except Exception as e:
        logger.error(f"Error resuming translation review for job {job_id}: {e}\n{traceback.format_exc()}")
        asyncio.run(_set_job_failed(job_id, str(e)))
        raise


async def _resume_after_translation_review_async(job_id: str):
    """Async resume after translation review."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

    from app.pipeline.export_docx import create_docx
    from app.utils.events import publish_job_event

    engine = create_async_engine(settings.DATABASE_URL, echo=settings.DATABASE_ECHO)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            result = await session.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()

            if not job:
                logger.error(f"Job {job_id} not found")
                return

            # Stage 5: Export
            logger.info(f"[{job_id}] Stage 5: Exporting to DOCX")
            job.status = JobStatus.EXPORTING
            job.current_stage = "exporting"
            job.progress_pct = 90
            await session.commit()
            await publish_job_event(job_id, "stage_start", {"stage": "exporting"})

            output_path = await create_docx(
                job_id,
                job.video_title,
                job.transcription,
                job.translation,
                job.ost_detection,
                settings.STORAGE_PATH,
            )

            job.output_path = output_path
            job.progress_pct = 100
            job.status = JobStatus.COMPLETED
            job.current_stage = "completed"
            job.completed_at = datetime.utcnow()
            job.translation_reviewed_at = datetime.utcnow()
            await session.commit()
            await publish_job_event(
                job_id, "stage_complete", {"stage": "exporting", "progress": 100}
            )
            await publish_job_event(job_id, "job_complete", {"job_id": job_id})

            logger.info(f"[{job_id}] Job completed successfully after translation review")

        except Exception as e:
            logger.error(f"Error resuming translation review for {job_id}: {e}", exc_info=True)
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            await session.commit()
            await publish_job_event(job_id, "job_failed", {"error": str(e)})


def timestamp_to_seconds(timestamp: str) -> float:
    """Convert HH:MM:SS format to seconds."""
    parts = timestamp.split(":")
    hours = int(parts[0])
    minutes = int(parts[1])
    seconds = float(parts[2])
    return hours * 3600 + minutes * 60 + seconds


def filter_segments_by_range(segments: list, start: str, end: str) -> list:
    """
    Filter segments that fall within a time range.

    Args:
        segments: List of segment dicts with 'start', 'end', and content keys
        start: Start timestamp in HH:MM:SS format
        end: End timestamp in HH:MM:SS format

    Returns:
        Filtered list of segments within the time range
    """
    start_seconds = timestamp_to_seconds(start)
    end_seconds = timestamp_to_seconds(end)

    filtered = []
    for segment in segments:
        seg_start = segment.get("start", 0)
        seg_end = segment.get("end", 0)

        # Include segment if it starts before the range ends and ends after the range starts
        if seg_start < end_seconds and seg_end > start_seconds:
            filtered.append(segment)

    return filtered


@celery_app.task(bind=True, name="merge_chunks")
def merge_chunks(self, parent_job_id: str):
    """
    Merge all approved chunks back into parent job and trigger DOCX export.

    Args:
        parent_job_id: UUID of the parent job
    """
    import asyncio
    import traceback

    logger.info(f"Starting chunk merge for parent job {parent_job_id}")

    try:
        asyncio.run(_merge_chunks_async(parent_job_id))
        return {"status": "success", "parent_job_id": parent_job_id}

    except Exception as e:
        logger.error(f"Error merging chunks for {parent_job_id}: {e}\n{traceback.format_exc()}")
        asyncio.run(_set_job_failed(parent_job_id, str(e)))
        raise


async def _merge_chunks_async(parent_job_id: str):
    """Async chunk merging logic."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

    from app.pipeline.export_docx import create_docx
    from app.utils.events import publish_job_event

    engine = create_async_engine(settings.DATABASE_URL, echo=settings.DATABASE_ECHO)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            # Get parent job
            result = await session.execute(select(Job).where(Job.id == parent_job_id))
            parent_job = result.scalar_one_or_none()

            if not parent_job:
                logger.error(f"Parent job {parent_job_id} not found")
                return

            if parent_job.is_parent != "Y":
                raise ValueError(f"Job {parent_job_id} is not a parent job")

            logger.info(f"[{parent_job_id}] Merging chunks for parent job")

            # Get all child jobs ordered by chunk_index
            result = await session.execute(
                select(Job)
                .where(Job.parent_job_id == parent_job_id)
                .order_by(Job.chunk_index)
            )
            child_jobs = result.scalars().all()

            if not child_jobs:
                raise ValueError(f"No child jobs found for parent {parent_job_id}")

            logger.info(f"[{parent_job_id}] Found {len(child_jobs)} child jobs")

            # Validate all chunks are completed
            for child in child_jobs:
                if child.status != JobStatus.COMPLETED:
                    raise ValueError(
                        f"Child job {child.id} is not completed (status: {child.status})"
                    )

            # Merge transcription segments
            merged_transcription = {"segments": []}
            for child in child_jobs:
                if child.transcription and "segments" in child.transcription:
                    merged_transcription["segments"].extend(child.transcription["segments"])

            # Merge translation segments
            merged_translation = {"segments": []}
            for child in child_jobs:
                if child.translation and "segments" in child.translation:
                    merged_translation["segments"].extend(child.translation["segments"])

            # Copy any summary from last child
            if child_jobs[-1].translation and "summary" in child_jobs[-1].translation:
                merged_translation["summary"] = child_jobs[-1].translation["summary"]

            # Update parent job with merged content
            parent_job.transcription = merged_transcription
            parent_job.translation = merged_translation
            parent_job.status = JobStatus.EXPORTING
            parent_job.current_stage = "exporting"
            parent_job.progress_pct = 90
            await session.commit()

            logger.info(f"[{parent_job_id}] Merged {len(child_jobs)} chunks")
            await publish_job_event(parent_job_id, "chunks_merged", {"chunk_count": len(child_jobs)})

            # Stage 5: Export to DOCX
            logger.info(f"[{parent_job_id}] Stage 5: Exporting merged content to DOCX")

            output_path = await create_docx(
                parent_job_id,
                parent_job.video_title,
                parent_job.transcription,
                parent_job.translation,
                parent_job.ost_detection,
                settings.STORAGE_PATH,
            )

            parent_job.output_path = output_path
            parent_job.progress_pct = 100
            parent_job.status = JobStatus.COMPLETED
            parent_job.current_stage = "completed"
            parent_job.completed_at = datetime.utcnow()
            await session.commit()

            logger.info(f"[{parent_job_id}] Chunk merge and export completed successfully")
            await publish_job_event(parent_job_id, "job_complete", {"job_id": parent_job_id})

        except Exception as e:
            logger.error(f"Error merging chunks for {parent_job_id}: {e}", exc_info=True)
            parent_job.status = JobStatus.FAILED
            parent_job.error_message = f"Chunk merge failed: {str(e)}"
            parent_job.completed_at = datetime.utcnow()
            await session.commit()
            await publish_job_event(parent_job_id, "job_failed", {"error": str(e)})
