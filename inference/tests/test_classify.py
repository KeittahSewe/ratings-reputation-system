"""Tests /classify and the X-Service-Key check against the real model.

Needs HF_REPO_ID and HF_REVISION set, as for running the service. The model is
loaded once for the whole file.
"""

import os

import pytest
from fastapi.testclient import TestClient

from app.main import MAX_BATCH, MAX_TEXT_CHARS, app
KEY = "test-key"

# One clear case per class, in the style of the marketplace reviews. The
# neutral one is a plain description of the job, which the labelling guideline
# treats as neutral. The model gets it wrong, and the test records that rather
# than swapping in an easier sentence. strict=True means the test fails if a
# future model starts getting it right, so the note never goes stale.
CANONICAL = [
    pytest.param(
        "Peter fixed the kitchen plumbing quickly and left everything clean. Very professional, I will hire him again.",
        "positive",
        id="positive",
    ),
    pytest.param(
        "He came three hours late, overcharged me for parts and the tap was leaking again the next day.",
        "negative",
        id="negative",
    ),
    pytest.param(
        "The job was to replace the kitchen tap and fix the pipe under the sink.",
        "neutral",
        id="neutral-factual",
        marks=pytest.mark.xfail(
            strict=True,
            reason="Known model error: negative 0.52 over neutral 0.42. The service reproduces "
            "06_evaluation exactly (257/390, macro-F1 0.6589), so the miss is the model's.",
        ),
    ),
]

@pytest.fixture(scope="module")
def client():
    previous = os.environ.get("INFERENCE_SERVICE_KEY")
    os.environ["INFERENCE_SERVICE_KEY"] = KEY
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        if previous is None:
            os.environ.pop("INFERENCE_SERVICE_KEY", None)
        else:
            os.environ["INFERENCE_SERVICE_KEY"] = previous


def post_classify(client, body, key=KEY):
    headers = {} if key is None else {"X-Service-Key": key}
    return client.post("/classify", json=body, headers=headers)


@pytest.mark.parametrize("text, expected", CANONICAL)
def test_canonical_examples(client, text, expected):
    response = post_classify(client, {"text": text})
    assert response.status_code == 200
    body = response.json()

    assert body["label"] == expected
    probabilities = body["probabilities"]
    assert list(probabilities) == ["negative", "neutral", "positive"]
    assert body["confidence"] == max(probabilities.values())
    assert abs(sum(probabilities.values()) - 1) < 0.001
    assert body["model_version"] == client.get("/health").json()["model_version"]
    assert isinstance(body["latency_ms"], int)


def test_missing_key_gets_401(client):
    response = post_classify(client, {"text": "Good work."}, key=None)
    assert response.status_code == 401
    assert response.json() == {"error": {"code": "unauthorized", "message": "Missing or wrong X-Service-Key header"}}


def test_wrong_key_gets_401(client):
    response = post_classify(client, {"text": "Good work."}, key="not-the-key")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_health_needs_no_key(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.parametrize("body", [{"text": ""}, {"text": "   "}, {"text": "<b></b>"}, {}, {"text": 5}])
def test_empty_missing_or_wrong_text_gets_422(client, body):
    response = post_classify(client, body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert response.json()["error"]["message"].startswith("text: ")


def test_text_over_the_limit_gets_422(client):
    response = post_classify(client, {"text": "a" * (MAX_TEXT_CHARS + 1)})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"

 

def post_batch(client, body, key=KEY):
    headers = {} if key is None else {"X-Service-Key": key}
    return client.post("/classify/batch", json=body, headers=headers)


def test_batch_matches_classify_in_input_order(client):
    texts = [param.values[0] for param in CANONICAL] + ["Good work, but he left the gate open."]
    response = post_batch(client, {"texts": texts})
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == len(texts)
    for text, result in zip(texts, results):
        single = post_classify(client, {"text": text}).json()
        # latency_ms is timed per call, so it is the only field allowed to differ.
        single.pop("latency_ms")
        result.pop("latency_ms")
        assert result == single


def test_batch_without_key_gets_401(client):
    response = post_batch(client, {"texts": ["Good work."]}, key=None)
    assert response.status_code == 401


@pytest.mark.parametrize(
    "texts",
    [[], ["Good work."] * (MAX_BATCH + 1), ["Good work.", "   "], ["Good work.", "a" * (MAX_TEXT_CHARS + 1)]],
    ids=["empty-list", "over-the-cap", "empty-item", "over-long-item"],
)
def test_batch_bad_input_gets_422(client, texts):
    response = post_batch(client, {"texts": texts})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert response.json()["error"]["message"].startswith("texts")   