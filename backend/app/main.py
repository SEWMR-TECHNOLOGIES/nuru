from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from api.routes import all_routers

app = FastAPI(
    title="Nuru API",
    version="1.0.0",
)

API_PREFIX = "/api/v1"

# ------------------------------------------------------------------
# CORS
# ------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://app.nuru.tz",
        "https://www.nuru.tz",
        "https://nuru.tz",
        "https://workspace.nuru.tz",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@app.get("/")
def root():
    return {"message": "Welcome to Nuru API"}

for router in all_routers:
    app.include_router(router, prefix=API_PREFIX)

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
