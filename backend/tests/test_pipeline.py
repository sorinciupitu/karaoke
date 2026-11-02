import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.jobs.worker import next_pending_track
from app.models import Track, User
from app.pipeline.download import DownloadResult
from app.pipeline.lyrics import Line, Word
from app.pipeline.runner import run_track
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


def test_full_success(session_factory, monkeypatch):
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
    monkeypatch.setattr(
        "app.pipeline.runner.fetch_lrclib",
        lambda title, artist, dur: [Line("vers", 0.0, 3.0)],
    )
    monkeypatch.setattr("app.pipeline.runner.encode_to_m4a", lambda wav, out: out)

    run_track(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert t.status == "ready"
    assert t.lyrics_status == "ready"
    assert t.lyrics_source == "lrclib"
    assert t.lyrics[0]["text"] == "vers"
    db.close()


def test_transcription_failure_keeps_track_ready(session_factory, monkeypatch):
    Session = session_factory
    tid = _make_track(Session)

    monkeypatch.setattr(
        "app.pipeline.runner.download",
        lambda url, md: DownloadResult("orig.wav", "t", "a", 10.0, "abc"),
    )
    monkeypatch.setattr(
        "app.pipeline.runner.separate",
        lambda o, out, m: SeparateResult("inst.wav", "voc.wav"),
    )
    monkeypatch.setattr("app.pipeline.runner.fetch_lrclib", lambda t, a, d: None)

    def boom(vocals, lang, model, models):
        raise RuntimeError("whisper failed")

    monkeypatch.setattr("app.pipeline.runner.transcribe", boom)
    monkeypatch.setattr("app.pipeline.runner.encode_to_m4a", lambda wav, out: out)

    run_track(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert t.status == "ready"
    assert t.lyrics_status == "failed"
    assert t.error is not None and "whisper failed" in t.error
    db.close()


def test_resume_after_encode_failure(session_factory, monkeypatch):
    Session = session_factory
    tid = _make_track(Session)

    calls = {"download": 0, "separate": 0, "encode": 0}

    def fake_download(url, md):
        calls["download"] += 1
        return DownloadResult("orig.wav", "t", "a", 10.0, "abc")

    def fake_separate(o, out, m):
        calls["separate"] += 1
        return SeparateResult("inst.wav", "voc.wav")

    def fake_encode(wav, out):
        calls["encode"] += 1
        if calls["encode"] == 1:
            raise RuntimeError("encode boom")
        return out

    monkeypatch.setattr("app.pipeline.runner.download", fake_download)
    monkeypatch.setattr("app.pipeline.runner.separate", fake_separate)
    monkeypatch.setattr("app.pipeline.runner.fetch_lrclib", lambda t, a, d: [Line("v", 0.0, 1.0)])
    monkeypatch.setattr("app.pipeline.runner.encode_to_m4a", fake_encode)

    run_track(tid, session_factory=Session)  # fails at encode
    run_track(tid, session_factory=Session)  # resumes

    assert calls["download"] == 1
    assert calls["separate"] == 1
    # 1 failed instrumental encode + 3 successful encodes on the resumed run
    assert calls["encode"] == 4

    db = Session()
    t = db.get(Track, tid)
    assert t.status == "ready"
    db.close()


def test_lrclib_miss_uses_whisper(session_factory, monkeypatch):
    Session = session_factory
    tid = _make_track(Session)

    monkeypatch.setattr(
        "app.pipeline.runner.download",
        lambda url, md: DownloadResult("orig.wav", "t", "a", 10.0, "abc"),
    )
    monkeypatch.setattr(
        "app.pipeline.runner.separate",
        lambda o, out, m: SeparateResult("inst.wav", "voc.wav"),
    )
    monkeypatch.setattr("app.pipeline.runner.fetch_lrclib", lambda t, a, d: None)
    monkeypatch.setattr(
        "app.pipeline.runner.transcribe",
        lambda v, l, m, md: [Word(0.0, 0.5, "hai"), Word(0.6, 1.0, "tu")],
    )
    monkeypatch.setattr("app.pipeline.runner.encode_to_m4a", lambda wav, out: out)

    run_track(tid, session_factory=Session)

    db = Session()
    t = db.get(Track, tid)
    assert t.lyrics_source == "whisper"
    assert t.lyrics[0]["text"] == "hai tu"
    db.close()


def test_next_pending_track_skips_ready_and_failed(session_factory):
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

    pending = next_pending_track(session_factory=Session)
    assert pending.id == t1_id
