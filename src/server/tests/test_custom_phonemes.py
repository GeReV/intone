import types
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from utils.custom_phonemes import build_ipa_dict, parse_en_extra


# ---------------------------------------------------------------------------
# parse_en_extra
# ---------------------------------------------------------------------------

def write_en_extra(tmp_path: Path, content: str) -> str:
    p = tmp_path / "en_extra"
    p.write_text(content, encoding="utf-8")
    return str(p)


def test_parse_skips_comment_lines(tmp_path):
    path = write_en_extra(tmp_path, "// this is a comment\ngodot\t'godoU\n")
    result = parse_en_extra(path)
    assert len(result) == 1
    assert result[0][0] == "godot"


def test_parse_skips_blank_lines(tmp_path):
    path = write_en_extra(tmp_path, "\n\ngodot\t'godoU\n\n")
    result = parse_en_extra(path)
    assert len(result) == 1


def test_parse_skips_parenthesised_entries(tmp_path):
    path = write_en_extra(tmp_path, "(ben-gvir)\tb'En||gvI3:\t$capital\n")
    result = parse_en_extra(path)
    assert result == []


def test_parse_skips_flag_only_entries(tmp_path):
    path = write_en_extra(tmp_path, "arpg\t\t\t\t$abbrev\n")
    result = parse_en_extra(path)
    assert result == []


def test_parse_returns_word_and_empty_flags(tmp_path):
    path = write_en_extra(tmp_path, "godot\t'godoU\n")
    result = parse_en_extra(path)
    assert result == [("godot", [])]


def test_parse_returns_word_and_capital_flag(tmp_path):
    path = write_en_extra(tmp_path, "tolkien\tt'0lki:n\t$capital\n")
    result = parse_en_extra(path)
    assert result == [("tolkien", ["$capital"])]


def test_parse_returns_word_and_allcaps_flag(tmp_path):
    path = write_en_extra(tmp_path, "dos\td'0s\t$allcaps\n")
    result = parse_en_extra(path)
    assert result == [("dos", ["$allcaps"])]


def test_parse_multiple_entries(tmp_path):
    content = (
        "// comment\n"
        "\n"
        "godot\t'godoU\n"
        "tolkien\tt'0lki:n\t$capital\n"
        "arpg\t\t\t\t$abbrev\n"
        "(ben-gvir)\tb'En||gvI3:\t$capital\n"
    )
    path = write_en_extra(tmp_path, content)
    result = parse_en_extra(path)
    assert result == [
        ("godot", []),
        ("tolkien", ["$capital"]),
    ]


# ---------------------------------------------------------------------------
# build_ipa_dict
# ---------------------------------------------------------------------------

def make_fallback(return_map: dict) -> MagicMock:
    """Return a mock EspeakFallback whose __call__ uses return_map[token.text]."""
    mock = MagicMock()
    mock.side_effect = lambda token: return_map.get(token.text, (None, None))
    return mock


@pytest.fixture(autouse=True)
def patch_espeak_fallback():
    """Replace EspeakFallback with a controllable mock for all tests in this module."""
    with patch("utils.custom_phonemes.EspeakFallback") as MockClass:
        yield MockClass


def test_build_uses_lowercase_key_for_plain_word(patch_espeak_fallback):
    patch_espeak_fallback.return_value = make_fallback({"godot": ("ɡˈɑdɑt", 2)})
    result = build_ipa_dict([("godot", [])])
    assert result == {"godot": "ɡˈɑdɑt"}


def test_build_uses_titlecase_key_for_capital_word(patch_espeak_fallback):
    patch_espeak_fallback.return_value = make_fallback({"Tolkien": ("tɔlkˈin", 2)})
    result = build_ipa_dict([("tolkien", ["$capital"])])
    assert result == {"Tolkien": "tɔlkˈin"}


def test_build_passes_titlecase_to_espeak_for_capital(patch_espeak_fallback):
    fallback = make_fallback({"Tolkien": ("tɔlkˈin", 2)})
    patch_espeak_fallback.return_value = fallback
    build_ipa_dict([("tolkien", ["$capital"])])
    called_text = fallback.call_args[0][0].text
    assert called_text == "Tolkien"


def test_build_uses_lowercase_key_for_allcaps_word(patch_espeak_fallback):
    patch_espeak_fallback.return_value = make_fallback({"DOS": ("dˈɑs", 2)})
    result = build_ipa_dict([("dos", ["$allcaps"])])
    assert result == {"dos": "dˈɑs"}


def test_build_passes_uppercase_to_espeak_for_allcaps(patch_espeak_fallback):
    fallback = make_fallback({"DOS": ("dˈɑs", 2)})
    patch_espeak_fallback.return_value = fallback
    build_ipa_dict([("dos", ["$allcaps"])])
    called_text = fallback.call_args[0][0].text
    assert called_text == "DOS"


def test_build_skips_empty_ipa(patch_espeak_fallback):
    patch_espeak_fallback.return_value = make_fallback({"godot": ("", 2)})
    result = build_ipa_dict([("godot", [])])
    assert result == {}


def test_build_skips_none_ipa(patch_espeak_fallback):
    patch_espeak_fallback.return_value = make_fallback({})
    result = build_ipa_dict([("godot", [])])
    assert result == {}


def test_build_skips_word_on_fallback_exception(patch_espeak_fallback):
    fallback = MagicMock(side_effect=RuntimeError("espeak error"))
    patch_espeak_fallback.return_value = fallback
    result = build_ipa_dict([("godot", [])])
    assert result == {}


def test_build_returns_empty_dict_when_fallback_init_fails(patch_espeak_fallback):
    patch_espeak_fallback.side_effect = Exception("not installed")
    result = build_ipa_dict([("godot", [])])
    assert result == {}


def test_build_handles_multiple_entries(patch_espeak_fallback):
    patch_espeak_fallback.return_value = make_fallback({
        "godot": ("ɡˈɑdɑt", 2),
        "Tolkien": ("tɔlkˈin", 2),
        "DOS": ("dˈɑs", 2),
    })
    entries = [("godot", []), ("tolkien", ["$capital"]), ("dos", ["$allcaps"])]
    result = build_ipa_dict(entries)
    assert result == {
        "godot": "ɡˈɑdɑt",
        "Tolkien": "tɔlkˈin",
        "dos": "dˈɑs",
    }


def test_build_initialises_fallback_with_british_false(patch_espeak_fallback):
    patch_espeak_fallback.return_value = make_fallback({})
    build_ipa_dict([("godot", [])])
    patch_espeak_fallback.assert_called_once_with(british=False)
