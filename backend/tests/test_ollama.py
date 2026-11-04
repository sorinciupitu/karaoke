from app.pipeline.lyrics import Line
from app.pipeline.ollama import correct_lines


def _lines():
    return [
        Line("hai sa cantam impreuna", 0.0, 3.0),
        Line("melodia asta e frumoasa", 3.2, 6.5),
    ]


def _patch_post(monkeypatch, captured, response_text=None, error=None):
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"response": response_text}

    def post(url, json=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        if error:
            raise error
        return FakeResponse()

    monkeypatch.setattr("httpx.post", post)
    return captured


def test_correct_lines_preserves_timing(monkeypatch):
    monkeypatch.setattr("app.config.settings.OLLAMA_ENABLED", True)
    monkeypatch.setattr("app.config.settings.OLLAMA_URL", "http://ollama:11434")
    monkeypatch.setattr("app.config.settings.OLLAMA_MODEL", "test-model")

    captured = {}
    _patch_post(
        monkeypatch,
        captured,
        response_text="hai să cântăm împreună\nmelodia asta e frumoasă",
    )

    out = correct_lines(_lines())

    assert [l.text for l in out] == [
        "hai să cântăm împreună",
        "melodia asta e frumoasă",
    ]
    # timing preserved from originals
    assert out[0].start == 0.0 and out[0].end == 3.0
    assert out[1].start == 3.2 and out[1].end == 6.5
    body = captured["json"]
    assert "adăuga cuvinte" in body["prompt"]
    assert body["model"] == "test-model"


def test_correct_lines_line_count_mismatch_returns_originals(monkeypatch):
    monkeypatch.setattr("app.config.settings.OLLAMA_ENABLED", True)
    _patch_post(monkeypatch, {}, response_text="un singur rand gresit")

    out = correct_lines(_lines())
    assert [l.text for l in out] == [l.text for l in _lines()]


def test_correct_lines_http_error_returns_originals(monkeypatch):
    monkeypatch.setattr("app.config.settings.OLLAMA_ENABLED", True)
    _patch_post(monkeypatch, {}, error=RuntimeError("connection refused"))

    out = correct_lines(_lines())
    assert [l.text for l in out] == [l.text for l in _lines()]


def test_correct_lines_disabled_returns_originals(monkeypatch):
    monkeypatch.setattr("app.config.settings.OLLAMA_ENABLED", False)
    out = correct_lines(_lines())
    assert [l.text for l in out] == [l.text for l in _lines()]
