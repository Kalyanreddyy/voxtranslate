"""SQLAlchemy ORM models for VoxTranslate."""

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    JSON,
    TIMESTAMP,
    Column,
    Enum as SQLEnum,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class JobStatus(str, Enum):
    """Job status enumeration."""

    QUEUED = "queued"
    DOWNLOADING = "downloading"
    TRANSCRIBING = "transcribing"
    AWAITING_TRANSCRIPTION_REVIEW = "awaiting_transcription_review"
    DETECTING_OST = "detecting_ost"
    TRANSLATING = "translating"
    AWAITING_TRANSLATION_REVIEW = "awaiting_translation_review"
    EXPORTING = "exporting"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Job(Base):
    """Video translation job model."""

    __tablename__ = "jobs"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Input
    youtube_url = Column(String(2048), nullable=False)
    video_title = Column(String(512), nullable=True)
    source_language = Column(String(10), nullable=False, default="en")

    # Video metadata
    duration_seconds = Column(Integer, nullable=True)
    size_bytes = Column(Integer, nullable=True)

    # Status tracking
    status = Column(
        SQLEnum(JobStatus),
        nullable=False,
        default=JobStatus.QUEUED,
        index=True,
    )
    current_stage = Column(String(50), nullable=True)
    progress_pct = Column(Integer, nullable=False, default=0)

    # Audit
    submitted_by = Column(String(255), nullable=True, default="anonymous")
    submitted_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    started_at = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Output
    output_path = Column(String(2048), nullable=True)
    error_message = Column(Text, nullable=True)

    # Content data (JSON)
    metadata_ = Column(JSON, nullable=True)
    transcription = Column(JSON, nullable=True)
    translation = Column(JSON, nullable=True)
    ost_detection = Column(JSON, nullable=True)

    # Cost tracking
    cost_usd = Column(Numeric(10, 4), nullable=False, default=Decimal("0.0"))

    # Review workflow
    assigned_to = Column(String(255), nullable=True)
    transcription_reviewed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    translation_reviewed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    reviewer_notes = Column(Text, nullable=True)

    # Timestamp ranges (JSON array of {start, end} objects)
    time_ranges = Column(JSON, nullable=True)

    # Chunking support
    is_parent = Column(String(1), nullable=False, default="N")
    parent_job_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    chunk_index = Column(Integer, nullable=True)
    chunk_start = Column(String(12), nullable=True)
    chunk_end = Column(String(12), nullable=True)
    chunk_count = Column(Integer, nullable=True)
    chunks_completed = Column(Integer, nullable=False, default=0)

    # Timestamps
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<Job {self.id} status={self.status}>"


class UserRole(str, Enum):
    """User role enumeration."""

    ADMIN = "admin"
    LINGUIST = "linguist"


class User(Base):
    """User model for future authentication."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    email = Column(String(255), unique=True, nullable=True)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.ADMIN)
    is_active = Column(String(1), nullable=False, default="Y")
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    def __repr__(self) -> str:
        return f"<User {self.username}>"


class JobAssignment(Base):
    """Assignment of jobs to linguists for review."""

    __tablename__ = "job_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    stage = Column(String(50), nullable=False)  # 'transcription' or 'translation'
    assigned_at = Column(TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<JobAssignment job={self.job_id} user={self.user_id} stage={self.stage}>"
