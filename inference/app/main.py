import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.model import ModelLoadError, load_model
from app.model_files import ModelFilesError, ensure_model_files

# The model's own settings (version, temperature, labels) come from model_card.json.
# Only the service key is read here; it is checked by a later issue.
INFERENCE_SERVICE_KEY = os.environ.get("INFERENCE_SERVICE_KEY")

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once at startup. If the model cannot be loaded, the service stops
    # here instead of starting without a model.
    try:
        model_dir = ensure_model_files()
        app.state.model = load_model(model_dir)
    except (ModelFilesError, ModelLoadError) as exc:
        logger.error("Startup failed: %s", exc)
        raise
    logger.info("Loaded model %s", app.state.model.model_version)
    yield


app = FastAPI(title="Sentiment inference service", lifespan=lifespan)


def error_response(status_code, code, message):
    """Builds an error in the same format as the Express API."""
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
    )


# Short codes for the HTTP errors FastAPI raises on its own.
ERROR_CODES = {
    404: "not_found",
    405: "method_not_allowed",
}


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(request: Request, exc: StarletteHTTPException):
    code = ERROR_CODES.get(exc.status_code, "http_error")
    if exc.status_code == 404:
        message = f"No route for {request.method} {request.url.path}"
    else:
        message = str(exc.detail)
    return error_response(exc.status_code, code, message)


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception):
    # The real error is still logged by uvicorn; the client gets a safe message.
    return error_response(500, "internal_error", "Something went wrong on the server")


@app.get("/health")
def health(request: Request):
    return {"status": "ok", "model_version": request.app.state.model.model_version}