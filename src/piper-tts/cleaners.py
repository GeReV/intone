import re

from .utils.entities import expand_named_entities
from .utils.abbreviations import abbreviations_en, months_en
from .utils.units import expand_units


def expand_abbreviations(text):
    for regex, replacement in abbreviations_en:
        text = re.sub(regex, replacement, text)
    return text


def expand_months(text):
    for regex, replacement in months_en:
        text = re.sub(regex, replacement, text)
    return text


def clean(text):
    # Improve list numbering pronunciation.
    text = re.sub(r"^(\d+)\. ", r"\1: ", text, flags=re.MULTILINE)

    # Correct pronunciation of dollars.
    text = re.sub(r"\$([\d,.]+\s+dollars?)", r"\1", text)  # Remove dollar sign to prevent "dollar X dollar(s)".
    text = re.sub(r"\$([\d,.]+)", r"\1 $", text)  # Move dollar sign to end to prevent "dollar X".

    # Replace em and en dashes with commas.
    text = re.sub("[—–]", ", ", text)

    # Add pauses around parentheses.
    text = re.sub(r"/\s+(\([^)]+\))\b", r", \1,", text)

    # 10x10 -> 10 by 10
    text = re.sub(r"\b(\d+)\s?[x×]\s?(\d+)\b", r"\1 by \2", text)

    text = expand_named_entities(text)
    text = expand_months(text)
    text = expand_units(text)
    text = expand_abbreviations(text)

    return text
