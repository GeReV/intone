import pytest

from engines.auto.engine import _is_hebrew


def test_pure_hebrew_is_true():
    assert _is_hebrew("שלום עולם") is True


def test_pure_english_is_false():
    assert _is_hebrew("Hello world") is False


def test_hebrew_with_embedded_english_is_true():
    # Israeli page: Hebrew article with English proper nouns, ~60% Hebrew chars
    assert _is_hebrew("הממשלה הישראלית פגשה את Netanyahu בירושלים") is True


def test_english_with_one_hebrew_word_is_false():
    # English sentence quoting a single Hebrew word: ~5% Hebrew chars
    assert _is_hebrew("The word for peace in Hebrew is שלום and it is widely used") is False


def test_empty_string_is_false():
    assert _is_hebrew("") is False


def test_numbers_only_is_false():
    assert _is_hebrew("12345 67890") is False


def test_punctuation_only_is_false():
    assert _is_hebrew("!@#$%^&*()") is False


def test_exactly_at_threshold_is_true():
    # 2 Hebrew letters out of 10 alphabetic = 20% → True
    assert _is_hebrew("abcdefghשם") is True


def test_just_below_threshold_is_false():
    # 1 Hebrew letter out of 10 alphabetic = 10% → False
    assert _is_hebrew("abcdefghijש") is False
