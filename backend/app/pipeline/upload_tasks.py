"""
Celery task for processing uploaded video files.
Skips Stage 1 (download) since the file is already on disk.
Add this to the existing tasks.py or import alongside it.
"""

import asyncio
import logging
import traceback
from datetime import datetime

from app.config import settings
from app.models import Job, JobStatus
from app.pipeline.tasks import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="process_uploaded_video")
def process_uploaded_video(self, job_id: str):
    """
    Pipeline for uploaded video files.
    Starts directly at Stage 2 (transcription) — no download needed.
    """
    logger.info(f"Starting uploaded video processing for job {job_id}")
    try:
        asyncio.run(_process_uploaded_video_async(job_id))
        return {"status": "success", "job_id": job_id}
    except Exception as e:
        logger.error(f"Pipeline error for job {job_id}: {e}\n{traceback.format_exc()}")
        asyncio.run(_set_upload_job_failed(job_id, str(e)))
        raise


async def _process_uploaded_video_async(job_id: str):
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from app.pipeline.detect_ost import detect_ost
    from app.pipeline.download import trim_video
    from pathlib import Path
    from app.pipeline.export_docx import create_docx
    from app.pipeline.transcribe import transcribe_video
    from app.pipeline.translate import translate_content
    from app.utils.events import publish_job_event

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            result = await session.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()

            if not job:
                logger.error(f"Job {job_id} not found")
                return

            # Get uploaded file path from metadata
            video_path = (job.metadata_ or {}).get("upload_path")
            if not video_path:
                raise ValueError("Upload path not found in job metadata")

            meta = job.metadata_ or {}

            job.started_at = datetime.utcnow()

            # Handle time ranges if specified
            if job.time_ranges:
                logger.info(f"[{job_id}] Trimming to specified time ranges")
                video_path = await trim_video(video_path, job.time_ranges, str(Path(video_path).parent))

            # Stage 2: Transcribe
            logger.info(f"[{job_id}] Stage 2: Transcribing audio")
            job.status = JobStatus.TRANSCRIBING
            job.current_stage = "transcribing"
            job.progress_pct = 30
            await session.commit()
            await publish_job_event(job_id, "stage_start", {"stage": "transcribing"})

            transcription = await transcribe_video(
                video_path,
                settings.ELEVENLABS_API_KEY,
                language_code=job.source_language if job.source_language not in ("auto", "") else "",
                tag_audio_events=meta.get("tag_audio_events", True),
                diarize=meta.get("diarize", True),
                include_subtitles=meta.get("include_subtitles", False),
                no_verbatim=meta.get("no_verbatim", False),
            )
            job.transcription = transcription
            job.progress_pct = 40
            await session.commit()
            await publish_job_event(job_id, "stage_complete", {"stage": "transcribing", "progress": 40})

            # Pause for transcription review
            job.status = JobStatus.AWAITING_TRANSCRIPTION_REVIEW
            job.current_stage = "awaiting_transcription_review"
            await session.commit()
            await publish_job_event(job_id, "stage_pause", {"stage": "awaiting_transcription_review"})
            return  # Wait for review

        except Exception as e:
            logger.error(f"Upload pipeline error for {job_id}: {e}", exc_info=True)
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            await session.commit()
            await publish_job_event(job_id, "job_failed", {"error": str(e)})


async def _set_upload_job_failed(job_id: str, error_message: str):
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from app.utils.events import publish_job_event

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
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
            logger.error(f"Error setting upload job failed for {job_id}: {e}")
