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
| `INFERENCE_SERVICE_KEY` | Shared key the Express API must send. Not checked yet. |
| `PORT` | Port to listen on. Locally this is 8000. |

`.env.example` lists them. The service reads them with `os.environ` and does not load a `.env` file by itself. Locally, set them in the PowerShell window before running anything:

```powershell
$env:HF_REPO_ID = "KeittahSewe/ratings-reputation-sentiment"
$env:HF_REVISION = "fd22fadb091b8795acd22c802b2552f8c3d1dab7"
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
| 404 | `not_found` | No route matches the path |
| 405 | `method_not_allowed` | The path exists but not for that method |
| 500 | `internal_error` | An unexpected error in the service |