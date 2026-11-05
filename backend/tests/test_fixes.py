import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.auth import hash_password
from app.config import settings
from app.db import Base, get_db
from app.jobs.worker import next_lyrics_track
from app.main import create_app
from app.models import Playlist, PlaylistTrack, Track, User
from app.pipeline.download import DownloadResult
from app.pipeline.lyrics import Line, Word
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


def _make_user_track(Session, status="ready"):
    db = Session()
    u = User(username="u", password_hash="x")
    db.add(u)
    db.flush()
    t = Track(user_id=u.id, youtube_url="https://youtu.be/x", status=status)
    db.add(t)
    db.commit()
    tid = t.id
    db.close()
    return tid


# --- Fix: delete track removes playlist rows ---


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


def test_delete_track_then_reorder_remaining_succeeds(client_env):
    client, Session = client_env
    _login(client)

    t1 = client.post("/api/tracks", json={"youtube_url": "a"}, headers=FH).json()["id"]
    t2 = client.post("/api/tracks", json={"youtube_url": "b"}, headers=FH).json()["id"]
    pid = client.post("/api/playlists", json={"name": "p"}, headers=FH).json()["id"]
    client.post(f"/api/playlists/{pid}/tracks", json={"track_id": t1}, headers=FH)
    client.post(f"/api/playlists/{pid}/tracks", json={"track_id": t2}, headers=FH)

    client.delete(f"/api/tracks/{t1}", headers=FH)

    r = client.put(
        f"/api/playlists/{pid}/tracks/order", json={"track_ids": [t2]}, headers=FH
    )
    assert r.status_code == 200


# --- Fix: retry on ready track is a no-op ---


def test_retry_ready_track_is_noop(client_env):
    client, Session = client_env
    _login(client)
    tid = client.post("/api/tracks", json={"youtube_url": "a"}, headers=FH).json()["id"]

    db = Session()
    t = db.get(Track, tid)
    t.status = "ready"
    db.commit()
    db.close()

    r = client.post(f"/api/tracks/{tid}/retry", headers=FH)
    assert r.json()["status"] == "ready"


# --- Fix: encode is atomic and does not double-encode ---


def test_encode_partial_failure_is_atomic(session_factory, monkeypatch):
    Session = session_factory
    tid = _make_user_track(Session, status="separating")

    monkeypatch.setattr(
        "app.pipeline.runner.download",
        lambda url, md: DownloadResult("orig.wav", "t", "a", 10.0, "x"),
    )
    monkeypatch.setattr(
        "app.pipeline.runner.separate",
        lambda o, out, m, model_name=None: SeparateResult("inst.wav", "voc.wav"),
    )
    monkeypatch.setattr("app.pipeline.runner.fetch_lrclib", lambda t, a, d: [Line("v", 0.0, 1.0)])

    calls = {"n": 0}

    def fake_encode(wav, out):
        calls["n"] += 1
        if calls["n"] == 2:  # original fails on first run
            raise RuntimeError("boom")
        return out

    monkeypatch.setattr("app.pipeline.runner.encode_to_m4a", fake_encode)

    run_track(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    # partial success must not have committed instrumental as .m4a
    assert t.instrumental_path == "inst.wav"
    assert t.status == "encoding"
    db.close()


def test_encode_bounded_retry_marks_failed(session_factory, monkeypatch):
    Session = session_factory
    tid = _make_user_track(Session, status="separating")

    monkeypatch.setattr(
        "app.pipeline.runner.download",
        lambda url, md: DownloadResult("orig.wav", "t", "a", 10.0, "x"),
    )
    monkeypatch.setattr(
        "app.pipeline.runner.separate",
        lambda o, out, m, model_name=None: SeparateResult("inst.wav", "voc.wav"),
    )
    monkeypatch.setattr("app.pipeline.runner.fetch_lrclib", lambda t, a, d: [Line("v", 0.0, 1.0)])

    def always_boom(wav, out):
        raise RuntimeError("boom")

    monkeypatch.setattr("app.pipeline.runner.encode_to_m4a", always_boom)

    run_track(tid, session_factory=Session)
    run_track(tid, session_factory=Session)
    run_track(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert t.status == "failed"
    db.close()


# --- Fix: resync preserves edited text ---


def test_resync_preserves_edited_text(session_factory, monkeypatch):
    Session = session_factory
    db = Session()
    u = User(username="u", password_hash="x")
    db.add(u)
    db.flush()
    t = Track(
        user_id=u.id,
        youtube_url="x",
        status="ready",
        vocals_path="voc.wav",
        lyrics=[{"text": "primul vers", "start": 10.0, "end": 12.0},
                {"text": "al doilea vers", "start": 12.0, "end": 14.0}],
    )
    db.add(t)
    db.commit()
    tid = t.id
    db.close()

    monkeypatch.setattr(
        "app.pipeline.runner.transcribe",
        lambda v, l, m, md, initial_prompt=None, progress_cb=None: [
            Word(0.0, 0.5, "a"),
            Word(2.2, 2.7, "b"),
        ],
    )

    run_lyrics(tid, mode="resync", session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert t.lyrics[0]["text"] == "primul vers"
    assert t.lyrics[1]["text"] == "al doilea vers"
    assert t.lyrics[0]["start"] == 0.0  # re-timed
    assert t.lyrics[1]["start"] == 2.2
    db.close()


# --- Fix: worker picks ready track with pending lyrics ---


def test_next_lyrics_picks_ready_lyrics_track(session_factory):
    Session = session_factory
    db = Session()
    u = User(username="u", password_hash="x")
    db.add(u)
    db.flush()
    t = Track(user_id=u.id, youtube_url="x", status="ready", lyrics_status="pending")
    db.add(t)
    db.commit()
    tid = t.id
    db.close()

    pending = next_lyrics_track(session_factory=Session)
    assert pending is not None and pending.id == tid
