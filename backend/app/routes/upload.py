"""Upload route — accepts direct video file uploads, skips yt-dlp download."""

import logging
import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import Job, JobStatus
from app.pipeline.tasks import celery_app

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_EXTENSIONS = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v", ".mp3", ".wav", ".m4a"}
MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024  # 2GB


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_video(
    file: UploadFile = File(...),
    language_hint: str = Form(""),
    enable_ost: bool = Form(True),
    tag_audio_events: bool = Form(True),
    include_subtitles: bool = Form(False),
    no_verbatim: bool = Form(False),
    diarize: bool = Form(True),
    time_ranges: str = Form(None),
    session: AsyncSession = Depends(get_session),
):
    """
    Upload a video or audio file directly.
    Skips the yt-dlp download stage and goes straight to transcription.
    """
    # Validate file extension
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Save file to temp storage
    job_id = uuid.uuid4()
    temp_dir = Path(settings.STORAGE_PATH) / "uploads" / str(job_id)
    temp_dir.mkdir(parents=True, exist_ok=True)
    video_path = temp_dir / f"upload{ext}"

    try:
        with open(video_path, "wb") as f:
            total = 0
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total += len(chunk)
                if total > MAX_FILE_SIZE:
                    raise HTTPException(status_code=413, detail="File too large (max 2GB)")
                f.write(chunk)
    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    file_size = os.path.getsize(video_path)

    # Parse time ranges if provided
    parsed_time_ranges = None
    if time_ranges:
        import json
        try:
            parsed_time_ranges = json.loads(time_ranges)
        except Exception:
            pass

    # Create job record
    job = Job(
        id=job_id,
        youtube_url=f"upload://{file.filename}",
        video_title=Path(file.filename or "upload").stem,
        source_language=language_hint or "auto",
        status=JobStatus.QUEUED,
        current_stage="queued",
        progress_pct=0,
        submitted_by="user",
        size_bytes=file_size,
        metadata_={
            "upload_path": str(video_path),
            "original_filename": file.filename,
            "tag_audio_events": tag_audio_events,
            "include_subtitles": include_subtitles,
            "no_verbatim": no_verbatim,
            "diarize": diarize,
            "enable_ost": enable_ost,
        },
        time_ranges=parsed_time_ranges,
    )

    session.add(job)
    await session.commit()
    await session.refresh(job)

    # Dispatch Celery task — use upload-specific task that skips download
    celery_app.send_task("process_uploaded_video", args=[str(job.id)])
    logger.info(f"Created upload job {job.id} for file {file.filename}")

    return {
        "id": str(job.id),
        "status": job.status,
        "video_title": job.video_title,
        "size_bytes": file_size,
        "message": "File uploaded successfully. Processing started.",
    }
