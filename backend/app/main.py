from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from api.routes import users, propose, auth, reference, services, user_services, events

app = FastAPI(title="Nuru API", version="1.0.0")

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",        # frontend dev
        "http://127.0.0.1:8080",        # frontend dev
        "https://app.nuru.tz",          # production frontend
        "https://www.nuru.tz",          # production frontend
        "https://nuru.tz",              # non-www production frontend
        "https://workspace.nuru.tz",    # pre-production frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

@app.get("/")
def root():
    return {"message": "Welcome to Nuru API"}

# Include routers
app.include_router(propose.router, prefix=f"{API_PREFIX}/propose", tags=["Propose"])
app.include_router(auth.router, prefix=f"{API_PREFIX}/auth", tags=["Auth"])
app.include_router(users.router, prefix=f"{API_PREFIX}/users", tags=["Users"])
app.include_router(reference.router, prefix=f"{API_PREFIX}/references", tags=["References"])
app.include_router(services.router, prefix=f"{API_PREFIX}/user-services", tags=["Services"])
app.include_router(events.router, prefix=f"{API_PREFIX}/user-events", tags=["Events"])
app.include_router(user_services.router, prefix=f"{API_PREFIX}/user-services", tags=["User Services"])
# app.include_router(events.router, prefix=f"{API_PREFIX}/events", tags=["Events"])
# app.include_router(attendees.router, prefix=f"{API_PREFIX}/attendees", tags=["Attendees"])

# Custom HTTPException handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.detail, "data": None},
    )
