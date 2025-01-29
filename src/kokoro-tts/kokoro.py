import re
from typing import Any, Dict, Generator, List, Literal, NewType, Tuple

import librosa
import numpy as np
import phonemizer
import torch

from models import Model

SAMPLE_RATE = 24000

Lang = NewType("Lang", Literal["a", "b"])


def clamp_speed(speed: int | float) -> float:
    if not isinstance(speed, float) and not isinstance(speed, int):
        return 1
    elif speed < 0.5:
        return 0.5
    elif speed > 2:
        return 2
    return speed


def clamp_trim(trim: int | float) -> float:
    if not isinstance(trim, float) and not isinstance(trim, int):
        return 0.5
    elif trim < 0:
        return 0
    elif trim > 1:
        return 0.5
    return trim


def trim_if_needed(out: np.ndarray, trim: float) -> np.ndarray:
    if not trim:
        return out
    a, b = librosa.effects.trim(out, top_db=30)[1]
    a = int(a * trim)
    b = int(len(out) - (len(out) - b) * trim)
    return out[a:b]


def split_num(num: re.Match) -> str:
    num = num.group()
    if '.' in num:
        return num
    elif ':' in num:
        h, m = [int(n) for n in num.split(':')]
        if m == 0:
            return f"{h} o'clock"
        elif m < 10:
            return f'{h} oh {m}'
        return f'{h} {m}'
    year = int(num[:4])
    if year < 1100 or year % 1000 < 10:
        return num
    left, right = num[:2], int(num[2:4])
    s = 's' if num.endswith('s') else ''
    if 100 <= year % 1000 <= 999:
        if right == 0:
            return f'{left} hundred{s}'
        elif right < 10:
            return f'{left} oh {right}{s}'
    return f'{left} {right}{s}'


def flip_money(m: re.Match) -> str:
    m = m.group()
    bill = 'dollar' if m[0] == '$' else 'pound'
    if m[-1].isalpha():
        return f'{m[1:]} {bill}s'
    elif '.' not in m:
        s = '' if m[1:] == '1' else 's'
        return f'{m[1:]} {bill}{s}'
    b, c = m[1:].split('.')
    s = '' if b == '1' else 's'
    c = int(c.ljust(2, '0'))
    coins = f"cent{'' if c == 1 else 's'}" if m[0] == '$' else ('penny' if c == 1 else 'pence')
    return f'{b} {bill}{s} and {c} {coins}'


def point_num(num: re.Match) -> str:
    a, b = num.group().split('.')
    return ' point '.join([a, ' '.join(b)])


def normalize_text(text: str) -> str:
    text = text.replace(chr(8216), "'").replace(chr(8217), "'")
    text = text.replace('«', chr(8220)).replace('»', chr(8221))
    text = text.replace(chr(8220), '"').replace(chr(8221), '"')
    text = text.replace('(', '«').replace(')', '»')
    for a, b in zip('、。！，：；？', ',.!,:;?'):
        text = text.replace(a, b + ' ')
    text = re.sub(r'[^\S \n]', ' ', text)
    text = re.sub(r'  +', ' ', text)
    text = re.sub(r'(?<=\n) +(?=\n)', '', text)
    text = re.sub(r'\bD[Rr]\.(?= [A-Z])', 'Doctor', text)
    text = re.sub(r'\b(?:Mr\.|MR\.(?= [A-Z]))', 'Mister', text)
    text = re.sub(r'\b(?:Ms\.|MS\.(?= [A-Z]))', 'Miss', text)
    text = re.sub(r'\b(?:Mrs\.|MRS\.(?= [A-Z]))', 'Mrs', text)
    text = re.sub(r'\betc\.(?! [A-Z])', 'etc', text)
    text = re.sub(r'(?i)\b(y)eah?\b', r"\1e'a", text)
    text = re.sub(r'\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)', split_num, text)
    text = re.sub(r'(?<=\d),(?=\d)', '', text)
    text = re.sub(
        r'(?i)[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b',
        flip_money,
        text
    )
    text = re.sub(r'\d*\.\d+', point_num, text)
    text = re.sub(r'(?<=\d)-(?=\d)', ' to ', text)
    text = re.sub(r'(?<=\d)S', ' S', text)
    text = re.sub(r"(?<=[BCDFGHJ-NP-TV-Z])'?s\b", "'S", text)
    text = re.sub(r"(?<=X')S\b", 's', text)
    text = re.sub(r'(?:[A-Za-z]\.){2,} [a-z]', lambda m: m.group().replace('.', '-'), text)
    text = re.sub(r'(?i)(?<=[A-Z])\.(?=[A-Z])', '-', text)
    return text.strip()


