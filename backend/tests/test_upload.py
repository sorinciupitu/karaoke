import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.auth import hash_password
from app.config import settings
from app.db import Base, get_db
from app.main import create_app
from app.models import Track, User
from app.pipeline.runner import run_lyrics, run_track
from app.pipeline.separate import SeparateResult

FH = {"X-Requested-With": "fetch"}


@pytest.fixture()
def session_factory(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path}/test.db", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    yield Session
    engine.dispose()


@pytest.fixture()
def client_env(tmp_path):
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


def _user_track(Session, **kw):
    db = Session()
    u = User(username="u", password_hash="x")
    db.add(u)
    db.flush()
    defaults = dict(user_id=u.id, youtube_url="", status="queued")
    defaults.update(kw)
    t = Track(**defaults)
    db.add(t)
    db.commit()
    tid = t.id
    db.close()
    return tid


# --- upload: an already-instrumental file skips separation ---


def test_run_track_instrumental_upload_skips_separation(session_factory, monkeypatch):
    Session = session_factory
    tid = _user_track(
        Session,
        source="upload",
        needs_separation=False,
        original_path="orig.wav",
        instrumental_path="orig.wav",
        vocals_path=None,
        lyrics_status="ready",
    )

    calls = {"n": 0}

    def fake_separate(*a, **k):
        calls["n"] += 1
        return SeparateResult("i", "v")

    monkeypatch.setattr("app.pipeline.runner.separate", fake_separate)
    monkeypatch.setattr("app.pipeline.runner.encode_to_m4a", lambda wav, out: out)
    monkeypatch.setattr(
        "app.pipeline.runner.ensure_wav_source", lambda sp, op: sp or op or "orig.wav"
    )

    run_track(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert calls["n"] == 0
    assert t.status == "ready"
    assert t.vocals_path is None
    db.close()


# --- upload: a full song (remove vocals) still separates ---


def test_run_track_upload_with_vocals_separates(session_factory, monkeypatch):
    Session = session_factory
    tid = _user_track(
        Session,
        source="upload",
        needs_separation=True,
        original_path="orig.wav",
        instrumental_path=None,
        vocals_path=None,
        lyrics_status="ready",
    )

    calls = {"n": 0}

    def fake_separate(*a, **k):
        calls["n"] += 1
        return SeparateResult("i", "v")

    monkeypatch.setattr("app.pipeline.runner.separate", fake_separate)
    monkeypatch.setattr("app.pipeline.runner.encode_to_m4a", lambda wav, out: out)
    monkeypatch.setattr(
        "app.pipeline.runner.ensure_wav_source", lambda sp, op: sp or op or "orig.wav"
    )

    run_track(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert calls["n"] == 1
    assert t.status == "ready"
    assert t.vocals_path == "v.m4a"
    db.close()


# --- lyrics: instrumental with no LRCLIB match leaves lyrics empty ---


def test_lyrics_instrumental_without_match_stays_empty(session_factory, monkeypatch):
    Session = session_factory
    tid = _user_track(
        Session,
        source="upload",
        status="ready",
        vocals_path=None,
        lyrics_status="pending",
        title="",
        artist="",
    )

    monkeypatch.setattr("app.pipeline.runner.fetch_lrclib", lambda t, a, d: [])

    def boom(*a, **k):
        raise AssertionError("transcribe must not run without vocals")

    monkeypatch.setattr("app.pipeline.runner.transcribe", boom)

    run_lyrics(tid, mode="auto", session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert t.lyrics_status == "ready"
    assert t.lyrics == []
    db.close()


# --- upload endpoint: instrumental ---


def test_upload_endpoint_instrumental(client_env, monkeypatch, tmp_path):
    client, Session = client_env
    _login(client)

    monkeypatch.setattr(
        "app.routers.tracks.save_upload",
        lambda file, md: (str(tmp_path / "up.wav"), 123.0),
    )

    r = client.post(
        "/api/tracks/upload",
        files={"file": ("song.mp3", b"fakeaudio", "audio/mpeg")},
        data={
            "title": "Test",
            "artist": "Artist",
            "remove_vocals": "false",
            "lyrics": "true",
        },
        headers=FH,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "Test"
    assert body["artist"] == "Artist"
    assert body["lyrics_status"] == "pending"

    db = Session()
    t = db.get(Track, body["id"])
    assert t.source == "upload"
    assert t.needs_separation is False
    assert t.instrumental_path == t.original_path
    assert t.vocals_path is None
    db.close()


# --- upload endpoint: full song (remove vocals) ---


def test_upload_endpoint_remove_vocals(client_env, monkeypatch, tmp_path):
    client, Session = client_env
    _login(client)

    monkeypatch.setattr(
        "app.routers.tracks.save_upload",
        lambda file, md: (str(tmp_path / "up.wav"), 123.0),
    )

    r = client.post(
        "/api/tracks/upload",
        files={"file": ("song.mp3", b"fakeaudio", "audio/mpeg")},
        data={
            "title": "Test",
            "artist": "Artist",
            "remove_vocals": "true",
            "lyrics": "false",
        },
        headers=FH,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["lyrics_status"] == "ready"

    db = Session()
    t = db.get(Track, body["id"])
    assert t.needs_separation is True
    assert t.instrumental_path is None
    assert t.vocals_path is None
    db.close()
