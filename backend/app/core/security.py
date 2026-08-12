"""JWT + password hashing.

Interop note: the original Next.js app signs sessions with the JS `jose`
library (HS256) and hashes passwords with `bcryptjs`. Both are standard
implementations (JWT / bcrypt), so as long as we use the same JWT_SECRET and
bcrypt cost factor, tokens and password hashes are fully compatible between
the two stacks during/after migration — no re-auth or re-hash needed for
existing users.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_session_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=settings.jwt_expires_seconds)
    payload = {
        "userId": user_id,
        "expires": expires.isoformat(),
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_session_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
