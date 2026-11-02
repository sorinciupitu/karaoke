from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import sessionmaker

from .auth import seed_admin
from .db import Base, engine as default_engine
from .routers import auth as auth_router
from .routers import media as media_router
from .routers import playlists as playlists_router
from .routers import settings as settings_router
from .routers import tracks as tracks_router
from .routers import users as users_router


def create_app(engine=None):
    eng = engine or default_engine
    SessionLocal = sessionmaker(bind=eng, autoflush=False, autocommit=False)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        Base.metadata.create_all(bind=eng)
        seed_admin(SessionLocal)
        yield

    app = FastAPI(lifespan=lifespan)

    @app.middleware("http")
    async def require_fetch_header(request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            if request.headers.get("x-requested-with") != "fetch":
                return JSONResponse(
                    status_code=403, content={"detail": "lipsă header CSRF"}
                )
        return await call_next(request)

    app.include_router(auth_router.router)
    app.include_router(tracks_router.router)
    app.include_router(media_router.router)
    app.include_router(playlists_router.router)
    app.include_router(settings_router.router)
    app.include_router(users_router.router)
    return app


app = create_app()
