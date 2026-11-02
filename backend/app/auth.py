import time
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User

LOGIN_WINDOW_SECONDS = 900  # 15 minute
LOGIN_MAX_ATTEMPTS = 5

_login_failures: dict[str, list[float]] = {}


def _prune_failures(username: str, now: float) -> None:
    _login_failures[username] = [
        t for t in _login_failures.get(username, []) if now - t < LOGIN_WINDOW_SECONDS
    ]


def is_login_locked(username: str, now: float | None = None) -> bool:
    now = now if now is not None else time.time()
    _prune_failures(username, now)
    return len(_login_failures.get(username, [])) >= LOGIN_MAX_ATTEMPTS


def record_login_failure(username: str, now: float | None = None) -> None:
    now = now if now is not None else time.time()
    _login_failures.setdefault(username, []).append(now)
    _prune_failures(username, now)


def clear_login_failures(username: str) -> None:
    _login_failures.pop(username, None)


def reset_login_attempts() -> None:
    _login_failures.clear()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, pw_hash: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8")[:72], pw_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return int(payload["sub"])
    except Exception:
        return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="neautentificat")
    user_id = decode_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="token invalid")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="utilizator inexistent")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="doar admin")
    return user


def seed_admin(session_factory):
    db = session_factory()
    try:
        if not db.query(User).filter(User.username == settings.ADMIN_USERNAME).first():
            db.add(
                User(
                    username=settings.ADMIN_USERNAME,
                    password_hash=hash_password(settings.ADMIN_PASSWORD),
                    is_admin=True,
                )
            )
            db.commit()
    finally:
        db.close()
