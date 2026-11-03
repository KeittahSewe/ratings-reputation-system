import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# Settings come from environment variables only. They are read here so later
# issues can load the model and check the service key.
MODEL_PATH = os.environ.get("MODEL_PATH")
MODEL_VERSION = os.environ.get("MODEL_VERSION")
INFERENCE_SERVICE_KEY = os.environ.get("INFERENCE_SERVICE_KEY")

app = FastAPI(title="Sentiment inference service")

# Stays None until a model is loaded in a later issue.
loaded_model_version = None


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
def health():
    return {"status": "ok", "model_version": loaded_model_version}
