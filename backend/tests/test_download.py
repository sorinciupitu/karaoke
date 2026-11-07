from app.pipeline.download import _ytdlp_opts


def test_ytdlp_opts_includes_cookies_when_present(tmp_path, monkeypatch):
    cookies = tmp_path / "cookies.txt"
    cookies.write_text("# Netscape HTTP Cookie File")
    monkeypatch.setattr("app.config.settings.YTDLP_COOKIES_FILE", str(cookies))
    monkeypatch.setattr("app.config.settings.YTDLP_PROXY", "")

    opts = _ytdlp_opts(str(tmp_path))
    assert opts["cookiefile"] == str(cookies)
    assert "proxy" not in opts
    assert "user_agent" in opts


def test_ytdlp_opts_includes_proxy_when_set(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.settings.YTDLP_COOKIES_FILE", "/nonexistent/cookies.txt")
    monkeypatch.setattr("app.config.settings.YTDLP_PROXY", "http://proxy:8080")

    opts = _ytdlp_opts(str(tmp_path))
    assert opts["proxy"] == "http://proxy:8080"
    assert "cookiefile" not in opts


def test_ytdlp_opts_skips_missing_cookies_and_empty_proxy(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.settings.YTDLP_COOKIES_FILE", "/nonexistent/cookies.txt")
    monkeypatch.setattr("app.config.settings.YTDLP_PROXY", "")

    opts = _ytdlp_opts(str(tmp_path))
    assert "cookiefile" not in opts
    assert "proxy" not in opts
