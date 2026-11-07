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
def env(tmp_path):
    settings.ADMIN_USERNAME = "admin"
    settings.ADMIN_PASSWORD = "adminpass"
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
        db.add_all(
            [
                User(username="a", password_hash=hash_password("pw")),
                User(username="b", password_hash=hash_password("pw")),
            ]
        )
        db.commit()
        db.close()
        yield client, Session
    engine.dispose()


def login(client, username):
    return client.post(
        "/auth/login", json={"username": username, "password": "pw"}, headers=FH
    )


def test_track_ownership_isolation(env):
    client, _ = env
    login(client, "a")
    tid = client.post(
        "/api/tracks", json={"youtube_url": "https://youtu.be/x"}, headers=FH
    ).json()["id"]

    client.post("/auth/logout", headers=FH)
    login(client, "b")

    assert client.get(f"/api/tracks/{tid}").status_code == 404
    assert client.patch(f"/api/tracks/{tid}", json={"title": "x"}, headers=FH).status_code == 404
    assert client.delete(f"/api/tracks/{tid}", headers=FH).status_code == 404


def test_update_lyrics_stores_lines(env):
    client, _ = env
    login(client, "a")
    tid = client.post(
        "/api/tracks", json={"youtube_url": "https://youtu.be/x"}, headers=FH
    ).json()["id"]

    r = client.put(
        f"/api/tracks/{tid}/lyrics",
        json={"lines": [{"text": "hei", "start": 0.0, "end": 2.0}]},
        headers=FH,
    )
    assert r.status_code == 200
    assert r.json()["lyrics"] == [{"text": "hei", "start": 0.0, "end": 2.0}]


def test_patch_title_artist(env):
    client, _ = env
    login(client, "a")
    tid = client.post(
        "/api/tracks", json={"youtube_url": "https://youtu.be/x"}, headers=FH
    ).json()["id"]

    r = client.patch(
        f"/api/tracks/{tid}", json={"title": "Titlu", "artist": "Artist"}, headers=FH
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Titlu"
    assert r.json()["artist"] == "Artist"


def test_delete_track(env):
    client, _ = env
    login(client, "a")
    tid = client.post(
        "/api/tracks", json={"youtube_url": "https://youtu.be/x"}, headers=FH
    ).json()["id"]

    assert client.delete(f"/api/tracks/{tid}", headers=FH).status_code == 204
    assert client.get(f"/api/tracks/{tid}").status_code == 404


def test_list_only_own_tracks(env):
    client, _ = env
    login(client, "a")
    client.post("/api/tracks", json={"youtube_url": "https://youtu.be/a1"}, headers=FH)
    client.post("/api/tracks", json={"youtube_url": "https://youtu.be/a2"}, headers=FH)

    client.post("/auth/logout", headers=FH)
    login(client, "b")
    client.post("/api/tracks", json={"youtube_url": "https://youtu.be/b1"}, headers=FH)

    assert len(client.get("/api/tracks").json()) == 1

    client.post("/auth/logout", headers=FH)
    login(client, "a")
    assert len(client.get("/api/tracks").json()) == 2


def test_create_tracks_batch(env):
    client, _ = env
    login(client, "a")

    r = client.post(
        "/api/tracks/batch",
        json={"youtube_urls": ["https://youtu.be/a1", "  ", "https://youtu.be/a2"]},
        headers=FH,
    )
    assert r.status_code == 201
    body = r.json()
    assert len(body) == 2  # blank lines are skipped
    assert {t["youtube_url"] for t in body} == {"https://youtu.be/a1", "https://youtu.be/a2"}
    assert all(t["status"] == "queued" for t in body)


def test_cancel_and_retry(env):
    client, _ = env
    login(client, "a")
    tid = client.post(
        "/api/tracks", json={"youtube_url": "https://youtu.be/x"}, headers=FH
    ).json()["id"]

    r = client.post(f"/api/tracks/{tid}/cancel", headers=FH)
    assert r.json()["status"] == "failed"

    r = client.post(f"/api/tracks/{tid}/retry", headers=FH)
    assert r.json()["status"] == "queued"


def test_reprocess_sets_model_and_requeues(env, tmp_path):
    client, Session = env
    login(client, "a")
    tid = client.post(
        "/api/tracks", json={"youtube_url": "https://youtu.be/x"}, headers=FH
    ).json()["id"]

    src = tmp_path / "src.wav"
    src.write_bytes(b"RIFF-placeholder")

    db = Session()
    t = db.get(Track, tid)
    t.status = "ready"
    t.needs_separation = True
    t.instrumental_path = "inst.m4a"
    t.vocals_path = "voc.m4a"
    t.original_path = "orig.m4a"
    t.source_path = str(src)
    db.commit()
    db.close()

    r = client.post(
        f"/api/tracks/{tid}/reprocess",
        json={"model": "htdemucs_ft"},
        headers=FH,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "queued"
    assert body["demucs_model"] == "htdemucs_ft"

    db = Session()
    t = db.get(Track, tid)
    assert t.instrumental_path is None
    assert t.vocals_path is None
    assert t.demucs_model == "htdemucs_ft"
    db.close()


def test_reprocess_rejects_unknown_model(env):
    client, _ = env
    login(client, "a")
    tid = client.post(
        "/api/tracks", json={"youtube_url": "https://youtu.be/x"}, headers=FH
    ).json()["id"]

    r = client.post(
        f"/api/tracks/{tid}/reprocess", json={"model": "nope"}, headers=FH
    )
    assert r.status_code == 400


def test_reprocess_rejects_track_without_separation(env):
    client, Session = env
    login(client, "a")
    tid = client.post(
        "/api/tracks", json={"youtube_url": "https://youtu.be/x"}, headers=FH
    ).json()["id"]

    db = Session()
    t = db.get(Track, tid)
    t.status = "ready"
    t.needs_separation = False
    db.commit()
    db.close()

    r = client.post(
        f"/api/tracks/{tid}/reprocess", json={"model": "htdemucs"}, headers=FH
    )
    assert r.status_code == 400
