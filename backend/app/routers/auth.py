from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..auth import (
    clear_login_failures,
    create_access_token,
    get_current_user,
    is_login_locked,
    record_login_failure,
    verify_password,
)
from ..config import settings
from ..db import get_db
from ..models import User
from ..schemas import LoginIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    if is_login_locked(body.username):
        raise HTTPException(
            status_code=429, detail="prea multe încercări; încearcă mai târziu"
        )
    user = db.query(User).filter(User.username == body.username).first()
    if user is None or not verify_password(body.password, user.password_hash):
        record_login_failure(body.username)
        raise HTTPException(status_code=401, detail="credentiale invalide")
    clear_login_failures(body.username)
    token = create_access_token(user.id)
    response.set_cookie(
        settings.COOKIE_NAME,
        token,
        httponly=True,
        samesite="lax",
        max_age=settings.TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(settings.COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
