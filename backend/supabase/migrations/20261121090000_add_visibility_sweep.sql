-- #53. Finds the users whose reputation is out of date because a review they
-- received has become visible under the 14-day rule (plan 3.1, decision of
-- 18 November) since their score was last computed.
--
-- No visible-from date is stored. Every recompute decides visibility and
-- writes last_updated from the same moment, so a review's 14-day mark at or
-- before last_updated has already been counted, and a mark after it has not.
-- A user who has a review past its mark and no reputation_scores row has never
-- had it counted. Comparing with last_updated, rather than with the last
-- minute, means a review whose mark passed while the API slept on Render is
-- still found at the next wake.
--
-- Left out:
--   - pending reviews: classifying one recomputes its reviewee anyway, and an
--     unclassified review does not count;
--   - reviews the reviewee has answered on the same job: those became
--     visible when the answer was written, and that request recomputed them.
--
-- Express passes its own clock as p_now and the 14 days from
-- src/reviews/visibility.js as p_days, so the number lives in one place and
-- the comparison uses the same clock that wrote last_updated.

create function public.reviewees_due_visibility_recompute(p_now timestamptz, p_days integer, p_limit integer)
returns table (user_id uuid)
language sql
stable
set search_path = ''
as $$
  select distinct r.reviewee_id
  from public.reviews r
  left join public.reputation_scores s on s.user_id = r.reviewee_id
  where not r.pending_classification
    and r.created_at + make_interval(days => p_days) <= p_now
    and (s.last_updated is null or r.created_at + make_interval(days => p_days) > s.last_updated)
    and not exists (
      select 1
      from public.reviews answer
      where answer.job_id = r.job_id
        and answer.reviewer_id = r.reviewee_id
    )
  limit p_limit
$$;

comment on function public.reviewees_due_visibility_recompute(timestamptz, integer, integer) is
  'Users with a classified, unanswered review whose 14-day visibility mark falls after their last recompute (#53).';

-- Only the API calls it, through rpc() as service_role. The default
-- privileges from 20261116200000 already keep it from PUBLIC, anon and
-- authenticated; this says so explicitly.
revoke all on function public.reviewees_due_visibility_recompute(timestamptz, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reviewees_due_visibility_recompute(timestamptz, integer, integer)
  to service_role;

-- Stop the push if a browser role can call it or service_role cannot.
do $$
begin
  if has_function_privilege('anon', 'public.reviewees_due_visibility_recompute(timestamptz, integer, integer)', 'execute')
     or has_function_privilege('authenticated', 'public.reviewees_due_visibility_recompute(timestamptz, integer, integer)', 'execute') then
    raise exception 'Browser roles can execute public.reviewees_due_visibility_recompute';
  end if;
  if not has_function_privilege('service_role', 'public.reviewees_due_visibility_recompute(timestamptz, integer, integer)', 'execute') then
    raise exception 'service_role cannot execute public.reviewees_due_visibility_recompute';
  end if;
end
$$;
