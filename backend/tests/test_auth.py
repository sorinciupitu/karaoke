import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import Base, get_db
from app.main import create_app

ADMIN = {"username": "admin", "password": "testpass"}
FH = {"X-Requested-With": "fetch"}


@pytest.fixture()
def client(tmp_path):
    settings.ADMIN_USERNAME = "admin"
    settings.ADMIN_PASSWORD = "testpass"
    settings.SECRET_KEY = "test-secret"

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

    with TestClient(app) as c:
        yield c
    engine.dispose()


def test_login_sets_http_only_cookie(client):
    r = client.post("/auth/login", json=ADMIN, headers=FH)
    assert r.status_code == 200
    data = r.json()
    assert data["username"] == "admin"
    assert data["is_admin"] is True
    assert "id" in data

    cookie = r.headers.get("set-cookie", "")
    assert settings.COOKIE_NAME in cookie
    assert "HttpOnly" in cookie


def test_login_wrong_password_401(client):
    r = client.post(
        "/auth/login", json={"username": "admin", "password": "wrong"}, headers=FH
    )
    assert r.status_code == 401


def test_me_with_cookie(client):
    client.post("/auth/login", json=ADMIN, headers=FH)
    r = client.get("/auth/me")
    assert r.status_code == 200
    assert r.json()["username"] == "admin"


def test_me_without_cookie_401(client):
    r = client.get("/auth/me")
    assert r.status_code == 401


def test_logout_clears_cookie(client):
    client.post("/auth/login", json=ADMIN, headers=FH)
    r = client.post("/auth/logout", headers=FH)
    assert r.status_code == 200
    assert settings.COOKIE_NAME in r.headers.get("set-cookie", "")


def test_mutating_request_without_header_403(client):
    r = client.post("/auth/login", json=ADMIN)  # no X-Requested-With
    assert r.status_code == 403
