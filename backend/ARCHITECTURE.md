# VoxTranslate Backend Architecture

## Overview

VoxTranslate is a production-quality video translation pipeline backend built with FastAPI, Celery, and PostgreSQL. It processes videos through a 5-stage pipeline with real-time progress tracking via Server-Sent Events (SSE).

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Applications                       │
│                    (Web Frontend, Mobile, etc.)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI Web Server (Port 8000)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Routes:                                                  │  │
│  │  • POST   /api/jobs          - Create job                │  │
│  │  • GET    /api/jobs          - List jobs                 │  │
│  │  • GET    /api/jobs/{id}     - Get job details          │  │
│  │  • GET    /api/jobs/{id}/events  - SSE stream           │  │
│  │  • DELETE /api/jobs/{id}     - Cancel job                │  │
│  │  • POST   /api/jobs/{id}/retry   - Retry                │  │
│  │  • POST   /api/batch         - Batch jobs                │  │
│  │  • GET    /api/stats         - Statistics                │  │
│  │  • GET    /api/stats/health  - Health check             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Dependencies: SQLAlchemy async ORM, Pydantic validation        │
└────────────┬─────────────────────────┬──────────────────────────┘
             │                         │
             │ SQL Queries             │ Event Publishing
             ▼                         ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   PostgreSQL Database    │  │   Redis Pub/Sub          │
│                          │  │  (Event Channels)        │
│ Tables:                  │  │                          │
│  • jobs                  │  │ Channels:                │
│  • users                 │  │  • job:$job_id           │
│                          │  │                          │
│ Async Driver: asyncpg    │  │ Async Client: redis.py   │
└──────────────────────────┘  └──────────────────────────┘
                                      ▲
                                      │ Job Queue
                                      │ Task Results
                                      ▼
                            ┌──────────────────────────┐
                            │   Redis Broker           │
                            │  (Celery Message Queue)  │
                            │                          │
                            │ Databases:               │
                            │  • 0: Broker messages    │
                            │  • 1: Task results       │
                            └──────────────────────────┘
                                      ▲
                                      │ Task Dispatch
                                      │ Task Results
                                      ▼
┌────────────────────────────────────────────────────────────────┐
│            Celery Worker Pool (4 concurrent workers)           │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  process_video(job_id) - Main Orchestrator Task          │ │
│  │                                                            │ │
│  │  Stage 1: Download        [yt-dlp] → MP4 Video          │ │
│  │           ├─ Download video (best 720p)                  │ │
│  │           ├─ Extract metadata                            │ │
│  │           └─ Publish progress event                      │ │
│  │                                                            │ │
│  │  Stage 2: Transcribe      [ElevenLabs] → Segments       │ │
│  │           ├─ Extract audio (FFmpeg)                      │ │
│  │           ├─ Call ElevenLabs Scribe v2 API              │ │
│  │           ├─ Parse diarized output                       │ │
│  │           └─ Publish progress event                      │ │
│  │                                                            │ │
│  │  Stage 3: Detect OST      [Claude Vision] → Items       │ │
│  │           ├─ Extract frames (3-second intervals)         │ │
│  │           ├─ Batch process 10 frames per API call       │ │
│  │           ├─ Claude Vision analysis                      │ │
│  │           └─ Publish progress event                      │ │
│  │                                                            │ │
│  │  Stage 4: Translate       [Claude API] → Segments       │ │
│  │           ├─ Build translation prompt                    │ │
│  │           ├─ Single API call with full transcript        │ │
│  │           ├─ Parse JSON response                         │ │
│  │           └─ Publish progress event                      │ │
│  │                                                            │ │
│  │  Stage 5: Export          [python-docx] → DOCX          │ │
│  │           ├─ Create 4-column table                       │ │
│  │           ├─ Format per Lofte Studios spec               │ │
│  │           ├─ Save to storage                             │ │
│  │           └─ Publish completion event                    │ │
│  │                                                            │ │
│  │  Each stage:                                             │ │
│  │   • Updates job status in database                       │ │
│  │   • Publishes event to Redis pub/sub                     │ │
│  │   • Logs progress and errors                             │ │
│  │   • Handles timeouts and retries                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  External API Calls:                                           │
│   • ElevenLabs: Scribe v2 transcription API                    │
│   • Claude Vision: Batch image analysis for OST               │
│   • Claude 3.5 Sonnet: Translation and context generation     │
│   • YouTube-dl: Video metadata and download                   │
└────────────────────────────────────────────────────────────────┘
                                      ▲
                                      │
                                      │ File Storage
                                      ▼
                            ┌──────────────────────────┐
                            │   File System Storage    │
                            │                          │
                            │ Directories:             │
                            │  • /data/voxtranslate/   │
                            │    ├─ DOCX outputs      │
                            │    └─ Metadata files    │
                            │  • /tmp/voxtranslate/    │
                            │    ├─ Video files       │
                            │    ├─ Audio files       │
                            │    └─ Frame images      │
                            └──────────────────────────┘
