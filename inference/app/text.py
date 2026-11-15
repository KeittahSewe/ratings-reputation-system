"""Text cleaning, copied unchanged from ml/01_data_prep.ipynb (cell 10).

The model was trained and evaluated on text cleaned by this function, so the
service must clean every review the same way before classifying it. Do not
edit this function on its own: a change here without retraining means the
model sees text in a form it never saw in training. tests/test_text.py checks
that it still matches the notebook.
"""

import html
import re
import unicodedata

PTB_BRACKETS = {'-lrb-': '(', '-rrb-': ')', '-lsb-': '[', '-rsb-': ']', '-lcb-': '{', '-rcb-': '}'}
CHAR_MAP = {'\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"',
            '\u2013': '-', '\u2014': '-', '\u00a0': ' '}

def clean_text(text: str) -> str:
    t = html.unescape(str(text))                                # &amp; -> &  (marketplace only)
    t = re.sub(r'<[^>]+>', ' ', t)                              # HTML tags   (marketplace only)
    t = unicodedata.normalize('NFKC', t)                        # one form per character, accents kept
    t = ''.join(CHAR_MAP.get(c, c) for c in t)                  # curly quotes and long dashes to plain
    t = re.sub(r'[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\ufeff]', '', t)  # invisible characters
    t = t.lower()                                               # SST-5 has 0 uppercase letters
    for tok, ch in PTB_BRACKETS.items():
        t = t.replace(tok, ch)                                  # 344 sentences
    t = re.sub(r'\\([/*])', r'\1', t)                          # 111 \/ and 25 \* : writer\/director -> writer/director
    t = re.sub(r'``\s*', '"', t)                                # 223 sentences: `` the ring '' -> "the ring"
    t = re.sub(r"\s*''", '"', t)
    t = re.sub(r" n't\b", "n't", t)                             # 647 sentences
    t = re.sub(r" '(s|re|ve|ll|d|m)\b", r"'\1", t)              # 2,449 sentences
    t = re.sub(r' ([.,!?;:%)\]}])', r'\1', t)                   # 8,454 sentences
    t = re.sub(r'([(\[{$]) ', r'\1', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t