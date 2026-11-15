# inference

FastAPI service that serves the selected sentiment model and returns a label, confidence and model version for each review. Deployed on Render.

The model lives in the public Hugging Face repo [KeittahSewe/ratings-reputation-sentiment](https://huggingface.co/KeittahSewe/ratings-reputation-sentiment). The service downloads one pinned commit of it and reads the model version and temperature from that commit's `model_card.json`.

## Requirements

- Python 3.11, called with `py -3.11`. Do not use Python 3.14.

## Setup

From the `inference` folder, create a virtual environment and install the packages:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

All commands run Python through `.venv\Scripts\python`, so there is no need to activate the virtual environment.

## Environment variables

| Variable | What it is |
|---|---|
| `HF_REPO_ID` | Hugging Face repo holding the model: `KeittahSewe/ratings-reputation-sentiment` |
| `HF_REVISION` | Full 40-character commit hash of that repo. A branch name such as `main` is refused, so the model cannot change without this value changing. |
| `MODEL_DIR` | Folder the model files are downloaded to. Defaults to `model`, which Git ignores. |
| `INFERENCE_SERVICE_KEY` | Shared key the Express API sends in the `X-Service-Key` header. Required: the service will not start without it. |
| `PORT` | Port to listen on. Locally this is 8000. |

`.env.example` lists them. The service reads them with `os.environ` and does not load a `.env` file by itself. Locally, set them in the PowerShell window before running anything:

```powershell
$env:HF_REPO_ID = "KeittahSewe/ratings-reputation-sentiment"
$env:HF_REVISION = "fd22fadb091b8795acd22c802b2552f8c3d1dab7"
$env:INFERENCE_SERVICE_KEY = "local-dev-key"
```

On Render, set them in the service's Environment settings. Never commit real values of `INFERENCE_SERVICE_KEY`.

## Get the model

```powershell
.venv\Scripts\python -m app.model_files
```

This downloads `model.onnx`, `tokenizer.json`, `tokenizer_config.json` and `model_card.json` at `HF_REVISION` into `MODEL_DIR`, and writes a `REVISION` file recording which commit is on disk. It takes about a minute the first time. If the files for that revision are already there, it does nothing. The service also runs this check at startup, so this step is optional locally.

## Run

```powershell
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

`--reload` restarts the server when a file changes.

At startup the service checks `model_card.json` (model version, a positive temperature, labels in the order negative, neutral, positive, and max length), loads the tokenizer with truncation at that max length, opens `model.onnx` with ONNX Runtime on one CPU thread, and classifies one test sentence. If any of this fails, it logs a line starting `Startup failed:` and exits instead of running without a model.

Check that it is running:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

This returns `{ "status": "ok", "model_version": "distilbert-sst5-3cls-v1.0-20261111-seed43-onnx-int8" }`.

## Classify

Every route except `/health` needs the `X-Service-Key` header. Send a review as JSON:

```powershell
$headers = @{ "X-Service-Key" = $env:INFERENCE_SERVICE_KEY }
Invoke-RestMethod http://localhost:8000/classify -Method Post -Headers $headers -ContentType "application/json" -Body '{"text": "Peter fixed the kitchen plumbing quickly and left everything clean. Very professional, I will hire him again."}'
```

The text is cleaned with `clean_text` (the same function as `ml/01_data_prep.ipynb`), tokenised with truncation at 128 tokens and run through the model. The response:

| Field | What it is |
|---|---|
| `label` | `negative`, `neutral` or `positive` |
| `confidence` | The largest of the three probabilities |
| `probabilities` | Negative, neutral and positive, after temperature scaling with the temperature in `model_card.json`. Scaling changes the confidence, never the label. |
| `model_version` | From `model_card.json`, stored with every result in `sentiment_results` |
| `latency_ms` | Time spent cleaning, tokenising and classifying, in whole milliseconds |

`text` must be at most 5,000 characters and must not be empty after cleaning.

## Classify a batch

`POST /classify/batch` takes up to 32 texts, for the seeding script:

```powershell
Invoke-RestMethod http://localhost:8000/classify/batch -Method Post -Headers $headers -ContentType "application/json" -Body '{"texts": ["Very professional, I will hire him again.", "He never came back to finish the job."]}'
```

It returns `{ "results": [...] }`, one result per text in the same order, each with the same fields `/classify` gives. Each text is classified on its own, so a result is identical to sending that text to `/classify`. The request is rejected with 422 if the list is empty, has more than 32 texts, or any text is over 5,000 characters or empty after cleaning; the message names the item.


## Tests

```powershell
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest -v
```

Set `HF_REPO_ID` and `HF_REVISION` first. `tests/test_classify.py` loads the real model and sets its own service key.

`tests/test_text.py` checks that `app/text.py` cleans text exactly as `ml/01_data_prep.ipynb` did. It runs the notebook's six checks, then rebuilds all 390 reviews in `ml/data/market_test.csv` from the raw text in `market_labelled.csv`.

`tests/test_classify.py` checks the key (401 without it), input validation (422 for empty, missing, wrong-type or over-long text) and one example per class. The neutral example, a plain job description, is a known model error: the model gives negative 0.52 over neutral 0.42. It is marked as an expected failure with `strict=True`, so the run reports `1 xfailed`, and the test fails if a future model gets it right. On all 390 frozen marketplace reviews the service scores 257 correct and macro-F1 0.6589, the same as `06_evaluation` measured for this export.

pytest is in `requirements-dev.txt`, so Render does not install it.

## Render

| Setting | Value |
|---|---|
| Root directory | `inference` |
| Build command | `pip install -r requirements.txt && python -m app.model_files` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Extra environment variable | `PYTHON_VERSION` = `3.11.9`, so Render uses the same Python as local runs |

The model is downloaded in the build command because Render discards files a running service writes whenever it restarts or wakes from sleep. Files written during the build are part of the deployed service, so a cold start loads the model from disk without downloading it again.

## Errors

Error responses use the same format as the Express API:

```json
{ "error": { "code": "not_found", "message": "No route for GET /unknown" } }
```

| Status | Code | When |
|---|---|---|
| 401 | `unauthorized` | `X-Service-Key` is missing or wrong, on any route except `/health` |
| 404 | `not_found` | No route matches the path |
| 405 | `method_not_allowed` | The path exists but not for that method |
| 422 | `invalid_request` | The request body is not valid, for example empty `text`. The message names the field. |
| 500 | `internal_error` | An unexpected error in the service |