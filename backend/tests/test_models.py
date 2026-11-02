from app.models import User, Track, Playlist, PlaylistTrack


def test_track_lyrics_roundtrip(db):
    u = User(username="ana", password_hash="x")
    db.add(u)
    db.flush()

    t = Track(
        user_id=u.id,
        youtube_url="https://youtu.be/abc",
        status="queued",
        lyrics_status="pending",
        lyrics=[{"text": "hai", "start": 0.0, "end": 1.0}],
    )
    db.add(t)
    db.flush()
    db.refresh(t)

    assert t.status == "queued"
    assert t.lyrics_status == "pending"
    assert t.lyrics == [{"text": "hai", "start": 0.0, "end": 1.0}]
    assert t.lyrics[0]["text"] == "hai"


def test_track_default_lyrics_is_empty_list(db):
    u = User(username="bob", password_hash="x")
    db.add(u)
    db.flush()

    t = Track(user_id=u.id, youtube_url="https://youtu.be/def")
    db.add(t)
    db.flush()
    db.refresh(t)

    assert t.lyrics == []


def test_playlist_track_float_position(db):
    u = User(username="cal", password_hash="x")
    db.add(u)
    db.flush()

    t = Track(user_id=u.id, youtube_url="https://youtu.be/ghi")
    p = Playlist(user_id=u.id, name="mixe")
    db.add_all([t, p])
    db.flush()

    pt = PlaylistTrack(playlist_id=p.id, track_id=t.id, position=2.5)
    db.add(pt)
    db.flush()
    db.refresh(pt)

    assert pt.position == 2.5
    assert pt.playlist_id == p.id
    assert pt.track_id == t.id
