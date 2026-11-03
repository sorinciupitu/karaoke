import pytest
from sqlalchemy import create_engine, inspect, text

import app.models  # noqa: F401  (registers models on Base.metadata)
from app.migrations import run_migrations


# Schema as it existed before the `musical_key` column was introduced.
OLD_TRACKS = """
CREATE TABLE tracks (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    title VARCHAR(512),
    artist VARCHAR(512),
    youtube_url VARCHAR(1024),
    youtube_id VARCHAR(64),
    status VARCHAR(32),
    lyrics_status VARCHAR(32),
    error VARCHAR(2048),
    duration FLOAT,
    instrumental_path VARCHAR(1024),
    original_path VARCHAR(1024),
    vocals_path VARCHAR(1024),
    lyrics JSON,
    lyrics_source VARCHAR(32),
    lyrics_mode VARCHAR(32),
    error_count INTEGER,
    language VARCHAR(16),
    created_at DATETIME
)
"""


def test_migration_adds_missing_musical_key(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path}/old.db", connect_args={"check_same_thread": False}
    )
    with engine.begin() as conn:
        conn.execute(text(OLD_TRACKS))

    run_migrations(engine)

    cols = {c["name"] for c in inspect(engine).get_columns("tracks")}
    assert "musical_key" in cols
    engine.dispose()
