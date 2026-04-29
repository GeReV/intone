import re
import inflect
from num2words import num2words

from .ner.stanford import StanfordNERTagger

# Regex to handle 4-digit years, centuries and decades (1200s, 1990s, 70s)
year_regex = re.compile("^(?:[0-9]{4}s?|[0-9]{2}s)$")

p = inflect.engine()
st = StanfordNERTagger('english.muc.7class.distsim.crf.ser.gz', encoding='utf8')


def translate_years(s):
    def repl(match):
        m = match.group(0)
        plurals = m.endswith('s')
        year = int(m.rstrip('s'))

        words = num2words(year, to='cardinal' if year < 100 else 'year')

        if plurals:
            words = p.plural(words)

        return words

    return year_regex.sub(repl, s)


def expand_named_entities(text):
    result = st.tag(text)

    words = []
    for word, kind in result:
        match kind:
            case 'DATE':
                word = translate_years(word)

        words.append(word)

    return " ".join(words)