```

## Data Flow

### Job Creation Flow

```
1. Client POST /api/jobs {youtube_url, language_hint, enable_ost}
   ↓
2. FastAPI validates request with Pydantic schema
   ↓
3. Create Job record in PostgreSQL (status=QUEUED)
   ↓
4. Dispatch Celery task: process_video.delay(job_id)
   ↓
5. Return JobResponse with job_id to client
   ↓
6. Client polls /api/jobs/{id} or listens to /api/jobs/{id}/events (SSE)
```

### Real-Time Event Flow

```
1. Worker publishes event: await publish_job_event(job_id, "stage_start", {...})
   ↓
2. Event sent to Redis channel: job:{job_id}
   ↓
3. Client SSE stream listens on /api/jobs/{id}/events
   ↓
4. SSE connection subscribes to Redis channel job:{job_id}
   ↓
5. Redis message received → formatted as SSE data frame
   ↓
6. Client JavaScript receives event and updates UI
```

### Database Schema

#### Job Table
```sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY,
    youtube_url VARCHAR(2048) NOT NULL,
    video_title VARCHAR(512),
    source_language VARCHAR(10) DEFAULT 'en',
    duration_seconds INT,
    size_bytes INT,
    status ENUM (queued, downloading, transcribing, detecting_ost, translating, exporting, completed, failed, cancelled),
    current_stage VARCHAR(50),
    progress_pct INT DEFAULT 0,
    submitted_by VARCHAR(255) DEFAULT 'anonymous',
    submitted_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    output_path VARCHAR(2048),
    error_message TEXT,
    metadata_ JSONB,           -- Video metadata
    transcription JSONB,        -- Transcript with segments
    translation JSONB,          -- Translation with notes
    ost_detection JSONB,        -- OST analysis
    cost_usd NUMERIC(10, 4),
    updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    INDEX (status),
    INDEX (created_at),
    INDEX (submitted_at)
);
```

## Pipeline Details

### Stage 1: Download
- Uses yt-dlp for YouTube video extraction
- Downloads best quality video ≤ 720p
- Extracts metadata from .info.json
- Stores in /tmp/voxtranslate/
- Timeout: 3600 seconds (configurable)

### Stage 2: Transcribe
- Extracts audio using FFmpeg
- Calls ElevenLabs Scribe v2 API
- Parameters: model_id="scribe_v1", diarize=true, timestamps_granularity="word"
- Returns diarized transcript with timestamps
- Segments output into 1-minute blocks
- Cost: ~$0.01 per job (placeholder)

### Stage 3: Detect OST
- Extracts frames at 3-second intervals using FFmpeg
- Batch processes 10 frames per Claude Vision API call
- Detects 8 OST types: background_music, ambient_sound, voiceover, dialogue, sound_effects, silence, music_transition, unknown
- Returns JSON with timestamp, type, confidence, visual indicators
- Cost: ~$0.05 per job (estimated)

### Stage 4: Translate
- Single Claude API call with full transcript
- Improved prompt that:
  - Resolves speaker names from context
  - Generates detailed contextual notes (term + explanation)
  - Flags violence in notes (not inline)
  - Preserves fillers and hesitations (um, uh, like)
  - Uses regular dashes, not em dashes
- Returns: video_summary, meta_translations, segments with notes
- Cost: ~$0.10 per job (estimated)

### Stage 5: Export
- Creates DOCX in Lofte Studios format
- 4-column table: Timestamp | Translation | OST | Notes
- Header with video metadata
- Calibri 9pt font, landscape orientation
- Blue-gray header shading (D9E2F3)
- Timestamp format: 00.00.00 - 00.01.00 (dots not colons)
- Speaker names bold, notes with bold term + explanation

## Key Features

### Scalability
- Horizontal scaling: Add more Celery workers
- Database: Connection pooling with asyncpg
- Redis: Used for distributed message queue
- Stateless API servers: Can run multiple instances
- Worker pool: Configurable concurrency per worker

### Reliability
- Async/await for non-blocking I/O
- Connection pooling and retries
- Task acknowledgment and replay
- Error logging and recovery
- Database transactions for consistency
- Graceful shutdown handling

### Real-Time Updates
- Server-Sent Events (SSE) for live progress
- Redis pub/sub for message distribution
- Async event generation
- Automatic reconnection handling
- Event history in database

### Security
- Input validation with Pydantic
- SQL injection prevention (parameterized queries)
- CORS configuration
- Environment variable secrets management
- No hardcoded credentials
- Request logging
- Error message sanitization

### Performance
- Async database operations with asyncpg
- Async HTTP requests with httpx
- Task batching (10 frames per API call)
- Connection pooling
- Database query optimization with indexes
- Redis caching (when needed)

## API Response Models

### JobResponse
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "youtube_url": "https://youtube.com/watch?v=...",
  "video_title": "Example Video",
  "source_language": "en",
  "duration_seconds": 600,
  "status": "processing",
  "current_stage": "translating",
  "progress_pct": 75,
  "submitted_by": "user",
  "submitted_at": "2024-03-20T10:30:00Z",
  "started_at": "2024-03-20T10:31:00Z",
  "completed_at": null,
  "output_path": "/data/voxtranslate/job123.docx",
  "error_message": null,
  "cost_usd": "0.1600",
  "created_at": "2024-03-20T10:30:00Z",
  "updated_at": "2024-03-20T10:35:00Z",
  "elapsed_time": 300.5
}
```

