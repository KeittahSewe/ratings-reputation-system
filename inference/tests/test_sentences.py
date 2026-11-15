"""Checks how reviews are split into sentences for theme extraction."""

import pytest

from app.classify import split_sentences
from app.text import clean_text


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Fixed the leak. Arrived late! Would I hire him again? Yes.",
         ["fixed the leak.", "arrived late!", "would i hire him again?", "yes."]),
        ("Good work and fair price", ["good work and fair price"]),
        ("Mr. Kamau fixed it. Great job.", ["mr. kamau fixed it.", "great job."]),
        ("Charged KSh 2.5k for parts. Fair.", ["charged ksh 2.5k for parts.", "fair."]),
        ("Good work... but late.", ["good work...", "but late."]),
        ("Clean finish.   Left on time.  ", ["clean finish.", "left on time."]),
    ],
    ids=["four-sentences", "no-full-stop", "abbreviation", "decimal", "ellipsis", "extra-spaces"],
)
def test_split_sentences(raw, expected):
    assert split_sentences(clean_text(raw)) == expected