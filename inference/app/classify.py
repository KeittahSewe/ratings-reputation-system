"""Turns one review into a label, a calibrated confidence and three probabilities."""

import time

import numpy as np

from app.text import clean_text


def calibrated_probabilities(logits, temperature):
    """Softmax of logits / temperature, as fitted in 06_evaluation. The largest class never changes."""
    scaled = logits / temperature
    scaled = scaled - scaled.max()
    exp = np.exp(scaled)
    return exp / exp.sum()


def classify(model, text):
    """Cleans the text, runs the model and returns the /classify response body."""
    started = time.perf_counter()

    encoding = model.tokenizer.encode(clean_text(text))
    feed = {
        "input_ids": np.array([encoding.ids], dtype=np.int64),
        "attention_mask": np.array([encoding.attention_mask], dtype=np.int64),
    }
    logits = model.session.run(["logits"], feed)[0][0].astype(np.float64)
    probabilities = calibrated_probabilities(logits, model.temperature)
    best = int(probabilities.argmax())

    return {
        "label": model.labels[best],
        "confidence": round(float(probabilities[best]), 4),
        "probabilities": {name: round(float(p), 4) for name, p in zip(model.labels, probabilities)},
        "model_version": model.model_version,
        "latency_ms": round((time.perf_counter() - started) * 1000),
    }