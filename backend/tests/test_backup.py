import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.auth import hash_password
from app.config import settings
from app.db import Base, get_db
from app.main import create_app
from app.models import Track, User

FH = {"X-Requested-With": "fetch"}


@pytest.fixture()
def client_env(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "MEDIA_DIR", str(tmp_path))
    settings.SECRET_KEY = "test-secret-key-that-is-long-enough-1234567890"
    engine = create_engine(
        f"sqlite:///{tmp_path}/test.db", connect_args={"check_same_thread": False}
    )
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    app = create_app(engine=engine)

    def override_get_db():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        db = Session()
        db.add(User(username="a", password_hash=hash_password("pw")))
        db.commit()
        db.close()
        yield client, Session
    engine.dispose()


def _login(client):
    return client.post(
        "/auth/login", json={"username": "a", "password": "pw"}, headers=FH
    )


def _ready_track(Session, tmp_path, uid):
    inst = tmp_path / "i.m4a"
    orig = tmp_path / "o.m4a"
    voc = tmp_path / "v.m4a"
    inst.write_bytes(b"inst")
    orig.write_bytes(b"orig")
    voc.write_bytes(b"voc")
    db = Session()
    t = Track(
        user_id=uid,
        title="Piesa",
        artist="Artist",
        youtube_url="",
        status="ready",
        lyrics_status="ready",
        lyrics=[{"text": "un vers", "start": 0.0, "end": 2.0}],
        instrumental_path=str(inst),
        original_path=str(orig),
        vocals_path=str(voc),
    )
    db.add(t)
    db.commit()
    db.close()


def test_backup_roundtrip(client_env, tmp_path):
    client, Session = client_env
    _login(client)

    db = Session()
    uid = db.query(User).filter(User.username == "a").first().id
    db.close()

    _ready_track(Session, tmp_path, uid)

    r = client.get("/api/backup")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    zip_bytes = r.content

    # simulate a fresh install: wipe everything
    db = Session()
    db.query(Track).delete()
    db.commit()
    db.close()

    r2 = client.post(
        "/api/backup/import",
        files={"file": ("b.zip", zip_bytes, "application/zip")},
        headers=FH,
    )
    assert r2.status_code == 200
    assert r2.json()["imported"] == 1

    db = Session()
    t = db.query(Track).first()
    assert t is not None
    assert t.title == "Piesa"
    assert t.artist == "Artist"
    assert t.status == "ready"
    assert t.lyrics == [{"text": "un vers", "start": 0.0, "end": 2.0}]
    assert t.instrumental_path and os.path.exists(t.instrumental_path)
    assert t.original_path and os.path.exists(t.original_path)
    assert t.vocals_path and os.path.exists(t.vocals_path)
    db.close()


def test_backup_skips_non_ready_tracks(client_env, tmp_path):
    client, Session = client_env
    _login(client)

    db = Session()
    uid = db.query(User).filter(User.username == "a").first().id
    db.add(
        Track(
            user_id=uid,
            title="In curs",
            youtube_url="",
            status="queued",
            instrumental_path=None,
            original_path=None,
            vocals_path=None,
        )
    )
    db.commit()
    db.close()

    r = client.get("/api/backup")
    assert r.status_code == 200
    # only ready tracks are exported; the queued one has no audio to restore
    assert b"In curs" not in r.content
