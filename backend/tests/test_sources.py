from app.pipeline.songmeta import candidates, clean_artist, clean_title
from app.pipeline.sources import (
    LyricsHit,
    fetch_synced_lyrics,
    parse_lyricsplus,
    score_lrclib_hit,
)

# --- metadata cleanup -------------------------------------------------------


def test_clean_title_strips_video_noise():
    assert clean_title("Visele (Videoclip Oficial)") == "Visele"
    assert clean_title("Sun Is Up [Official Video HD]") == "Sun Is Up"
    assert clean_title("Hello (Official Music Video)") == "Hello"
    # "Remix" is part of the song identity — keep it.
    assert "Remix" in clean_title("Piesa (Remix)")


def test_clean_artist_strips_channel_decorations():
    assert clean_artist("Irina Rimes - Topic") == "Irina Rimes"
    assert clean_artist("AlexandraStanVEVO") == "AlexandraStan"


def test_candidates_include_artist_title_split():
    got = candidates("Irina Rimes - Visele (Videoclip Oficial)", "Irina Rimes")
    assert ("Visele", "Irina Rimes") in got


def test_candidates_drop_duplicates_and_keep_order():
    got = candidates("Visele", "Irina Rimes")
    assert got[0] == ("Visele", "Irina Rimes")
    assert len(got) == len(set(got))


# --- LyricsPlus payload -----------------------------------------------------


def test_parse_lyricsplus_converts_ms_and_clamps_overlap():
    payload = {
        "type": "Word",
        "lyrics": [
            {"time": 500, "duration": 2000, "text": "primul vers"},
            {"time": 2000, "duration": 3000, "text": "al doilea vers"},
            {"time": 4000, "duration": 1000, "text": "  "},
        ],
    }
    lines = parse_lyricsplus(payload)

    assert [l.text for l in lines] == ["primul vers", "al doilea vers"]
    assert lines[0].start == 0.5 and lines[0].end == 2.0
    assert lines[1].start == 2.0 and lines[1].end == 5.0


def test_parse_lyricsplus_sorts_and_flags_instrumental_notes():
    payload = {
        "lyrics": [
            {"time": 3000, "duration": 1000, "text": "al doilea"},
            {"time": 1000, "duration": 1000, "text": "♪"},
            {"time": 1000, "duration": 1000, "text": "primul"},
        ]
    }
    lines = parse_lyricsplus(payload)
    assert [l.text for l in lines] == ["primul", "al doilea"]


# --- LRCLIB matching --------------------------------------------------------


def test_score_prefers_matching_title_and_duration():
    hit = {
        "trackName": "Visele",
        "artistName": "Irina Rimes",
        "duration": 213.0,
    }
    good = score_lrclib_hit(hit, "Visele", "Irina Rimes", 213.0)
    bad = score_lrclib_hit(hit, "Cu taraita", "Smiley", 140.0)
    assert good > bad
    assert good > 0.9


def test_score_handles_multi_artist_credits():
    hit = {
        "trackName": "Sub Pielea Mea",
        "artistName": "Burak Yeter, Carla's Dreams",
        "duration": 200.0,
    }
    assert score_lrclib_hit(hit, "Sub pielea mea", "Carla's Dreams", 200.0) > 0.85


# --- provider selection -----------------------------------------------------


def test_fetch_synced_lyrics_prefers_best_duration_fit(monkeypatch):
    from app.pipeline.lyrics import Line

    off = [Line("off", 0.0, 60.0), Line("b", 60.0, 120.0), Line("c", 120.0, 165.0)]
    on = [Line("on", 0.0, 100.0), Line("b", 100.0, 150.0), Line("c", 150.0, 201.0)]
    monkeypatch.setattr("app.pipeline.sources.fetch_lyricsplus", lambda *a, **k: off)
    monkeypatch.setattr("app.pipeline.sources.fetch_lrclib", lambda *a, **k: on)

    hit = fetch_synced_lyrics("Visele", "Irina Rimes", 200.0)

    assert isinstance(hit, LyricsHit)
    assert hit.source == "lrclib"
    assert hit.lines[0].text == "on"


def test_fetch_synced_lyrics_skips_wrong_version(monkeypatch):
    from app.pipeline.lyrics import Line

    short = [Line("scurt", 0.0, 40.0), Line("b", 40.0, 70.0), Line("c", 70.0, 90.0)]
    monkeypatch.setattr("app.pipeline.sources.fetch_lyricsplus", lambda *a, **k: short)
    monkeypatch.setattr("app.pipeline.sources.fetch_lrclib", lambda *a, **k: None)

    # our audio is 4 minutes long; a 90s match is a different version
    assert fetch_synced_lyrics("Visele", "Irina Rimes", 240.0) is None


def test_fetch_synced_lyrics_returns_none_when_nothing_matches(monkeypatch):
    monkeypatch.setattr("app.pipeline.sources.fetch_lyricsplus", lambda *a, **k: None)
    monkeypatch.setattr("app.pipeline.sources.fetch_lrclib", lambda *a, **k: None)

    assert fetch_synced_lyrics("Nimeni", "Necunoscut", 180.0) is None
