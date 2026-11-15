"""Checks that the service's clean_text behaves exactly like the notebook's."""

import csv
from pathlib import Path

import pytest

from app.text import clean_text

# The six checks from ml/01_data_prep.ipynb, cell 10, unchanged.
NOTEBOOK_CHECKS = {
    "it 's a movie that does n't quite work , but -lrb- mostly -rrb- fun .": "it's a movie that doesn't quite work, but (mostly) fun.",
    "ca n't wait ; wo n't stop !": "can't wait; won't stop!",
    "Fixed the leak &amp; left it <b>clean</b>.  Will call him again": "fixed the leak & left it clean. will call him again",
    "He\u2019s a good fundi \u2014 paid via M-Pesa": "he's a good fundi - paid via m-pesa",
    "a remake of `` the ring '' , sadly .": 'a remake of "the ring", sadly.',
    "a writer\\/director 's \\*\\*\\* film .": "a writer/director's *** film.",
}

DATA = Path(__file__).resolve().parents[2] / "ml" / "data"


@pytest.mark.parametrize("raw, expected", list(NOTEBOOK_CHECKS.items()))
def test_notebook_checks(raw, expected):
    assert clean_text(raw) == expected


def read_rows(path):
    with open(path, encoding="utf-8", newline="") as f:
        return {row["id"]: row for row in csv.DictReader(f)}


def test_market_test_set_matches_notebook_output():
    # market_labelled.csv holds the raw review text; market_test.csv holds what
    # 01_data_prep wrote after cleaning it, minus the rows labelled remove.
    labelled = read_rows(DATA / "market_drafting" / "market_labelled.csv")
    frozen = read_rows(DATA / "market_test.csv")

    kept = {i for i, row in labelled.items() if row["label"].strip().lower() != "remove"}
    assert len(frozen) == 390
    assert kept == set(frozen)

    mismatched = [i for i in frozen if clean_text(labelled[i]["text"]) != frozen[i]["text"]]
    assert mismatched == []