"""
Live stream Celery task for VoxTranslate.
Add this to tasks.py or import it alongside.

Usage:
    process_live_stream.delay(job_id)
"""

import asyncio
import logging
from datetime import datetime

from celery import Celery
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import Job, JobStatus

logger = logging.getLogger(__name__)

celery_app = Celery(
    "voxtranslate",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)


@celery_app.task(bind=True, name="process_live_stream")
def process_live_stream(self, job_id: str):
    """
    Celery task: transcribes a YouTube live stream in real-time.
    Segments are appended to job.transcription as they arrive.
    Set job.status = CANCELLED to stop the loop.
    """
    asyncio.run(_process_live_stream_async(job_id))


async def _process_live_stream_async(job_id: str):
    from sqlalchemy import select

    from app.pipeline.live_stream import is_live_stream, stream_live_transcription
    from app.utils.events import publish_job_event

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stop_event = asyncio.Event()

    async with async_session() as session:
        result = await session.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()

        if not job:
            logger.error(f"Job {job_id} not found")
            return

        # Validate it's actually a live stream
        try:
            live = await is_live_stream(job.youtube_url)
            if not live:
                job.status = JobStatus.FAILED
                job.error_message = "URL is not a live stream"
                await session.commit()
                return
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = f"Failed to check live stream: {e}"
            await session.commit()
            return

        job.status = JobStatus.TRANSCRIBING
        job.current_stage = "live_streaming"
        job.started_at = datetime.utcnow()
        job.transcription = {"segments": []}
        await session.commit()
        await publish_job_event(job_id, "stage_start", {"stage": "live_streaming"})

        async def on_segment(segment: dict):
            """Called after each chunk is transcribed+translated."""
            async with async_session() as inner_session:
                r = await inner_session.execute(select(Job).where(Job.id == job_id))
                j = r.scalar_one_or_none()

                if not j:
                    stop_event.set()
                    return

                # Check if cancelled from outside
                if j.status == JobStatus.CANCELLED:
                    stop_event.set()
                    return

                # Append segment to transcription
                if not j.transcription:
                    j.transcription = {"segments": []}
                j.transcription["segments"].append(segment)
                j.updated_at = datetime.utcnow()
                await inner_session.commit()

                # Emit SSE event so frontend updates live
                await publish_job_event(
                    job_id,
                    "live_segment",
                    {
                        "chunk_index": segment["chunk_index"],
                        "transcript": segment["transcript"],
                        "translation": segment.get("translation"),
                    },
                )

        try:
            await stream_live_transcription(
                youtube_url=job.youtube_url,
                elevenlabs_api_key=settings.ELEVENLABS_API_KEY,
                anthropic_api_key=settings.ANTHROPIC_API_KEY,
                source_language=job.source_language,          # e.g. 'pt'
                source_language_label="Brazilian Portuguese",  # for Claude prompt
                target_language="English",
                translate=True,
                on_segment=on_segment,
                stop_event=stop_event,
            )
        except Exception as e:
            logger.error(f"Live stream error for job {job_id}: {e}")
            async with async_session() as err_session:
                r = await err_session.execute(select(Job).where(Job.id == job_id))
                j = r.scalar_one_or_none()
                if j:
                    j.status = JobStatus.FAILED
                    j.error_message = str(e)
                    j.completed_at = datetime.utcnow()
                    await err_session.commit()
            await publish_job_event(job_id, "job_failed", {"error": str(e)})
            return

        # Clean finish (stop_event set from outside = cancelled)
        async with async_session() as done_session:
            r = await done_session.execute(select(Job).where(Job.id == job_id))
            j = r.scalar_one_or_none()
            if j and j.status != JobStatus.FAILED:
                j.status = JobStatus.COMPLETED
                j.current_stage = "completed"
                j.completed_at = datetime.utcnow()
                await done_session.commit()
                await publish_job_event(job_id, "job_complete", {"job_id": job_id})
