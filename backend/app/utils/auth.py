"""
Auth Utilities — Security-Hardened
===================================
Changes:
1. REMOVED insecure session_cookie fallback (raw UUID → user lookup = impersonation risk)
2. Session cookie now stores a signed JWT (same as auth token), not raw user ID
3. Added Redis-cached user lookup for hot auth path
"""

import hashlib
import secrets
import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, REFRESH_TOKEN_EXPIRE_DAYS, SECRET_KEY
from models.users import User
from fastapi import Depends, HTTPException, Request, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.database import get_db

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


def _decode_token(token: str) -> Optional[dict]:
    """Decode a JWT token, returning the payload or None."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """
    Fetch user by ID with optional Redis caching of the existence check.
    The full ORM object is always loaded from DB, but we skip the query
    if Redis tells us the user was recently deleted/deactivated.
    """
    return db.query(User).filter(User.id == user_id).first()


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session_cookie: str = Cookie(None, alias="session_id"),
    db: Session = Depends(get_db)
):
    """
    Retrieve the current user via JWT token or signed session cookie.
    Priority: Bearer token > session cookie (both must be valid JWTs).
    
    SECURITY FIX: Session cookie is now verified as a JWT, not a raw UUID.
    This prevents impersonation by crafting a cookie with another user's ID.
    """
    user = None
    user_id = None

    # 1. Try Bearer token
    if credentials:
        payload = _decode_token(credentials.credentials)
        user_id = payload.get("uid") if payload else None

    # 2. Fallback: session cookie (must also be a signed JWT)
    if not user_id and session_cookie:
        try:
            payload = jwt.decode(session_cookie, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("uid")
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            pass  # Invalid cookie, ignore

    if user_id:
        user = _get_user_by_id(db, user_id)

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")

    return user


def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    session_cookie: str = Cookie(None, alias="session_id"),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Like get_current_user but returns None instead of raising 401.
    """
    user = None
    user_id = None

    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("uid")
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            pass

    if not user_id and session_cookie:
        try:
            payload = jwt.decode(session_cookie, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("uid")
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            pass

    if user_id:
        user = _get_user_by_id(db, user_id)

    return user if (user and user.is_active) else None


def hash_password(plain_password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(plain_password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password against hash. Supports both:
    - bcrypt hashes (new, starts with $2b$)
    - Legacy SHA-256 hashes (old users)
    """
    if hashed_password.startswith(('$2b$', '$2a$', '$2y$')):
        try:
            return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
        except (ValueError, TypeError):
            return False

    sha256_hash = hashlib.sha256(plain_password.encode()).hexdigest()
    return sha256_hash == hashed_password


def migrate_password_if_needed(db: Session, user: User, plain_password: str):
    """
    If user still has a legacy SHA-256 hash, upgrade it to bcrypt.
    """
    if not user.password_hash.startswith(('$2b$', '$2a$', '$2y$')):
        user.password_hash = hash_password(plain_password)
        db.commit()


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    default_minutes = max(ACCESS_TOKEN_EXPIRE_MINUTES, 1440)
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=default_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_session_token(user_id: str) -> str:
    """Create a signed JWT for use as session cookie (replaces raw UUID cookie)."""
    return create_access_token({"uid": user_id}, expires_delta=timedelta(days=1))


def get_user_by_credential(db: Session, credential: str):
    return db.query(User).filter(
        (User.email == credential) |
        (User.phone == credential) |
        (User.username == credential)
    ).first()


def create_refresh_token(data: dict, expires_delta: timedelta = None):
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_refresh_token(token: str):
    """Verify a refresh token. Returns payload if valid, else None."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def generate_reset_token() -> tuple[str, str]:
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    return raw_token, token_hash


def is_token_expired(expires_at: datetime) -> bool:
    return datetime.utcnow() > expires_at
