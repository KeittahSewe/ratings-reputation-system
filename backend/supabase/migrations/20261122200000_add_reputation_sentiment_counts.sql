-- #84. Stores how many of the counted reviews were classified positive,
-- neutral and negative, next to the score they belong to.
--
-- Figures 4.8 and 4.11 show a worker's sentiment distribution with counts
-- (78 / 15 / 7 percent of 41). GET /users/:id lists only the 10 newest
-- reviews, and the recommendation route ranks every available worker in a
-- fixed five queries, so neither can work the distribution out from reviews
-- on each request. Storing it with the score keeps the breakdown on screen
-- consistent with the score, as for the three components (plan 3.4.4).
--
-- The counts cover the same reviews as review_count: visible and classified.
-- The neutral prior added to S below three reviews is not a review, so it is
-- not counted.
--
-- Rows written before this migration hold nulls until they are recomputed;
-- npm run recompute:all does that once after the push. The CHECK allows
-- either all three null or all three filled and adding up to review_count.
-- The is not null tests are spelled out because a comparison with null is
-- unknown, and a CHECK lets unknown pass.
-- The table's existing grants (service_role only) cover the new columns.

alter table public.reputation_scores
  add column positive_count integer,
  add column neutral_count integer,
  add column negative_count integer,
  add constraint reputation_scores_sentiment_counts_check check (
    (positive_count is null and neutral_count is null and negative_count is null)
    or (
      positive_count is not null
      and neutral_count is not null
      and negative_count is not null
      and positive_count >= 0
      and neutral_count >= 0
      and negative_count >= 0
      and positive_count + neutral_count + negative_count = review_count
    )
  );
