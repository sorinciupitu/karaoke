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

    media_file = tmp_path / "song.m4a"
    content = bytes(range(100))
    media_file.write_bytes(content)

    with TestClient(app) as client:
        db = Session()
        a = User(username="a", password_hash=hash_password("pw"))
        b = User(username="b", password_hash=hash_password("pw"))
        db.add_all([a, b])
        db.flush()
        t = Track(user_id=a.id, youtube_url="x", instrumental_path=str(media_file))
        db.add(t)
        db.commit()
        tid = t.id
        db.close()
        yield client, tid, content
    engine.dispose()


def login(client, username):
    return client.post(
        "/auth/login", json={"username": username, "password": "pw"}, headers=FH
    )


def test_full_range_200(env):
    client, tid, content = env
    login(client, "a")
    r = client.get(f"/media/{tid}/instrumental")
    assert r.status_code == 200
    assert r.content == content
    assert r.headers["accept-ranges"] == "bytes"


def test_partial_range_206(env):
    client, tid, content = env
    login(client, "a")
    r = client.get(f"/media/{tid}/instrumental", headers={"Range": "bytes=0-9"})
    assert r.status_code == 206
    assert r.headers["content-range"] == f"bytes 0-9/{len(content)}"
    assert r.content == content[:10]


def test_range_past_eof_416(env):
    client, tid, content = env
    login(client, "a")
    r = client.get(f"/media/{tid}/instrumental", headers={"Range": "bytes=200-300"})
    assert r.status_code == 416
    assert r.headers["content-range"] == f"bytes */{len(content)}"
    assert r.content == b""


def test_media_ownership_404(env):
    client, tid, content = env
    login(client, "b")
    r = client.get(f"/media/{tid}/instrumental")
    assert r.status_code == 404
