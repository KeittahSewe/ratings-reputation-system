# Ratings and Reputation System

A web-based service marketplace where clients post jobs, workers complete them, and both parties review each other. Every review is classified as positive, neutral or negative by a fine-tuned DistilBERT model. That classification feeds a transparent reputation score, a worker recommendation engine and a personal insights dashboard.

Final-year capstone, BSc Informatics and Computer Science, Strathmore University (UCS62).
Author: Oyunga Keittah Sewe (151426). Supervisor: Mr. James Gikera.

## Repository layout

| Folder | Contents |
|---|---|
| `frontend/` | React.js single-page app, deployed on Vercel |
| `backend/` | Node.js and Express.js REST API, deployed on Render |
| `inference/` | FastAPI sentiment inference service, deployed on Render |
| `ml/` | Colab notebooks for the four-model sentiment comparison |
| `docs/` | Design figures and technical documentation |

## Stack

React.js, Node.js with Express.js, Supabase (PostgreSQL and Auth), FastAPI, Hugging Face Transformers, scikit-learn, Keras.

## Local tool versions

| Tool | Version |
|---|---|
| Git | 2.53.0 |
| Node.js | 26.13.0 (npm 11.20.0) |
| Python | 3.11.9 (used for `inference/` and `ml/`) |
| GitHub CLI | 2.97.0 |
| VS Code | 1.138.0 |

## How work is tracked

Every task is a GitHub issue grouped under a milestone for its phase. Changes reach `main` only through pull requests that close their issue.
