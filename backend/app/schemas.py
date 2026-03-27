"""Pydantic schemas for request/response validation."""

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


class TimeRange(BaseModel):
    """A time range within a video."""

    start: str = Field(description="Start timestamp e.g. '00:02:15'")
    end: str = Field(description="End timestamp e.g. '00:07:30'")


class JobCreate(BaseModel):
    """Schema for creating a new job."""

    youtube_url: HttpUrl
    language_hint: Optional[str] = Field(None, description="Source language code (e.g., 'en')")
    enable_ost: bool = Field(True, description="Enable original soundtrack detection")
    max_duration_seconds: Optional[int] = Field(300, description="Maximum video duration in seconds")
    assign_to: Optional[str] = Field(None, description="Username to assign job to (optional)")
    time_ranges: Optional[list[TimeRange]] = Field(
        None, description="Specific portions to process. If None, process full video."
    )


class JobUpdate(BaseModel):
    """Schema for updating a job."""

    source_language: Optional[str] = None


class JobResponse(BaseModel):
    """Schema for job response."""

    id: UUID
    youtube_url: str
    video_title: Optional[str] = None
    source_language: str = "en"
    duration_seconds: Optional[int] = None
    status: str
    current_stage: Optional[str] = None
    progress_pct: int = 0
    submitted_by: Optional[str] = None
    submitted_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    output_path: Optional[str] = None
    error_message: Optional[str] = None
    assigned_to: Optional[str] = None
    transcription_reviewed_at: Optional[datetime] = None
    translation_reviewed_at: Optional[datetime] = None
    reviewer_notes: Optional[str] = None
    metadata_: Optional[dict[str, Any]] = None
    transcription: Optional[dict[str, Any]] = None
    translation: Optional[dict[str, Any]] = None
    ost_detection: Optional[dict[str, Any]] = None
    cost_usd: float = 0.0
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    time_ranges: Optional[list[dict[str, str]]] = None
    is_parent: Optional[str] = None
    parent_job_id: Optional[UUID] = None
    chunk_index: Optional[int] = None
    chunk_start: Optional[str] = None
    chunk_end: Optional[str] = None
    chunk_count: Optional[int] = None
    chunks_completed: Optional[int] = None

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    """Schema for job list response with pagination."""

    items: list[JobResponse]
    total: int = Field(description="Total number of jobs")
    page: int = Field(description="Current page number")
    page_size: int = Field(description="Items per page")
    pages: int = Field(description="Total number of pages")


class BatchCreate(BaseModel):
    """Schema for batch job creation."""

    urls: list[HttpUrl] = Field(min_items=1, max_items=100)
    language_hint: Optional[str] = None
    enable_ost: bool = True


class BatchResponse(BaseModel):
    """Schema for batch job creation response."""

    job_ids: list[UUID]
    count: int


class StatsResponse(BaseModel):
    """Schema for dashboard statistics."""

    today_count: int = Field(default=0, description="Jobs completed today")
    week_count: int = Field(default=0, description="Jobs completed this week")
    total_count: int = Field(default=0, description="Total jobs completed")
    active_jobs: int = Field(default=0, description="Currently processing jobs")
    queued_jobs: int = Field(default=0, description="Jobs in queue")
    failed_jobs: int = Field(default=0, description="Failed jobs")
    avg_time_seconds: Optional[float] = Field(
        default=None, description="Average processing time in seconds"
    )
    cost_today: float = Field(default=0.0, description="API costs today")
    cost_week: float = Field(default=0.0, description="API costs this week")
    cost_total: float = Field(default=0.0, description="Total API costs")


class HealthResponse(BaseModel):
    """Schema for health check response."""

    status: str = Field(description="Overall system status")
    database: str = Field(description="Database connection status")
    redis: str = Field(description="Redis connection status")
    workers_active: int = Field(description="Number of active Celery workers")
    timestamp: datetime = Field(description="Health check timestamp")


class ErrorResponse(BaseModel):
    """Schema for error responses."""

    error: str = Field(description="Error message")
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class TranscriptionSegment(BaseModel):
    """Single segment of transcription."""

    start: float = Field(description="Start time in seconds")
    end: float = Field(description="End time in seconds")
    text: str = Field(description="Transcribed text")


class TranscriptionReviewRequest(BaseModel):
    """Schema for transcription review submission."""

    segments: list[TranscriptionSegment] = Field(description="Edited transcription segments")
    reviewer_notes: Optional[str] = Field(None, description="Optional review notes")


class TranslationSegment(BaseModel):
    """Single segment of translation."""

    start: float = Field(description="Start time in seconds")
    end: float = Field(description="End time in seconds")
    translation: str = Field(description="Translated text")


class TranslationReviewRequest(BaseModel):
    """Schema for translation review submission."""

    segments: list[TranslationSegment] = Field(description="Edited translation segments")
    summary: Optional[str] = Field(None, description="Translation summary")
    reviewer_notes: Optional[str] = Field(None, description="Optional review notes")


class JobAssignmentResponse(BaseModel):
    """Schema for job assignment response."""

    id: UUID
    job_id: UUID
    user_id: UUID
    stage: str
    assigned_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    """Schema for creating a new user."""

    username: str = Field(description="Username")
    password: str = Field(description="Password")
    display_name: Optional[str] = Field(None, description="Display name")
    email: Optional[str] = Field(None, description="Email address")
    role: str = Field("admin", description="User role: admin or linguist")


class UserResponse(BaseModel):
    """Schema for user response."""

    id: UUID
    username: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    is_active: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChunkDefinition(BaseModel):
    """Definition of a chunk for splitting."""

    start: str = Field(description="Chunk start timestamp")
    end: str = Field(description="Chunk end timestamp")
    assign_to: Optional[str] = Field(None, description="Linguist to assign this chunk to")


class SplitRequest(BaseModel):
    """Request to split a job into chunks."""

    chunks: list[ChunkDefinition]


class ChunkResponse(BaseModel):
    """Response for a chunk job."""

    chunk_index: int
    chunk_start: str
    chunk_end: str
    assigned_to: Optional[str]
    status: str
    job_id: UUID
