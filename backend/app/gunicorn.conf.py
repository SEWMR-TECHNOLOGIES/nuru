"""
Gunicorn Production Configuration
===================================
Usage: gunicorn -c gunicorn.conf.py main:app

Tuned for a VPS with 2-4 CPU cores and 4-8 GB RAM.
"""

import multiprocessing
import os

# ─────────────────────────────────────────────
# Workers
# ─────────────────────────────────────────────
# Rule of thumb: 2 × cores + 1
# For async (uvicorn) workers, fewer workers with more concurrency each
workers = int(os.getenv("GUNICORN_WORKERS", min(multiprocessing.cpu_count() * 2 + 1, 9)))
worker_class = "uvicorn.workers.UvicornWorker"

# ─────────────────────────────────────────────
# Timeouts
# ─────────────────────────────────────────────
timeout = 120          # Kill worker if request takes > 120s
graceful_timeout = 30  # Time for graceful shutdown
keepalive = 5          # Keep connections alive for 5s (NGINX upstream)

# ─────────────────────────────────────────────
# Binding
# ─────────────────────────────────────────────
bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")

# ─────────────────────────────────────────────
# Limits
# ─────────────────────────────────────────────
max_requests = 1000        # Restart worker after 1000 requests (prevent memory leaks)
max_requests_jitter = 100  # Randomize to avoid all workers restarting at once
limit_request_line = 4096
limit_request_fields = 100

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
accesslog = "-"  # stdout
errorlog = "-"   # stderr
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# ─────────────────────────────────────────────
# Server mechanics
# ─────────────────────────────────────────────
preload_app = True  # Load app before forking workers (saves memory via copy-on-write)
forwarded_allow_ips = "*"  # Trust X-Forwarded-* from NGINX
proxy_protocol = False

# ─────────────────────────────────────────────
# Hooks
# ─────────────────────────────────────────────
def on_starting(server):
    """Called when Gunicorn is starting."""
    pass

def post_fork(server, worker):
    """Called after a worker has been forked. Reset DB connections."""
    from core.database import engine
    engine.dispose()
