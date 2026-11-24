# Integration flow: from review form to dashboard

On 24 November 2026 the deployed system (commit `0406207`, tag `phase-4`) took a review from the review form to a stored label and an updated score without manual intervention. Warm, each submission finished in under 1.1 s, and the hidden-until-pair rule held. This document records the sequence of calls, where each table is written, the timings measured, and what happens when the classifier is down. It is the phase 5 record for Chapter 5 of the report.

## 1. Result against the phase 5 checks

Every check in plan phase 5 passed except the production run of the classifier-down path, which was tested on localhost instead.

| Check (plan phase 5) | Result | Evidence |
|---|---|---|
| Review on the form produces a `sentiment_results` row and an updated `reputation_scores` row | Passed on production | Timed review, 24 Nov 00:57: Faith reviewed Samuel, then Samuel reviewed Faith. Samuel moved from 3.3 to 3.6 (4.00 / 4.00 / 2.00, 4 reviews) |
| Profile card and ranking card show the new score | Passed on production | Samuel's card on Find Workers reads 3.6 from 4 reviews (screenshot, 24 Nov) |
| Reviewer sees "awaiting the other party" until the pair completes | Passed on production | Rule held throughout the production walkthrough (handover, 24 Nov 01:05). Also shown on Fix gate hinge in the #88 live test: Amina's review stayed hidden until Peter reviewed back, then became visible at once |
| H recomputed for both parties on completion and cancellation | Passed on production | 24 Nov 01:01, cancellation after assigning: Amina 4.7 to 4.5 (H 4.50 to 3.60), Peter unchanged at 4.1 (H 2.50) |
| Theme extraction on multi-sentence reviews | Passed, with a model finding | Peter's dashboard lists five themes from four reviews; tidiness praise is labelled negative (section 7) |
| `model_version` stored on every row | Passed on production | All 32 `sentiment_results` rows carry `distilbert-sst5-3cls-v1.0-20261111-seed43-onnx-int8` (SQL count by `model_version`, 24 Nov); the column is also `NOT NULL` |
| Classifier-down path: review saves, shows pending, retry succeeds later | Passed on localhost only | 18 Nov (#50): saved as pending after 3.4 s; classified by the timer about two minutes after the service restarted. Not run on production on 23 Nov, to avoid suspending the classifier the night before the demo |

## 2. Deployed parts

| Part | Host | Address |
|---|---|---|
| React app | Vercel | https://ratings-reputation-system.vercel.app |
| Express API | Render, Frankfurt, free | https://ratings-reputation-api.onrender.com |
| FastAPI inference service | Render, Frankfurt, free | https://ratings-reputation-inference.onrender.com |
| PostgreSQL and Auth | Supabase, Central EU (Frankfurt), free | project `yhupiotruqanmvmaldei` |

The model weights are downloaded at build time from the public Hugging Face repo `KeittahSewe/ratings-reputation-sentiment`, pinned to revision `fd22fadb091b8795acd22c802b2552f8c3d1dab7`.

## 3. Sequence of calls

A review is saved first and classified second, so a classifier failure can never lose a review. The API answers only after classification and recompute, which is why a warm submission returns the stored label.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (React)
    participant A as Express API
    participant I as Inference (FastAPI)
    participant D as Supabase (PostgreSQL)

    B->>I: GET /health (no-cors wake, on app load and on opening the review page)
    B->>A: POST /api/jobs/:id/reviews {rating, review_text} with Bearer token
    A->>A: verify token against Supabase JWKS, load user, check job is completed and caller is a party
    A->>D: insert reviews (pending_classification = true)
    alt the other party reviewed this job first
        A->>D: recompute caller, upsert reputation_scores
    end
    A->>I: POST /classify {text, sentences: true} with X-Service-Key (5 s limit, up to 3 attempts)
    I-->>A: label, confidence, probabilities, model_version, sentences[]
    A->>D: insert sentiment_results; set reviews.pending_classification = false
    A->>D: recompute reviewee, upsert reputation_scores
    A-->>B: 201 {review, sentiment}
    Note over B,D: Later reads compute from the stored rows
    B->>A: GET /api/users/:id (profile card), GET /api/jobs/:id/recommendations (ranking), GET /api/me/insights (chart and themes)
```

Steps in words:

1. The browser sends a no-cors `GET /health` to the inference service when the app loads and again when the review page opens. A sleeping Render service is woken by a request from outside Render, but not by the API's internal call (finding of 22 November).
2. The browser posts the rating and text to `POST /api/jobs/:id/reviews` with the Supabase access token.
3. Express checks the token against the project JWKS, loads the user, refuses anyone who is not the job's client or worker (403), a job that is not completed (409 `job_not_completed`) and a second review (409 `already_reviewed`).
4. The review is inserted with `pending_classification = true`.
5. If the other party had already reviewed this job, their review of the caller becomes visible now, so the caller is recomputed straight away.
6. Express calls `POST /classify` with `sentences: true`, a 5 second limit per attempt and up to two retries (0.5 s and 1 s apart).
7. The service cleans the text with the same `clean_text` used in training, runs the int8 ONNX model, applies temperature scaling (T = 1.2984) and splits the text into sentences, each with its own label and confidence.
8. Express inserts the `sentiment_results` row, clears the pending flag and recomputes the reviewee.
9. The response carries the stored label. Profile, ranking and insights are read later from the stored rows; recommendations are computed per request and never stored.

## 4. Where each table is written

| Event | Table written | Columns |
|---|---|---|
| Review submitted | `reviews` | `rating`, `review_text`, `pending_classification = true`, `created_at` |
| Classification succeeds (submit or retry) | `sentiment_results` | `label`, `confidence_score`, `model_version`, `sentences`, `analyzed_at` |
| Same moment | `reviews` | `pending_classification = false` |
| Reviewee recomputed; caller too when the pair completes | `reputation_scores` | `score`, the three components, `review_count`, the three sentiment counts, `last_updated` |
| Job completed or cancelled | `jobs`, then `reputation_scores` for both parties | status and its timestamp; H changes |
| One-minute timer, step 1 (retry) | `sentiment_results`, `reviews`, `reputation_scores` | as for a successful classification |
| One-minute timer, step 2 (14-day sweep) | `reputation_scores` | users whose hidden review passed its 14-day mark since `last_updated` |

Only reviews that are both visible and classified count towards the score and the insights. A hidden review that moved the score would give its stars away before the other party had reviewed.

## 5. Timings

All warm timings are under the plan's 2 s target for review submission to an updated score. Cold starts dominate everything else.

| Measurement | Condition | Result | Sample |
|---|---|---|---|
| Review submit to stored label and recomputed score, measured from the client | Production, warm, scripted from Nairobi (PowerShell) | median about 780 ms, range 669 to 1,077 ms | 22 reviews, 24 Nov 00:36 |
| Review insert to stored label, server timestamps | Production, warm, submitted in the browser | 259 ms and 463 ms | 2 reviews, 24 Nov 00:57 |
| Classification inside the service (`latency_ms`) | Production, warm | median 37 ms, p95 78 ms | 20 calls, 22 Nov |
| Round trip from Nairobi to `/classify` | Production, warm | median 301 ms | 20 calls, 22 Nov |
| Inference cold start | Production, after sleep | 33.6 s (22 Nov); 33 s after three idle hours (22 Nov 20:25) | 2 |
| API cold start | Production, after three idle hours | 24 s | 1 |
| `/classify/batch` of 28 texts with the classifier asleep | Production | 39.8 s, including the wake | 1 |
| Cold app load | Production, 23 Nov 23:56 | three minutes of "Check again" did not wake the classifier; a page reload did, within about a minute | 1 |
| Frontend bundle | Vite production build of `0406207` | 560.5 kB JS (162.4 kB gzip), 42.4 kB CSS (7.4 kB gzip) | 1 build |

The browser time from clicking Submit to the updated page was not captured, because DevTools was closed during the timed review. The server and client figures above bound it from below.

## 6. When the classifier is down

A review is never lost: it is saved as pending and classified by the one-minute timer once the service answers. This was tested on localhost on 18 November (#50). With the inference service stopped, the review saved as pending with no `sentiment_results` row after 3.4 s, because a refused connection fails fast. The worst case is about 16.5 s, for a service that accepts the connection and never answers. The timer classified the pending review about two minutes after the service restarted, and the reviewee's score updated.

The timer tries up to 20 pending reviews older than 30 seconds each minute and stops at the first failure that means the service is down, so a dead classifier receives one call a minute. `GET /api/health` always answers 200 and reports the classifier as `ok`, `timeout`, `unreachable` or `error`. With the local service stopped it answered `unreachable` in 26 ms (#53).

On production, the API's call to a sleeping inference service gets an error at once instead of waking it. The browser wake call in step 1 exists for this reason. Demo routine: reload the app, or open the inference `/health` page, at least a minute before starting.

## 7. Findings for Chapter 5

The integration is correct, but the classifier misreads some ordinary marketplace praise, and the insights screen makes that visible.

- **Tidiness praise is read as negative.** Peter's three sentences of the form "left the [room] clean" were labelled negative at 0.68 to 0.72 confidence, all in 5-star reviews. None of four test phrasings ("He cleaned up after himself", "The site was spotless when he finished", "He left the kitchen clean", "She tidied the room before leaving") was labelled positive. The dashboard shows the tidiness theme as negative and states that both negative mentions came with four or five stars.
- **Short plain praise is often neutral or low-confidence.** Amina's 5-star review of Fix kitchen plumbing reads neutral at 0.50; the leaking-tap review reads neutral at 0.43; "He did a good job with the hinge and fixed it properly" reads positive at only 0.59.
- **Guidance needs volume.** Daniel's dashboard shows a mixed quality-of-work theme from two reviews but no suggestion, because a suggestion needs a theme in at least three reviews.
- **Demo data is excluded from evaluation.** The 22 seeded reviews were written and checked against the deployed model before seeding, so they cannot measure classifier agreement in phase 8.

## 8. Evidence

- Status tracker entries of 23 November 22:00 to 24 November 01:05 (walkthrough, timings, demo data, handover).
- Issue live tests: #50 (reviews and classifier-down path), #52 (insights), #53 (health and 14-day sweep), #77 part A (first production review).
- SQL check on 24 November: `select model_version, count(*) from sentiment_results group by model_version` returned one row, 32.
- Screenshots taken on 24 November: deployment check, profiles, job management, review form, recommendations, insights, Supabase `sentiment_results`, Vercel and Render dashboards.
- Code: `backend/src/routes/reviews.js`, `backend/src/reviews/classification.js`, `backend/src/inference/client.js`, `backend/src/background.js`, `backend/src/reputation/recompute.js`, `inference/app/classify.py`, `frontend/src/lib/api.js`.
