# VoxTranslate Backend

A production-quality FastAPI backend for video translation with Celery workers.

## Architecture

- **FastAPI** - Async REST API
- **Celery** - Distributed task processing
- **Redis** - Message broker and caching
- **PostgreSQL** - Persistent data storage
- **SQLAlchemy** - Async ORM
- **ElevenLabs** - Audio transcription
- **Claude Vision** - OST detection
- **Claude API** - Content translation

## Quick Start

### Prerequisites

- Python 3.12+
- PostgreSQL 13+
- Redis 7+
- FFmpeg
- API keys: ElevenLabs, Anthropic (Claude)

### Development Setup

1. **Clone and setup environment**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Configure environment**

```bash
cp .env.example .env
# Edit .env with your API keys and database credentials
```

3. **Start services with Docker Compose**

```bash
docker-compose up -d
```

4. **Initialize database**

```bash
python -c "from app.db import create_tables; import asyncio; asyncio.run(create_tables())"
```

5. **Start the API server**

```bash
uvicorn app.main:app --reload --port 8000
```

6. **Start Celery worker** (in another terminal)

```bash
celery -A app.pipeline.tasks worker --loglevel=info --concurrency=4
```

### API Endpoints

#### Jobs
- `POST /api/jobs` - Create new translation job
- `GET /api/jobs` - List jobs (with pagination and filtering)
- `GET /api/jobs/{id}` - Get job details
- `GET /api/jobs/{id}/events` - SSE stream for real-time updates
- `DELETE /api/jobs/{id}` - Cancel job
- `POST /api/jobs/{id}/retry` - Retry failed job
- `GET /api/jobs/{id}/download` - Download output DOCX

#### Batch
- `POST /api/batch` - Submit multiple jobs

#### Stats
- `GET /api/stats` - Dashboard statistics
- `GET /api/stats/health` - System health check

#### Health
- `GET /health` - Basic health check
- `GET /` - Root endpoint

## Pipeline Stages

1. **Download** - Download video using yt-dlp (720p max)
2. **Transcribe** - Extract audio and transcribe using ElevenLabs
3. **Detect OST** - Extract frames and detect music/sound using Claude Vision
4. **Translate** - Translate transcript and generate contextual notes using Claude
5. **Export** - Create formatted DOCX in Lofte Studios format

## Database Models

### Job
- `id` (UUID) - Primary key
- `youtube_url` - Source video URL
- `video_title` - Video title
- `source_language` - Source language code
- `status` - Current status (enum)
- `current_stage` - Processing stage
- `progress_pct` - Progress percentage
- `transcription` - JSONB with transcript
- `translation` - JSONB with translation
- `ost_detection` - JSONB with OST items
- `output_path` - Path to output DOCX
- `error_message` - Error details if failed
- `cost_usd` - API costs incurred
- Timestamps: submitted_at, started_at, completed_at, updated_at, created_at

### User
- `id` (UUID) - Primary key
- `username` - Unique username
- `password_hash` - Hashed password
- `display_name` - Display name
- `email` - User email
- Timestamps: created_at, updated_at

## Configuration

Settings are loaded from environment variables via `app/config.py`:

```python
DATABASE_URL              # PostgreSQL connection string
REDIS_URL                # Redis connection URL
ELEVENLABS_API_KEY       # ElevenLabs API key
ANTHROPIC_API_KEY        # Anthropic/Claude API key
STORAGE_PATH             # Output directory (default: /data/voxtranslate)
TEMP_PATH                # Temporary files (default: /tmp/voxtranslate)
CORS_ORIGINS             # Allowed CORS origins
DEBUG                    # Debug mode
SECRET_KEY               # JWT secret key
```

## Development

### Code Structure

```
app/
├── main.py              # FastAPI app factory
├── config.py            # Settings management
├── models.py            # SQLAlchemy ORM models
├── schemas.py           # Pydantic request/response schemas
├── db/
│   ├── __init__.py
│   └── database.py      # Database engine and session management
├── routes/
│   ├── jobs.py          # Job management endpoints
│   ├── stats.py         # Statistics endpoints
│   └── batch.py         # Batch processing endpoints
├── pipeline/
│   ├── tasks.py         # Celery task orchestration
│   ├── download.py      # Video download (yt-dlp)
│   ├── transcribe.py    # Audio transcription (ElevenLabs)
│   ├── detect_ost.py    # OST detection (Claude Vision)
│   ├── translate.py     # Content translation (Claude API)
│   └── export_docx.py   # DOCX export (python-docx)
└── utils/
    └── events.py        # SSE event publishing

celery_worker.py         # Worker entry point
docker-compose.yml       # Local development compose
Dockerfile              # Production image
```

### Testing

```bash
# Run tests (when available)
pytest

# Check code quality
flake8 app/
black --check app/
```

### Logging

Logging is configured in `app/main.py`. Levels:
- DEBUG: Development details
- INFO: Important events
- WARNING: Issues to monitor
- ERROR: Failed operations

## Performance Tuning

### Database
- Connection pooling: `pool_pre_ping=True`
- Async engine with `asyncpg` driver
- Indexes on frequently queried columns

### Celery
- Worker concurrency: 4 (configurable)
- Prefetch multiplier: 1 (task-at-a-time)
- Late acknowledgment enabled
- Task tracking enabled

### Redis
- Used for message broker and result backend
- 2 databases: 0 for broker, 1 for results

## Deployment

### Docker

Build and run with Docker Compose:

```bash
docker-compose -f docker-compose.yml up -d
```

### Environment Variables

Create `.env` file with production values:

```env
DEBUG=False
SECRET_KEY=<generate-secure-key>
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
REDIS_URL=redis://host:6379/0
ELEVENLABS_API_KEY=<your-key>
ANTHROPIC_API_KEY=<your-key>
```

### Database Migrations

Using Alembic (when setup):

```bash
alembic upgrade head
```

## Troubleshooting

### Database Connection
```
Error: could not translate host name "postgres" to address
```
Ensure PostgreSQL service is running and DATABASE_URL is correct.

### Celery Tasks Not Processing
```
Check Redis connection: redis-cli ping
Check Celery worker logs: celery inspect active
```

### API Not Starting
```
Check logs: docker-compose logs api
Verify environment variables are set
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with proper logging
4. Test thoroughly
5. Submit a pull request

## License

Proprietary - VoxTranslate
