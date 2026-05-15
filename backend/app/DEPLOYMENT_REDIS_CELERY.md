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
| FastAPI + Gunicorn | API requests (must stay <200ms) | `gunicorn main:app` |
| Celery Worker | Background tasks (SMS, WhatsApp, FCM push, OTP, cleanup, scoring, payment polling) | `celery worker` |
| Celery Beat | Periodic task scheduler | `celery beat` (or `--beat` flag) |
| Redis | Cache + message broker + rate limiting | `redis-server` |

### Registered task modules

All of these are auto-loaded via `celery_app.include` in `core/celery_app.py`:

- `tasks.sms_dispatch` — single + bulk SMS (`send_one`, `send_batch`, `resume_pending_batches`)
- `tasks.whatsapp_dispatch` — WhatsApp template + text fan-out (`send_action`, `send_text`, `send_bulk`)
- `tasks.push_dispatch` — FCM push fan-out (`send_to_user`, `send_to_tokens`)
- `tasks.notifications` — OTP / verification / welcome SMS / email
- `tasks.payments_verify` — STK polling, ticket reservation sweeper
- `tasks.content_cleanup`, `tasks.quality_scores`, `tasks.maintenance` — periodic housekeeping

All `[wa_dispatch]`, `[sms_dispatch]`, `[push_dispatch]` log lines flow to the Celery worker journal, so use `journalctl -u nuru-celery -f` to follow live message delivery.

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

---

## Nginx tuning (added by perf audit, May 2026)

Recommended additions to the Nginx server block in front of Gunicorn:

```nginx
# Timeouts — match Gunicorn's 120s worker timeout
proxy_connect_timeout 10s;
proxy_send_timeout    120s;
proxy_read_timeout    120s;
proxy_buffering on;
proxy_buffers 16 32k;
proxy_buffer_size 32k;

# Body size for media uploads (matches mobile 5MB + slack)
client_max_body_size 25M;
client_body_buffer_size 256k;

# Keepalive to upstream (Gunicorn keepalive=5)
keepalive_requests 1000;
keepalive_timeout 65s;

# Compression — JSON responses benefit a lot
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_min_length 1024;
gzip_comp_level 5;
gzip_types
  application/json
  application/javascript
  application/xml
  text/css
  text/plain
  text/javascript
  image/svg+xml;

# Brotli (only if ngx_brotli is built into the package)
# brotli on;
# brotli_comp_level 5;
# brotli_types application/json application/javascript text/css image/svg+xml;
```

## Celery worker command (multi-queue)

```
celery -A core.celery_app worker \
  -Q auth_otp,default,bulk_sms \
  --concurrency=4 \
  --loglevel=info
```

`auth_otp` is listed first so OTPs win when the worker is busy. Bulk SMS
batches drain on the same worker but never block interactive auth flows.

## Database pool sizing

`core/database.py` now reads `DB_POOL_SIZE` (default 10), `DB_MAX_OVERFLOW`
(default 20), and `DB_POOL_TIMEOUT` (default 10s). Combined with a Gunicorn
worker cap of 5 (`min(cpu*2+1, 5)`), peak Postgres usage stays under
~150 connections — safe for a managed Supabase project (~200 cap).

## Slow-request visibility

`SLOW_REQUEST_THRESHOLD_MS` defaults to 800 ms. `LOG_SLOW_REQUESTS` defaults
to **on** when `ENV=production`. Slow samples are recorded to the Redis
sorted set `perf:samples` and surfaced in the admin slow-endpoints widget.

## New performance index pack

Apply `migrations/2026_05_15_perf_indexes_v3.sql` on production to add
covering indexes for contributors, expenses, payments, attendees, and
support chat. All `IF NOT EXISTS`, safe to re-run.