def get_vocab() -> Dict[str, int]:
    _pad = "$"
    _punctuation = ';:,.!?¡¿—…"«»“” '
    _letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    _letters_ipa = "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ"
    symbols = [_pad] + list(_punctuation) + list(_letters) + list(_letters_ipa)
    dicts = { }
    for i in range(len(symbols)):
        dicts[symbols[i]] = i
    return dicts


VOCAB = get_vocab()


def tokenize(ps: str) -> List[int]:
    return [i for i in map(VOCAB.get, ps) if i is not None]


phonemizers = dict(
    a=phonemizer.backend.EspeakBackend(language='en-us', preserve_punctuation=True, with_stress=True),
    b=phonemizer.backend.EspeakBackend(language='en-gb', preserve_punctuation=True, with_stress=True),
)


def phonemize(text: str, lang: Lang, norm=True) -> str:
    if norm:
        text = normalize_text(text, lang)
    ps = phonemizers[lang].phonemize([text])
    ps = ps[0] if ps else ''
    # https://en.wiktionary.org/wiki/kokoro#English
    ps = ps.replace('kəkˈoːɹoʊ', 'kˈoʊkəɹoʊ').replace('kəkˈɔːɹəʊ', 'kˈəʊkəɹəʊ')
    ps = ps.replace('ʲ', 'j').replace('r', 'ɹ').replace('x', 'k').replace('ɬ', 'l')
    ps = re.sub(r'(?<=[a-zɹː])(?=hˈʌndɹɪd)', ' ', ps)
    ps = re.sub(r' z(?=[;:,.!?¡¿—…"«»“” ]|$)', 'z', ps)
    if lang == 'a':
        ps = re.sub(r'(?<=nˈaɪn)ti(?!ː)', 'di', ps)
    ps = ''.join(filter(lambda p: p in VOCAB, ps))
    return ps.strip()


def length_to_mask(lengths: torch.Tensor) -> torch.Tensor:
    mask = torch.arange(lengths.max()).unsqueeze(0).expand(lengths.shape[0], -1).type_as(lengths)
    mask = torch.gt(mask + 1, lengths.unsqueeze(1))
    return mask


def resplit_strings(arr: List[str]) -> Tuple[str, str]:
    # Handle edge cases
    if not arr:
        return '', ''
    if len(arr) == 1:
        return arr[0], ''
    # Try each possible split point
    min_diff = float('inf')
    best_split = 0
    # Calculate lengths when joined with spaces
    lengths = [len(s) for s in arr]
    spaces = len(arr) - 1  # Total spaces needed
    # Try each split point
    left_len = 0
    right_len = sum(lengths) + spaces
    for i in range(1, len(arr)):
        # Add current word and space to left side
        left_len += lengths[i - 1] + (1 if i > 1 else 0)
        # Remove current word and space from right side
        right_len -= lengths[i - 1] + 1
        diff = abs(left_len - right_len)
        if diff < min_diff:
            min_diff = diff
            best_split = i
    # Join the strings with the best split point
    return ' '.join(arr[:best_split]), ' '.join(arr[best_split:])


def recursive_split(text: str, lang: Lang) -> List[Tuple[str, str, int]]:
    if not text:
        return []
    tokens = phonemize(text, lang, norm=False)
    if len(tokens) < 511:
        return [(text, tokens, len(tokens))] if tokens else []
    if ' ' not in text:
        return []
    for punctuation in ['!.?…', ':;', ',—']:
        splits = re.split(
            f'(?:(?<=[{punctuation}])|(?<=[{punctuation}]["\'»])|(?<=[{punctuation}]["\'»]["\'»])) ',
            text
        )
        if len(splits) > 1:
            break
        else:
            splits = None
    splits = splits or text.split(' ')
    a, b = resplit_strings(splits)
    return recursive_split(a, lang) + recursive_split(b, lang)


