from app.pipeline.lyrics import Line, Word, group_words, parse_lrc


def test_parse_lrc_basic():
    lrc = "[00:12.34]primul vers\n[00:15.00]al doilea"
    lines = parse_lrc(lrc)

    assert len(lines) == 2
    assert lines[0].text == "primul vers"
    assert lines[0].start == 12.34
    assert lines[0].end == 15.0  # next line's start
    assert lines[1].text == "al doilea"
    assert lines[1].start == 15.0
    assert lines[1].end == 18.0  # last line: start + 3.0


def test_parse_lrc_skips_metadata():
    lrc = "[ar:Artist]\n[ti:Title]\n[length:03:45]\n[00:05.00]un vers"
    lines = parse_lrc(lrc)

    assert [l.text for l in lines] == ["un vers"]
    assert lines[0].start == 5.0


def test_group_words_splits_on_gap():
    words = [Word(0.0, 0.5, "a"), Word(0.6, 1.0, "b"), Word(2.2, 2.7, "c")]
    lines = group_words(words, max_gap=1.0)

    assert [l.text for l in lines] == ["a b", "c"]
    assert lines[0].start == 0.0
    assert lines[0].end == 1.0
    assert lines[1].start == 2.2
    assert lines[1].end == 2.7


def test_group_words_joins_within_gap():
    words = [Word(0.0, 0.5, "a"), Word(0.6, 1.0, "b")]
    lines = group_words(words, max_gap=1.0)

    assert [l.text for l in lines] == ["a b"]


def test_group_words_splits_on_max_chars():
    words = [Word(0.0, 0.5, "a"), Word(0.6, 1.0, "b"), Word(1.1, 1.5, "c")]
    lines = group_words(words, max_gap=1.0, max_chars=3)

    assert [l.text for l in lines] == ["a b", "c"]
