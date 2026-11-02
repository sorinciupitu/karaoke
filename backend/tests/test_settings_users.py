import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.auth import hash_password
from app.config import settings
from app.db import Base, get_db
from app.main import create_app
from app.models import User

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
        db.add(User(username="a", password_hash=hash_password("pw")))
        db.commit()
        db.close()
        yield client, Session
    engine.dispose()


def login(client, username, password="pw"):
    return client.post(
        "/auth/login", json={"username": username, "password": password}, headers=FH
    )


def test_non_admin_cannot_list_users(env):
    client, _ = env
    login(client, "a")
    assert client.get("/api/users").status_code == 403


def test_admin_create_and_delete_user(env):
    client, _ = env
    login(client, "admin", "adminpass")

    r = client.post("/api/users", json={"username": "c", "password": "x"}, headers=FH)
    assert r.status_code == 201
    uid = r.json()["id"]

    usernames = [u["username"] for u in client.get("/api/users").json()]
    assert "c" in usernames

    assert client.delete(f"/api/users/{uid}", headers=FH).status_code == 204
    usernames = [u["username"] for u in client.get("/api/users").json()]
    assert "c" not in usernames


def test_settings_upsert(env):
    client, _ = env
    login(client, "a")

    r = client.get("/api/settings")
    assert r.status_code == 200
    assert r.json()["crossfade_enabled"] is True
    assert r.json()["crossfade_seconds"] == 5.0

    r = client.patch("/api/settings", json={"crossfade_seconds": 7.5}, headers=FH)
    assert r.status_code == 200
    assert r.json()["crossfade_seconds"] == 7.5

    assert client.get("/api/settings").json()["crossfade_seconds"] == 7.5
