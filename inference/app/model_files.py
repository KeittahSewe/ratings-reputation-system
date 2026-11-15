"""Gets the deployed model files from Hugging Face into MODEL_DIR.

Render's build command runs this file with `python -m app.model_files`, so the
files are already on disk when the service starts. The service also calls
ensure_model_files() at startup, which downloads only when the files are
missing or come from a different revision, as on a fresh laptop.
"""

import os
import re
import sys
from pathlib import Path

from huggingface_hub import snapshot_download

# The four files uploaded in #37. README.md on Hugging Face is not needed here.
MODEL_FILES = ["model.onnx", "tokenizer.json", "tokenizer_config.json", "model_card.json"]

# Records which revision is on disk, so a stale download is never reused.
REVISION_FILE = "REVISION"

COMMIT_HASH = re.compile(r"^[0-9a-f]{40}$")


class ModelFilesError(RuntimeError):
    """Raised when the model files cannot be found or downloaded."""


def read_settings():
    """Reads the repo, revision and folder from environment variables."""
    repo_id = os.environ.get("HF_REPO_ID", "").strip()
    revision = os.environ.get("HF_REVISION", "").strip()
    model_dir = Path(os.environ.get("MODEL_DIR", "model").strip() or "model")

    if not repo_id:
        raise ModelFilesError("HF_REPO_ID is not set. It should be KeittahSewe/ratings-reputation-sentiment.")
    if not COMMIT_HASH.match(revision):
        raise ModelFilesError(
            f"HF_REVISION must be a full 40-character commit hash, got '{revision}'. "
            "A branch name such as main would let the model change without anyone noticing."
        )
    return repo_id, revision, model_dir


def files_on_disk(model_dir, revision):
    """True when every model file is present and was downloaded at this revision."""
    marker = model_dir / REVISION_FILE
    if not marker.is_file() or marker.read_text().strip() != revision:
        return False
    return all((model_dir / name).is_file() for name in MODEL_FILES)


def download(repo_id, revision, model_dir):
    """Downloads the model files at the pinned revision into model_dir."""
    model_dir.mkdir(parents=True, exist_ok=True)
    try:
        # token=False: the repo is public, so no token is sent even if one is set.
        snapshot_download(
            repo_id,
            revision=revision,
            local_dir=model_dir,
            allow_patterns=MODEL_FILES,
            token=False,
        )
    except Exception as exc:
        raise ModelFilesError(f"Could not download {repo_id} at {revision}: {exc}") from exc

    missing = [name for name in MODEL_FILES if not (model_dir / name).is_file()]
    if missing:
        raise ModelFilesError(f"The download from {repo_id} at {revision} is missing {', '.join(missing)}.")
    (model_dir / REVISION_FILE).write_text(revision)


def ensure_model_files():
    """Returns the model folder, downloading the files first if they are not there."""
    repo_id, revision, model_dir = read_settings()
    if not files_on_disk(model_dir, revision):
        download(repo_id, revision, model_dir)
    return model_dir


if __name__ == "__main__":
    try:
        folder = ensure_model_files()
    except ModelFilesError as exc:
        print(f"Model download failed: {exc}", file=sys.stderr)
        sys.exit(1)
    print(f"Model files ready in {folder.resolve()}")