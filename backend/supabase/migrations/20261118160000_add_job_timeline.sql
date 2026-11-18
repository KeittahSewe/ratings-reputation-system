-- Adds the timestamps the job timeline in Figure 4.9 needs. The first
-- migration had created_at (posted), submitted_at and completed_at; this adds
-- the assigned, accepted and cancelled steps.
--
-- Each column is tied to the job's state by a CHECK, in the same way as
-- submitted_at and completed_at, so the API cannot leave a step undated.

alter table public.jobs
  add column assigned_at  timestamptz,
  add column accepted_at  timestamptz,
  add column cancelled_at timestamptz;

-- Any job rows that already exist get their created_at as a stand-in, so the
-- constraints below can be added.
update public.jobs set assigned_at = created_at where worker_id is not null;
update public.jobs set accepted_at = created_at where status in ('in_progress', 'completed');
update public.jobs set cancelled_at = created_at where status = 'cancelled';

alter table public.jobs
  -- A worker is on the job exactly when it has been assigned. A job cancelled
  -- while assigned keeps both its worker and its assigned_at.
  add constraint jobs_assigned_at_matches_worker
    check ((worker_id is null) = (assigned_at is null)),
  -- Only in-progress and completed jobs have been accepted. A job cannot be
  -- cancelled once accepted.
  add constraint jobs_accepted_at_matches_status
    check ((status in ('in_progress', 'completed')) = (accepted_at is not null)),
  add constraint jobs_cancelled_at_matches_status
    check ((status = 'cancelled') = (cancelled_at is not null));
