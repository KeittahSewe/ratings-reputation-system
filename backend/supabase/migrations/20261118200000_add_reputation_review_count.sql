-- #49. Stores how many reviews a reputation score was built from.
--
-- A score is Provisional while fewer than three reviews count (plan 3.4), and
-- only reviews that are visible and classified count. That number is not the
-- same as the reviews a profile lists, so it is stored with the score it
-- belongs to. The API derives provisional from it rather than storing a
-- second column that could disagree.
--
-- No rows exist yet, because nothing wrote reputation_scores before #49, so
-- the column is added as not null with no default. If a row did exist the
-- push would stop here, which is the right outcome: recompute it instead.

alter table public.reputation_scores
  add column review_count integer not null
    constraint reputation_scores_review_count_positive check (review_count >= 1);
