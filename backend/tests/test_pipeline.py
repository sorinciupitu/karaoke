import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.jobs.worker import next_lyrics_track, next_processing_track
from app.models import Track, User
from app.pipeline.download import DownloadResult
from app.pipeline.lyrics import Line, Word
from app.pipeline.runner import run_lyrics, run_track
from app.pipeline.separate import SeparateResult


@pytest.fixture()
def session_factory(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path}/test.db", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    yield Session
    engine.dispose()


def _make_track(Session) -> int:
    db = Session()
    u = User(username="u", password_hash="x")
    db.add(u)
    db.flush()
    t = Track(user_id=u.id, youtube_url="https://youtu.be/abc", language="ro")
    db.add(t)
    db.commit()
    tid = t.id
    db.close()
    return tid


def _make_ready_track(Session, vocals_path="voc.wav") -> int:
    db = Session()
    u = User(username="u", password_hash="x")
    db.add(u)
    db.flush()
    t = Track(
        user_id=u.id,
        youtube_url="https://youtu.be/abc",
        language="ro",
        status="ready",
        lyrics_status="pending",
        vocals_path=vocals_path,
    )
    db.add(t)
    db.commit()
    tid = t.id
    db.close()
    return tid


# --- run_track: the track becomes playable WITHOUT waiting for lyrics ---


def test_run_track_marks_ready_but_leaves_lyrics_pending(session_factory, monkeypatch):
    Session = session_factory
    tid = _make_track(Session)

    monkeypatch.setattr(
        "app.pipeline.runner.download",
        lambda url, md: DownloadResult("orig.wav", "Titlu", "Artist", 123.0, "abc"),
    )
    monkeypatch.setattr(
        "app.pipeline.runner.separate",
        lambda o, out, m: SeparateResult("inst.wav", "voc.wav"),
    )
    monkeypatch.setattr("app.pipeline.runner.encode_to_m4a", lambda wav, out: out)

    run_track(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert t.status == "ready"
    assert t.lyrics_status == "pending"  # lyrics handled separately, later
    db.close()


# --- run_lyrics ---


def test_run_lyrics_auto_uses_lrclib(session_factory, monkeypatch):
    Session = session_factory
    tid = _make_ready_track(Session)

    monkeypatch.setattr(
        "app.pipeline.runner.fetch_lrclib",
        lambda title, artist, dur: [Line("vers", 0.0, 3.0)],
    )
    monkeypatch.setattr("app.pipeline.runner.correct_lines", lambda lines: lines)

    run_lyrics(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert t.lyrics_status == "ready"
    assert t.lyrics_source == "lrclib"
    assert t.lyrics[0]["text"] == "vers"
    db.close()


def test_run_lyrics_auto_falls_back_to_whisper(session_factory, monkeypatch):
    Session = session_factory
    tid = _make_ready_track(Session)

    monkeypatch.setattr("app.pipeline.runner.fetch_lrclib", lambda t, a, d: None)
    monkeypatch.setattr(
        "app.pipeline.runner.transcribe",
        lambda v, l, m, md: [Word(0.0, 0.5, "hai"), Word(0.6, 1.0, "tu")],
    )
    monkeypatch.setattr("app.pipeline.runner.correct_lines", lambda lines: lines)

    run_lyrics(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert t.lyrics_status == "ready"
    assert t.lyrics_source == "whisper"
    assert t.lyrics[0]["text"] == "hai tu"
    db.close()


def test_run_lyrics_corrects_with_ollama(session_factory, monkeypatch):
    Session = session_factory
    tid = _make_ready_track(Session)

    monkeypatch.setattr("app.pipeline.runner.fetch_lrclib", lambda t, a, d: None)
    monkeypatch.setattr(
        "app.pipeline.runner.transcribe",
        lambda v, l, m, md: [Word(0.0, 0.5, "hai"), Word(0.6, 1.0, "tu")],
    )

    calls = []

    def fake_correct(lines):
        calls.append(lines)
        return [Line("hai să", 0.0, 1.0)]

    monkeypatch.setattr("app.pipeline.runner.correct_lines", fake_correct)

    run_lyrics(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert t.lyrics[0]["text"] == "hai să"
    assert len(calls) == 1
    db.close()


def test_run_lyrics_failure_sets_failed_status(session_factory, monkeypatch):
    Session = session_factory
    tid = _make_ready_track(Session)

    monkeypatch.setattr("app.pipeline.runner.fetch_lrclib", lambda t, a, d: None)

    def boom(v, l, m, md):
        raise RuntimeError("whisper failed")

    monkeypatch.setattr("app.pipeline.runner.transcribe", boom)

    run_lyrics(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert t.lyrics_status == "failed"
    assert "whisper failed" in t.error
    db.close()


# --- worker queries ---


def test_next_processing_track_skips_ready_and_failed(session_factory):
    Session = session_factory
    db = Session()
    u = User(username="u", password_hash="x")
    db.add(u)
    db.flush()
    t1 = Track(user_id=u.id, youtube_url="a", status="queued")
    t2 = Track(user_id=u.id, youtube_url="b", status="ready")
    t3 = Track(user_id=u.id, youtube_url="c", status="failed")
    db.add_all([t1, t2, t3])
    db.flush()
    t1_id = t1.id
    db.commit()
    db.close()

    pending = next_processing_track(session_factory=Session)
    assert pending.id == t1_id


def test_next_lyrics_track_finds_ready_with_pending_lyrics(session_factory):
    Session = session_factory
    db = Session()
    u = User(username="u", password_hash="x")
    db.add(u)
    db.flush()
    t1 = Track(user_id=u.id, youtube_url="a", status="ready", lyrics_status="pending")
    t2 = Track(user_id=u.id, youtube_url="b", status="ready", lyrics_status="ready")
    t3 = Track(user_id=u.id, youtube_url="c", status="queued", lyrics_status="pending")
    db.add_all([t1, t2, t3])
    db.flush()
    t1_id = t1.id
    db.commit()
    db.close()

    pending = next_lyrics_track(session_factory=Session)
    assert pending.id == t1_id
