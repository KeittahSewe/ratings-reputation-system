import hmac
import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.classify import classify
from app.model import ModelLoadError, load_model
from app.model_files import ModelFilesError, ensure_model_files
from app.text import clean_text

# Longest review text accepted. The model only reads the first 128 tokens, and
# this stops a huge request from tying up the service while it is cleaned.
MAX_TEXT_CHARS = 5000

# Most texts one /classify/batch request may carry. Each is classified one at a
# time, so this keeps a batch to a few seconds on Render's free CPU.
MAX_BATCH = 32

# Routes anyone can call without the X-Service-Key header.
OPEN_PATHS = {"/health"}

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once at startup. If the key is missing or the model cannot be
    # loaded, the service stops here instead of starting half-ready.
    try:
        service_key = os.environ.get("INFERENCE_SERVICE_KEY", "").strip()
        if not service_key:
            raise ModelLoadError("INFERENCE_SERVICE_KEY is not set, so every request would be refused.")
        app.state.service_key = service_key
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


@app.middleware("http")
async def require_service_key(request: Request, call_next):
    # Every route except /health needs the shared key the Express API holds.
    if request.url.path in OPEN_PATHS:
        return await call_next(request)
    sent = request.headers.get("x-service-key", "")
    # compare_digest takes the same time whether the first or last character
    # differs, so the key cannot be guessed one character at a time.
    if not hmac.compare_digest(sent.encode(), request.app.state.service_key.encode()):
        return error_response(401, "unauthorized", "Missing or wrong X-Service-Key header")
    return await call_next(request)


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


@app.exception_handler(RequestValidationError)
async def handle_invalid_request(request: Request, exc: RequestValidationError):
    # FastAPI's own 422 body is a list in a different shape; this keeps the
    # shared format and names the field that was wrong.
    problems = []
    for error in exc.errors():
        field = ".".join(str(part) for part in error["loc"][1:]) or "body"
        message = error["msg"].removeprefix("Value error, ")
        problems.append(f"{field}: {message}")
    return error_response(422, "invalid_request", "; ".join(problems))


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception):
    # The real error is still logged by uvicorn; the client gets a safe message.
    return error_response(500, "internal_error", "Something went wrong on the server")


ReviewText = Annotated[str, Field(max_length=MAX_TEXT_CHARS)]


class ClassifyRequest(BaseModel):
    text: ReviewText

    @field_validator("text")
    @classmethod
    def not_empty_after_cleaning(cls, value):
        if not clean_text(value):
            raise ValueError("text is empty after cleaning")
        return value


class BatchRequest(BaseModel):
    texts: list[ReviewText] = Field(min_length=1, max_length=MAX_BATCH)

    @field_validator("texts")
    @classmethod
    def none_empty_after_cleaning(cls, values):
        empty = [str(i) for i, value in enumerate(values) if not clean_text(value)]
        if empty:
            raise ValueError(f"item {', '.join(empty)} is empty after cleaning")
        return values


@app.get("/health")
def health(request: Request):
    return {"status": "ok", "model_version": request.app.state.model.model_version}


@app.post("/classify")
def classify_review(body: ClassifyRequest, request: Request):
    return classify(request.app.state.model, body.text)


@app.post("/classify/batch")
def classify_batch(body: BatchRequest, request: Request):
    # One text at a time, exactly as /classify does it, so every result is
    # identical to classifying that text on its own. Order follows the input.
    model = request.app.state.model
    return {"results": [classify(model, text) for text in body.texts]}