### StatsResponse
```json
{
  "today_count": 42,
  "week_count": 287,
  "total_count": 5234,
  "active_jobs": 12,
  "queued_jobs": 8,
  "failed_jobs": 2,
  "avg_time_seconds": 450.3,
  "cost_today": "23.45",
  "cost_week": "156.78",
  "cost_total": "4234.56"
}
```

## Configuration

All settings use environment variables with Pydantic Settings validation:

```python
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
DATABASE_ECHO=false

# Redis/Celery
REDIS_URL=redis://host:6379/0
CELERY_BROKER_URL=redis://host:6379/0
CELERY_RESULT_BACKEND=redis://host:6379/1

# APIs
ELEVENLABS_API_KEY=xxx
ANTHROPIC_API_KEY=xxx

# Storage
STORAGE_PATH=/data/voxtranslate
TEMP_PATH=/tmp/voxtranslate

# CORS
CORS_ORIGINS=["http://localhost:3000"]

# Security
DEBUG=false
SECRET_KEY=<strong-key>

# Feature Flags
ENABLE_VIDEO_DOWNLOAD=true
ENABLE_TRANSCRIPTION=true
ENABLE_OST_DETECTION=true
ENABLE_TRANSLATION=true
ENABLE_EXPORT=true

# Timeouts
DOWNLOAD_TIMEOUT=3600
TRANSCRIPTION_TIMEOUT=3600
TRANSLATION_TIMEOUT=1800
```

## Monitoring & Observability

### Logging
- All operations logged to stdout (Docker-friendly)
- Log levels: DEBUG, INFO, WARNING, ERROR
- Structured logging with context (job_id, stage, duration)

### Health Checks
- `/health` endpoint for basic checks
- `/api/stats/health` for detailed system health
- Database connectivity test
- Redis connectivity test
- Celery worker count

### Metrics (when Prometheus added)
- Request latency
- Job processing time
- API error rates
- Queue depth
- Worker utilization

## Development Workflow

1. **Local Setup**: Docker Compose with hot-reload
2. **Code Changes**: Edit Python files, auto-reloaded
3. **Testing**: pytest with async fixtures
4. **Linting**: black, flake8, isort, pylint, mypy
5. **Type Checking**: mypy for type safety
6. **Deployment**: Docker image → Registry → Kubernetes

## Dependencies

**Core**:
- fastapi: Web framework
- uvicorn: ASGI server
- celery: Task queue
- redis: Message broker
- sqlalchemy: ORM
- asyncpg: Async PostgreSQL driver
- pydantic: Data validation

**External APIs**:
- httpx: Async HTTP client
- yt-dlp: YouTube downloader
- python-docx: DOCX generation

**Features**:
- sse-starlette: Server-Sent Events
- passlib: Password hashing
- python-jose: JWT tokens

## Deployment Options

1. **Docker Compose**: Development and small deployments
2. **Kubernetes**: Production with auto-scaling
3. **Systemd**: Traditional server deployment
4. **AWS ECS/Fargate**: Serverless containers
5. **Google Cloud Run**: Managed containers

See DEPLOYMENT.md for detailed instructions.
