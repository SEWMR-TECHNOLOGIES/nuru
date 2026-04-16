from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware

from api.routes import all_routers
from api.routes.card_templates import router as card_templates_router
from core.config import ENV

app = FastAPI(
    title="Nuru API",
    version="1.0.0",
    docs_url=None if ENV == "production" else "/docs",
    redoc_url=None if ENV == "production" else "/redoc",
    openapi_url=None if ENV == "production" else "/openapi.json",
)

API_PREFIX = "/api/v1"

# ------------------------------------------------------------------
# Middleware stack (order matters: outermost runs first)
# ------------------------------------------------------------------

# 1. CORS (must be outermost for preflight handling)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://192.168.100.7:8080",
        "https://app.nuru.tz",
        "https://www.nuru.tz",
        "https://nuru.tz",
        "https://workspace.nuru.tz",
        "http://app.nuru.tz",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. GZip compression for all responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# 3. Redis-based rate limiting (replaces broken in-memory RateLimitMiddleware)
from middleware.rate_limit import RedisRateLimitMiddleware
app.add_middleware(
    RedisRateLimitMiddleware,
    max_requests=500,        # increase capacity
    window_seconds=60,       # keep same window
    exclude_paths={
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/api/v1/admin",    # VERY IMPORTANT
    },
)

# 4. Auth-endpoint specific tighter rate limiting
from middleware.rate_limit import RedisAuthRateLimitMiddleware
app.add_middleware(
    RedisAuthRateLimitMiddleware,
    max_requests=10,        # auth: 10 req/min
    window_seconds=60,
)

# 5. Security headers (lightweight, always runs)
from middleware.security import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)

# 6. Query logging & per-request DB stats (dev/staging diagnostics)
from middleware.query_logger import QueryCountMiddleware, ENABLED as QUERY_LOG_ON
if QUERY_LOG_ON:
    app.add_middleware(QueryCountMiddleware)

# 7. Slow request logger — logs any request > SLOW_REQUEST_THRESHOLD_MS (default 500ms)
from middleware.slow_request_logger import SlowRequestLoggerMiddleware
app.add_middleware(SlowRequestLoggerMiddleware)

# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@app.get("/")
def root():
    return {"message": "Welcome to Nuru API"}

for router in all_routers:
    app.include_router(router, prefix=API_PREFIX)

# Admin monitoring (separate mount for clarity)
from api.routes.admin_monitoring import router as admin_monitoring_router
app.include_router(admin_monitoring_router, prefix=API_PREFIX)

# Ensure card-templates routes are always mounted (safety fallback)
registered_paths = {route.path for route in app.router.routes}
if f"{API_PREFIX}/card-templates" not in registered_paths:
    app.include_router(card_templates_router, prefix=API_PREFIX)

# ------------------------------------------------------------------
# Error handling
# ------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "data": None,
        },
    )


# ------------------------------------------------------------------
# Startup
# ------------------------------------------------------------------
@app.on_event("startup")
def startup_checks():
    from core.redis import redis_available
    if redis_available():
        print("[startup] Redis connected ✓ — caching + rate limiting active")
    else:
        print("[startup] Redis unavailable — caching disabled, rate limiting falls open")
    print("[startup] Background tasks handled by Celery workers (not in-process threads)")
    print("[startup] Run:  celery -A core.celery_app worker --beat --loglevel=info")


# ------------------------------------------------------------------
# Health endpoint
# ------------------------------------------------------------------
@app.get("/health")
def health():
    from core.redis import redis_available
    return {
        "status": "ok",
        "redis": redis_available(),
    }
