"""Checks the service reproduces the notebook's predictions on the frozen marketplace set.

ml/results/market_reference_int8.csv holds the logits the int8 export gave for
each of the 390 reviews in Colab (ml/08_reference_predictions.ipynb), using the
transformers tokenizer as 06_evaluation did. This test runs the service's own
pipeline (clean_text, tokenizers, ONNX Runtime, temperature scaling) over the
same reviews and compares. Needs HF_REPO_ID and HF_REVISION, like the service.

Tolerance: the int8 matrix multiplications can round differently on different
CPUs, so values are allowed to differ slightly. A label may only differ where
the reference itself is a near tie.
"""

import csv
import json
from pathlib import Path

import numpy as np
import pytest

from app.classify import calibrated_probabilities, classify
from app.model import load_model
from app.model_files import ensure_model_files

ML_DIR = Path(__file__).resolve().parents[2] / "ml"
LABELS = ["negative", "neutral", "positive"]

PROBABILITY_TOLERANCE = 0.02  # largest allowed gap in any calibrated probability
NEAR_TIE = 0.02  # a label may differ only if the reference's top two are this close
MACRO_F1_TOLERANCE = 0.005  # allowed gap from model_card.json's market_macro_f1_seed_exported


def macro_f1(true, pred):
    scores = []
    for label in LABELS:
        tp = sum(t == label and p == label for t, p in zip(true, pred))
        fp = sum(t != label and p == label for t, p in zip(true, pred))
        fn = sum(t == label and p != label for t, p in zip(true, pred))
        scores.append(2 * tp / (2 * tp + fp + fn))
    return sum(scores) / len(scores)


@pytest.fixture(scope="module")
def comparison():
    model_dir = ensure_model_files()
    model = load_model(model_dir)
    card = json.loads((model_dir / "model_card.json").read_text(encoding="utf-8"))

    with open(ML_DIR / "data" / "market_test.csv", encoding="utf-8", newline="") as f:
        reviews = list(csv.DictReader(f))
    with open(ML_DIR / "results" / "market_reference_int8.csv", encoding="utf-8", newline="") as f:
        reference = {row["id"]: row for row in csv.DictReader(f)}

    rows = []
    for review in reviews:
        ref = reference[review["id"]]
        logits = np.array([float(ref[f"logit_{name}"]) for name in LABELS])
        ref_probs = calibrated_probabilities(logits, model.temperature)
        top_two = np.sort(ref_probs)[-2:]
        result = classify(model, review["text"])
        rows.append({
            "id": review["id"],
            "true": LABELS[int(review["label"])],
            "reference_label": LABELS[int(ref_probs.argmax())],
            "service_label": result["label"],
            "gap": max(abs(result["probabilities"][name] - ref_probs[i]) for i, name in enumerate(LABELS)),
            "near_tie": top_two[1] - top_two[0] < NEAR_TIE,
            "reference_version": ref["model_version"],
        })
    return {"rows": rows, "reference_ids": set(reference), "card": card, "model": model}


def test_reference_covers_the_frozen_set(comparison):
    assert len(comparison["rows"]) == 390
    assert comparison["reference_ids"] == {row["id"] for row in comparison["rows"]}


def test_reference_comes_from_the_deployed_model(comparison):
    versions = {row["reference_version"] for row in comparison["rows"]}
    assert versions == {comparison["model"].model_version}


def test_probabilities_within_tolerance(comparison):
    worst = max(row["gap"] for row in comparison["rows"])
    assert worst <= PROBABILITY_TOLERANCE, f"largest probability gap {worst:.4f}"


def test_labels_agree_except_near_ties(comparison):
    disagreements = [row["id"] for row in comparison["rows"]
                     if row["service_label"] != row["reference_label"] and not row["near_tie"]]
    assert disagreements == []


def test_macro_f1_matches_model_card(comparison):
    rows = comparison["rows"]
    score = macro_f1([r["true"] for r in rows], [r["service_label"] for r in rows])
    expected = comparison["card"]["metrics"]["market_macro_f1_seed_exported"]
    assert abs(score - expected) <= MACRO_F1_TOLERANCE, f"service {score:.4f}, model card {expected}"