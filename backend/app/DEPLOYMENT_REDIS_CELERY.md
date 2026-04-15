# Nuru Backend — Redis & Celery Deployment Guide

## Prerequisites
- Redis server (v6+) installed on the VPS
- Python packages: `redis==5.2.1`, `celery==5.4.0`

## 1. Install Redis on VPS (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping  # Should return PONG
```

## 2. Environment Variable
Add to your `.env` or systemd unit:
```
REDIS_URL=redis://localhost:6379/0
```

## 3. Install Python Dependencies
```bash
pip install -r requirements.txt
```

## 4. Start Celery Worker + Beat Scheduler
Create a systemd service at `/etc/systemd/system/nuru-celery.service`:
```ini
[Unit]
Description=Nuru Celery Worker + Beat
After=network.target redis-server.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/backend/app
Environment=REDIS_URL=redis://localhost:6379/0
ExecStart=/path/to/venv/bin/celery -A core.celery_app worker --beat --loglevel=info --concurrency=2
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable nuru-celery
sudo systemctl start nuru-celery
sudo systemctl status nuru-celery
```

## 5. Gunicorn (unchanged, but daemon threads are now removed)
```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## 6. Verify
```bash
# Check Redis
redis-cli ping

# Check Celery workers
celery -A core.celery_app inspect active

# Check health endpoint
curl http://localhost:8000/health
# Should return: {"status": "ok", "redis": true}
```

## Architecture Summary

| Component | What it does | Process |
|-----------|-------------|---------|
| FastAPI + Gunicorn | API requests | `gunicorn main:app` |
| Celery Worker | Background tasks (SMS, cleanup, scoring) | `celery worker` |
| Celery Beat | Periodic task scheduler | `celery beat` (or `--beat` flag) |
| Redis | Cache + message broker + rate limiting | `redis-server` |

## Cache TTLs
| Data | TTL | Invalidation |
|------|-----|-------------|
| Trending posts | 5 min | On post create/delete |
| Feed pages | 2 min | On post create/update/delete |
| Notifications | 1 min | On read/delete actions |
| Unread count | 30 sec | On read/delete actions |
| Reference data | 30 min | On admin changes |

## Periodic Tasks (via Celery Beat)
| Task | Schedule |
|------|----------|
| Auto-delete removed content | Every 6 hours |
| Recompute quality scores | Every 30 minutes |
