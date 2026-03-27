"""
Live stream routes for VoxTranslate.
Add to app/routes/ and register in main.py.

POST /api/live/start   — create a live job and start the Celery task
POST /api/live/stop    — set job.status = CANCELLED to stop the loop
GET  /api/live/{id}    — get current segments for a live job
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models import Job, JobStatus
from app.pipeline.live_tasks import process_live_stream

router = APIRouter(prefix="/api/live", tags=["live"])


class StartLiveRequest(BaseModel):
    youtube_url: str
    source_language: str = "pt"       # ElevenLabs language code
    submitted_by: str = "anonymous"


class StopLiveRequest(BaseModel):
    job_id: str


@router.post("/start")
async def start_live_stream(req: StartLiveRequest, db: AsyncSession = Depends(get_db)):
    """Create a live stream job and kick off the Celery task."""
    job = Job(
        id=uuid.uuid4(),
        youtube_url=req.youtube_url,
        source_language=req.source_language,
        submitted_by=req.submitted_by,
        status=JobStatus.QUEUED,
        current_stage="queued",
        transcription={"segments": []},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Kick off Celery task
    process_live_stream.delay(str(job.id))

    return {
        "job_id": str(job.id),
        "status": job.status,
        "message": "Live stream job started",
    }


@router.post("/stop")
async def stop_live_stream(req: StopLiveRequest, db: AsyncSession = Depends(get_db)):
    """Cancel a running live stream job."""
    result = await db.execute(select(Job).where(Job.id == req.job_id))
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = JobStatus.CANCELLED
    job.completed_at = datetime.utcnow()
    await db.commit()

    return {"job_id": req.job_id, "status": "cancelled"}


@router.get("/{job_id}")
async def get_live_job(job_id: str, db: AsyncSession = Depends(get_db)):
    """Get current state of a live stream job including all segments so far."""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    segments = (job.transcription or {}).get("segments", [])

    return {
        "job_id": str(job.id),
        "status": job.status,
        "current_stage": job.current_stage,
        "youtube_url": job.youtube_url,
        "source_language": job.source_language,
        "segment_count": len(segments),
        "segments": segments,
        "started_at": job.started_at,
        "updated_at": job.updated_at,
    }
