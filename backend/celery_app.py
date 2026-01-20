"""
Celery application configuration.

This module defines the Celery app and its configuration.
Task modules are auto-discovered from backend.tasks.
"""

from celery import Celery
from celery.schedules import crontab

from backend.config import (
    CELERY_BROKER_URL,
    CELERY_RESULT_BACKEND,
    DATA_UPDATE_HOUR,
)

# Create Celery app
celery_app = Celery(
    'backend',
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=[
        'backend.tasks.fred_tasks',
        'backend.tasks.crypto_tasks',
        'backend.tasks.analytics_tasks',
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

# Celery Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    'update-fred-data-daily': {
        'task': 'backend.tasks.fred_tasks.update_all_fred_series',
        'schedule': crontab(hour=DATA_UPDATE_HOUR, minute=0),  # Daily at 2 AM UTC
    },
    'update-crypto-metrics-daily': {
        'task': 'backend.tasks.crypto_tasks.update_crypto_metrics',
        'schedule': crontab(hour=DATA_UPDATE_HOUR, minute=15),  # Daily at 2:15 AM UTC
    },
}