# def segment_and_tokenize(text, voice, lang, skip_square_brackets=True, newline_split=2):
def segment_and_tokenize(text: str, lang: Lang, newline_split: int = 2) -> list[tuple[int, str, str, int]]:
    # if skip_square_brackets:
    #     text = re.sub(r'\[.*?\]', '', text)
    texts = [t.strip() for t in
             re.split('\n{' + str(newline_split) + ',}', normalize_text(text))] if newline_split > 0 else [
        normalize_text(text)]
    segments = [row for t in texts for row in recursive_split(t, lang)]
    return [(i, row[0], row[1], row[2]) for i, row in enumerate(segments)]


@torch.no_grad()
def forward(
    model: Model,
    token_lists: List[List[int]],
    voicepack: Any,
    speed: float,
    device: Literal["cpu", "cuda"] = 'cuda'
) -> List[np.ndarray]:
    outs = []
    for tokens in token_lists:
        ref_s = voicepack[len(tokens)]
        s = ref_s[:, 128:]
        tokens = torch.LongTensor([[0, *tokens, 0]]).to(device)
        input_lengths = torch.LongTensor([tokens.shape[-1]]).to(device)
        text_mask = length_to_mask(input_lengths).to(device)
        bert_dur = model.bert(tokens, attention_mask=(~text_mask).int())
        d_en = model.bert_encoder(bert_dur).transpose(-1, -2)
        d = model.predictor.text_encoder(d_en, s, input_lengths, text_mask)
        x, _ = model.predictor.lstm(d)
        duration = model.predictor.duration_proj(x)
        duration = torch.sigmoid(duration).sum(axis=-1) / speed
        pred_dur = torch.round(duration).clamp(min=1).long()
        pred_aln_trg = torch.zeros(input_lengths, pred_dur.sum().item())
        c_frame = 0
        for i in range(pred_aln_trg.size(0)):
            pred_aln_trg[i, c_frame:c_frame + pred_dur[0, i].item()] = 1
            c_frame += pred_dur[0, i].item()
        en = d.transpose(-1, -2) @ pred_aln_trg.unsqueeze(0).to(device)
        F0_pred, N_pred = model.predictor.F0Ntrain(en, s)
        t_en = model.text_encoder(tokens, input_lengths, text_mask)
        asr = t_en @ pred_aln_trg.unsqueeze(0).to(device)
        outs.append(model.decoder(asr, F0_pred, N_pred, ref_s[:, :128]).squeeze().cpu().numpy())

    return outs


# def lf_generate(segments, voice, speed=1, trim=0, pad_between=0, use_gpu=True, sk=None):
def lf_generate(
    model: Model,
    segments: List[Tuple[int, str, str, int]],
    voicepack: Any,
    speed: int | float = 1,
    trim: int | float = 0,
    pad_between: bool = True
) -> Generator[np.ndarray, None, None]:
    token_lists = list(map(tokenize, [s[2] for s in segments]))
    speed = clamp_speed(speed)
    trim = clamp_trim(trim)
    pad_between = int(pad_between)
    batch_sizes = [89, 55, 34, 21, 13, 8, 5, 3, 2, 1, 1]
    i = 0
    outs = None
    while i < len(token_lists):
        bs = batch_sizes.pop() if batch_sizes else 100
        tokens = token_lists[i:i + bs]
        try:
            outs = forward(model, tokens, voicepack, speed)
        except:
            if outs:
                i = len(token_lists)
            else:
                raise
        for out in outs:
            if i > 0 and pad_between > 0:
                yield np.zeros(pad_between)
            out = trim_if_needed(out, trim)
            yield out
        i += bs


def generate(
    model: Model,
    text: str,
    voicepack: Any,
    lang: Lang = 'a',
    speed: int = 1,
    newline_split: int = 2
) -> np.ndarray:
    segments = segment_and_tokenize(text, lang, newline_split=newline_split)

    # NOTE: For some reason, the padding causes Firefox to play audio silently.
    audio_segments = list(lf_generate(model, segments, voicepack, speed=speed, pad_between=False))

    return np.concatenate(audio_segments)
