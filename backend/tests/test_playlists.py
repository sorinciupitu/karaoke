import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.auth import hash_password
from app.config import settings
from app.db import Base, get_db
from app.main import create_app
from app.models import PlaylistTrack, Track, User

FH = {"X-Requested-With": "fetch"}


@pytest.fixture()
def env(tmp_path):
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


def _make_tracks(Session, n=3):
    db = Session()
    u = db.query(User).filter(User.username == "a").first()
    tracks = [Track(user_id=u.id, youtube_url=f"https://youtu.be/{i}") for i in range(n)]
    db.add_all(tracks)
    db.commit()
    ids = [t.id for t in tracks]
    db.close()
    return ids


def _playlist_with_tracks(client, Session, n=3):
    tids = _make_tracks(Session, n)
    pid = client.post("/api/playlists", json={"name": "m"}, headers=FH).json()["id"]
    for tid in tids:
        client.post(f"/api/playlists/{pid}/tracks", json={"track_id": tid}, headers=FH)
    return pid, tids


def test_reorder_persists_order(env):
    client, Session = env
    login(client, "a")
    pid, tids = _playlist_with_tracks(client, Session, 3)

    r = client.put(
        f"/api/playlists/{pid}/tracks/order",
        json={"track_ids": list(reversed(tids))},
        headers=FH,
    )
    assert r.status_code == 200

    db = Session()
    ordered = [
        pt.track_id
        for pt in db.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == pid)
        .order_by(PlaylistTrack.position)
        .all()
    ]
    db.close()
    assert ordered == list(reversed(tids))


def test_reorder_duplicate_422(env):
    client, Session = env
    login(client, "a")
    pid, tids = _playlist_with_tracks(client, Session, 3)

    r = client.put(
        f"/api/playlists/{pid}/tracks/order",
        json={"track_ids": [tids[0], tids[0], tids[1]]},
        headers=FH,
    )
    assert r.status_code == 422

    db = Session()
    ordered = [
        pt.track_id
        for pt in db.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == pid)
        .order_by(PlaylistTrack.position)
        .all()
    ]
    db.close()
    assert ordered == tids  # unchanged


def test_playlist_ownership_404(env):
    client, Session = env
    login(client, "a")
    pid = client.post("/api/playlists", json={"name": "m"}, headers=FH).json()["id"]

    client.post("/auth/logout", headers=FH)
    login(client, "b")

    assert client.get(f"/api/playlists/{pid}").status_code == 404
    assert client.delete(f"/api/playlists/{pid}", headers=FH).status_code == 404
