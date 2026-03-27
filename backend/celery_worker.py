#!/usr/bin/env python
"""Celery worker entry point."""

import logging

from app.pipeline.tasks import celery_app
import app.pipeline.upload_tasks  # noqa

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("Starting Celery worker...")
    celery_app.start()
