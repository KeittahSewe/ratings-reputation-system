# inference

FastAPI service that serves the selected sentiment model and returns a label, confidence and model version for each review. Deployed on Render.

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
| `MODEL_PATH` | Path to the ONNX model file. Not used yet. |
| `MODEL_VERSION` | Version name reported with each result. Not used yet. |
| `INFERENCE_SERVICE_KEY` | Shared key the Express API must send. Not checked yet. |
| `PORT` | Port to listen on. Locally this is 8000. |

`.env.example` lists them with placeholder values. The service reads them with `os.environ` and does not load a `.env` file by itself. Locally, set them in the PowerShell window before starting the server:

```powershell
$env:MODEL_VERSION = "distilbert-v1"
```

On Render, set them in the service's Environment settings. Never commit real values.

## Run

```powershell
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

`--reload` restarts the server when a file changes. On Render the start command is `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, so it uses the port Render gives it.

Check that it is running:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

This returns `{ "status": "ok", "model_version": null }`. `model_version` stays `null` until a model is loaded.

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
