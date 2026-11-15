"""Loads the deployed sentiment model once, when the service starts."""

import json
import math
from dataclasses import dataclass

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

# The order the model's three outputs come in. The service refuses any other order.
EXPECTED_LABELS = ["negative", "neutral", "positive"]

REQUIRED_CARD_KEYS = ["model_version", "temperature", "labels", "max_length"]


class ModelLoadError(RuntimeError):
    """Raised when the model files are present but cannot be used."""


@dataclass
class LoadedModel:
    session: ort.InferenceSession
    tokenizer: Tokenizer
    model_version: str
    temperature: float
    labels: list
    max_length: int


def read_card(model_dir):
    """Reads model_card.json and checks every value the service relies on."""
    path = model_dir / "model_card.json"
    try:
        card = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ModelLoadError(f"Could not read {path}: {exc}") from exc

    missing = [key for key in REQUIRED_CARD_KEYS if key not in card]
    if missing:
        raise ModelLoadError(f"model_card.json is missing {', '.join(missing)}.")
    if not isinstance(card["model_version"], str) or not card["model_version"].strip():
        raise ModelLoadError("model_version in model_card.json is empty.")
    temperature = card["temperature"]
    if not isinstance(temperature, (int, float)) or not math.isfinite(temperature) or temperature <= 0:
        raise ModelLoadError(f"temperature in model_card.json must be a positive number, got {temperature!r}.")
    if card["labels"] != EXPECTED_LABELS:
        raise ModelLoadError(f"labels in model_card.json must be {EXPECTED_LABELS}, got {card['labels']}.")
    if not isinstance(card["max_length"], int) or card["max_length"] <= 0:
        raise ModelLoadError(f"max_length in model_card.json must be a positive whole number, got {card['max_length']!r}.")
    return card


def load_tokenizer(model_dir, max_length):
    """Loads tokenizer.json and cuts every input at max_length tokens, as in 06_evaluation."""
    try:
        tokenizer = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
    except Exception as exc:
        raise ModelLoadError(f"Could not load tokenizer.json: {exc}") from exc
    tokenizer.enable_truncation(max_length=max_length)
    tokenizer.no_padding()
    return tokenizer


def load_session(model_dir):
    """Opens model.onnx on the CPU with one thread, the setting the latency was measured with."""
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    try:
        session = ort.InferenceSession(str(model_dir / "model.onnx"), options, providers=["CPUExecutionProvider"])
    except Exception as exc:
        raise ModelLoadError(f"Could not open model.onnx: {exc}") from exc

    inputs = {i.name for i in session.get_inputs()}
    outputs = {o.name for o in session.get_outputs()}
    if inputs != {"input_ids", "attention_mask"} or "logits" not in outputs:
        raise ModelLoadError(
            f"model.onnx should take input_ids and attention_mask and return logits, "
            f"but takes {sorted(inputs)} and returns {sorted(outputs)}."
        )
    return session


def check_one_prediction(session, tokenizer):
    """Runs one sentence through the model so a broken file fails now, not on the first review."""
    encoding = tokenizer.encode("The plumber arrived on time and fixed the leak.")
    feed = {
        "input_ids": np.array([encoding.ids], dtype=np.int64),
        "attention_mask": np.array([encoding.attention_mask], dtype=np.int64),
    }
    try:
        logits = session.run(["logits"], feed)[0]
    except Exception as exc:
        raise ModelLoadError(f"model.onnx failed on a test sentence: {exc}") from exc
    if logits.shape != (1, len(EXPECTED_LABELS)):
        raise ModelLoadError(f"model.onnx returned logits of shape {logits.shape}, expected (1, 3).")


def load_model(model_dir):
    """Loads the card, tokenizer and ONNX session, and checks they work together."""
    card = read_card(model_dir)
    tokenizer = load_tokenizer(model_dir, card["max_length"])
    session = load_session(model_dir)
    check_one_prediction(session, tokenizer)
    return LoadedModel(
        session=session,
        tokenizer=tokenizer,
        model_version=card["model_version"],
        temperature=float(card["temperature"]),
        labels=card["labels"],
        max_length=card["max_length"],
    )