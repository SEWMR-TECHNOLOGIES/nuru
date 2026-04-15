# Nuru Backend — Scalability & Architecture Guide

## Current Architecture (VPS)

```
                    ┌──────────┐
                    │  NGINX   │  (TLS termination, static files, proxy)
                    └────┬─────┘
                         │
              ┌──────────┴──────────┐
              │                     │
     ┌────────▼────────┐   ┌───────▼───────┐
     │   Gunicorn       │   │   Celery      │
     │  (4-9 workers)   │   │  (2 workers   │
     │  UvicornWorker   │   │   + beat)     │
     └────────┬────────┘   └───────┬───────┘
              │                     │
     ┌────────▼─────────────────────▼───────┐
     │              Redis                    │
     │  (cache + broker + rate limiting)     │
     └────────┬─────────────────────────────┘
              │
     ┌────────▼────────┐
     │   PostgreSQL     │
     │   (Supabase)     │
     └─────────────────┘
```

## Scaling Strategy

### Vertical (Current VPS)
- Already optimized: connection pooling, caching, batch queries
- Gunicorn auto-scales workers to CPU count
- Redis handles ~100K ops/sec on a single node
- Good for: up to ~1000 concurrent users

### Horizontal (When needed)

#### Phase 1: Add PgBouncer (Connection Pooling)
When: >50 concurrent DB connections
```
# /etc/pgbouncer/pgbouncer.ini
[databases]
nuru = host=<supabase-host> port=5432 dbname=<db>

[pgbouncer]
listen_port = 6432
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
```
Update `DATABASE_URL` to point to PgBouncer (`localhost:6432`).

#### Phase 2: Read Replicas
When: read-heavy load exceeds single DB
- Add Supabase read replica
- Route read-only endpoints (feed, search, references) to replica
- Keep writes on primary

#### Phase 3: Multiple Application Servers
When: single VPS CPU is saturated
- Deploy Gunicorn on 2+ VPS behind NGINX load balancer
- Redis + PostgreSQL remain centralized
- Celery workers can run on any node (shared Redis broker)

#### Phase 4: CDN + Edge Caching
When: global user base or high static asset load
- Put Cloudflare/Fastly in front of NGINX
- Cache trending posts, reference data, and public profiles at edge
- Use `Cache-Control` headers for public endpoints

## Connection Pool Settings (database.py)

Current settings tuned for VPS:
```python
pool_size=5          # Base connections per worker
max_overflow=10      # Burst capacity
pool_timeout=30      # Wait for connection before error
pool_recycle=1800    # Recycle connections every 30 min
pool_pre_ping=True   # Verify connection is alive before use
```

With 4 Gunicorn workers: 4 × (5+10) = 60 max connections.
Supabase default connection limit is ~60-100. If scaling workers,
add PgBouncer first.

## Redis Memory Planning

Estimated cache memory usage:
| Data | ~Size per entry | Max entries | Total |
|------|----------------|-------------|-------|
| Feed page | 50KB | 1000 users × 5 pages | 250MB |
| Trending | 50KB | 10 variants | 0.5MB |
| Notifications | 10KB | 1000 users × 3 pages | 30MB |
| Reference data | 5KB | 10 endpoints | 0.05MB |
| Rate limit keys | 0.1KB | 10000 IPs | 1MB |
| **Total** | | | **~280MB** |

Set Redis `maxmemory 512mb` with `maxmemory-policy allkeys-lru`.

## Monitoring Checklist

1. **Response times**: Track P50/P95/P99 via NGINX access logs
2. **Redis hit rate**: `redis-cli info stats | grep keyspace`
3. **DB connections**: `SELECT count(*) FROM pg_stat_activity`
4. **Celery queue depth**: `celery -A core.celery_app inspect active`
5. **Worker restarts**: Gunicorn `max_requests` ensures no memory leaks

## NGINX Optimizations

```nginx
upstream nuru_api {
    least_conn;
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    
    # Brotli compression (better than gzip for JSON)
    brotli on;
    brotli_types application/json text/plain;
    
    # Proxy settings
    location /api/ {
        proxy_pass http://nuru_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 120s;
        
        # Buffer
        proxy_buffering on;
        proxy_buffer_size 8k;
        proxy_buffers 16 8k;
    }
    
    # Cache public endpoints at NGINX level
    location /api/v1/posts/public/trending {
        proxy_pass http://nuru_api;
        proxy_cache_valid 200 5m;
        add_header X-Cache-Status $upstream_cache_status;
    }
    
    location /api/v1/references/ {
        proxy_pass http://nuru_api;
        proxy_cache_valid 200 30m;
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```
