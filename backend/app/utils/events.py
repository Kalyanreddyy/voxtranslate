"""Event publishing and subscription utilities."""

import asyncio
import json
import logging
from typing import AsyncGenerator

import redis.asyncio as redis

from app.config import settings

logger = logging.getLogger(__name__)


async def publish_job_event(job_id: str, event_type: str, data: dict) -> None:
    """Publish a job event to Redis."""
    try:
        redis_client = redis.from_url(settings.REDIS_URL)
        channel = f"job:{job_id}"
        event_data = {
            "event_type": event_type,
            "data": data,
        }
        await redis_client.publish(channel, json.dumps(event_data))
        await redis_client.close()
    except Exception as e:
        logger.error(f"Error publishing event for job {job_id}: {e}")


async def get_job_events(job_id: str) -> AsyncGenerator[str, None]:
    """Subscribe to job events and yield them as SSE."""
    try:
        redis_client = redis.from_url(settings.REDIS_URL)
        pubsub = redis_client.pubsub()
        channel = f"job:{job_id}"

        await pubsub.subscribe(channel)

        # Send initial connection message
        yield f"data: {json.dumps({'event_type': 'connected', 'job_id': job_id})}\n\n"

        # Listen for events
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                yield f"data: {json.dumps(data)}\n\n"
            elif message["type"] == "unsubscribe":
                break

        await pubsub.unsubscribe(channel)
        await redis_client.close()

    except asyncio.CancelledError:
        logger.info(f"Event stream for job {job_id} cancelled")
        raise
    except Exception as e:
        logger.error(f"Error in event stream for job {job_id}: {e}")
        yield f"data: {json.dumps({'event_type': 'error', 'message': str(e)})}\n\n"
