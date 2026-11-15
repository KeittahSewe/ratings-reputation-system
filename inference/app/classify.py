"""Turns one review into a label, a calibrated confidence and three probabilities."""

import re
import time

import numpy as np

from app.text import clean_text

# A sentence ends at . ! or ? followed by a space. clean_text has already
# lowercased the text and removed spaces before punctuation, so this is enough
# for review text. Decimals such as 2.5 have no space after the dot and stay whole.
SENTENCE_END = re.compile(r"(?<=[.!?])\s+")

# Short forms whose dot does not end a sentence: "mr. kamau fixed it" stays one.
ABBREVIATIONS = {"mr.", "mrs.", "ms.", "dr.", "st.", "no.", "e.g.", "i.e.", "vs."}


def split_sentences(cleaned):
    """Splits text that has already been through clean_text into sentences."""
    sentences = []
    for part in SENTENCE_END.split(cleaned):
        if sentences and sentences[-1].split()[-1] in ABBREVIATIONS:
            sentences[-1] = f"{sentences[-1]} {part}"
        elif part:
            sentences.append(part)
    return sentences


def calibrated_probabilities(logits, temperature):
    """Softmax of logits / temperature, as fitted in 06_evaluation. The largest class never changes."""
    scaled = logits / temperature
    scaled = scaled - scaled.max()
    exp = np.exp(scaled)
    return exp / exp.sum()


def predict(model, cleaned):
    """Runs already-cleaned text through the model and returns the calibrated probabilities."""
    encoding = model.tokenizer.encode(cleaned)
    feed = {
        "input_ids": np.array([encoding.ids], dtype=np.int64),
        "attention_mask": np.array([encoding.attention_mask], dtype=np.int64),
    }
    logits = model.session.run(["logits"], feed)[0][0].astype(np.float64)
    return calibrated_probabilities(logits, model.temperature)


def classify(model, text, sentences=False):
    """Cleans the text, runs the model and returns the /classify response body.

    With sentences=True the body also lists every sentence with its own label
    and confidence, for the insights theme extraction.
    """
    started = time.perf_counter()

    cleaned = clean_text(text)
    probabilities = predict(model, cleaned)
    best = int(probabilities.argmax())
    result = {
        "label": model.labels[best],
        "confidence": round(float(probabilities[best]), 4),
        "probabilities": {name: round(float(p), 4) for name, p in zip(model.labels, probabilities)},
        "model_version": model.model_version,
    }

    if sentences:
        result["sentences"] = []
        for sentence in split_sentences(cleaned):
            sentence_probabilities = predict(model, sentence)
            sentence_best = int(sentence_probabilities.argmax())
            result["sentences"].append({
                "text": sentence,
                "label": model.labels[sentence_best],
                "confidence": round(float(sentence_probabilities[sentence_best]), 4),
            })

    result["latency_ms"] = round((time.perf_counter() - started) * 1000)
    return result