-- Creates the six tables in Figure 4.4: users, skills, jobs, reviews,
-- sentiment_results and reputation_scores.
--
-- Access: row level security is switched on for every table with no policies
-- yet, and the anon and authenticated roles get no table privileges. Until
-- #45 adds policies, the publishable key used by the browser can read and
-- write nothing here. Only service_role, which the Express API reaches with
-- the secret key, is granted access.

-- Skill and job categories are the six used in the marketplace review set.
-- They are CHECK constraints rather than an enum type, so a later migration
-- can change the list with a plain ALTER TABLE.

create table public.users (
  id            uuid primary key default gen_random_uuid(),
  auth_id       uuid not null unique references auth.users (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 100),
  email         text not null unique,
  role          text not null check (role in ('client', 'worker')),
  company_name  text,
  bio           text check (char_length(bio) <= 1000),
  availability  boolean,
  created_at    timestamptz not null default now(),
  -- A company name belongs to clients only.
  constraint users_company_name_client_only
    check (company_name is null or role = 'client'),
  -- Availability is a worker setting: always set for workers, never for clients.
  constraint users_availability_worker_only
    check ((role = 'worker') = (availability is not null))
);

create table public.skills (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  skill_name  text not null check (char_length(trim(skill_name)) between 1 and 60),
  category    text not null check (category in
                ('plumbing', 'painting', 'electrical', 'carpentry', 'cleaning', 'tutoring')),
  -- The same worker cannot list the same skill twice. The index behind this
  -- also serves lookups by user_id, so no separate index is needed.
  constraint skills_one_per_worker unique (user_id, skill_name)
);

create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.users (id),
  worker_id        uuid references public.users (id),
  title            text not null check (char_length(trim(title)) between 1 and 120),
  description      text not null check (char_length(description) <= 4000),
  category         text not null check (category in
                     ('plumbing', 'painting', 'electrical', 'carpentry', 'cleaning', 'tutoring')),
  required_skills  text[] not null default '{}',
  status           text not null default 'open' check (status in
                     ('open', 'assigned', 'in_progress', 'completed', 'cancelled')),
  created_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  completed_at     timestamptz,
  constraint jobs_client_is_not_worker
    check (worker_id is null or worker_id <> client_id),
  -- An open job has no worker yet; assigned, in progress and completed jobs must have one.
  -- A cancelled job may or may not, because both open and assigned jobs can be cancelled.
  constraint jobs_worker_matches_status
    check ((status = 'open' and worker_id is null)
        or (status in ('assigned', 'in_progress', 'completed') and worker_id is not null)
        or status = 'cancelled'),
  -- The worker submits while the job is in progress, and the client can only
  -- complete a job that has been submitted.
  constraint jobs_submitted_at_matches_status
    check ((status in ('open', 'assigned', 'cancelled') and submitted_at is null)
        or status = 'in_progress'
        or (status = 'completed' and submitted_at is not null)),
  constraint jobs_completed_at_matches_status
    check ((status = 'completed') = (completed_at is not null))
);

create index jobs_client_id_idx on public.jobs (client_id);
create index jobs_worker_id_idx on public.jobs (worker_id);
create index jobs_status_idx on public.jobs (status);

create table public.reviews (
  id                      uuid primary key default gen_random_uuid(),
  job_id                  uuid not null references public.jobs (id),
  reviewer_id             uuid not null references public.users (id),
  reviewee_id             uuid not null references public.users (id),
  rating                  smallint not null check (rating between 1 and 5),
  -- 5000 matches the longest text the inference service accepts.
  review_text             text not null check (char_length(trim(review_text)) between 1 and 5000),
  -- True from the moment the review is saved until its sentiment_results row
  -- is written, so a review whose classification failed is found by the retry.
  pending_classification  boolean not null default true,
  created_at              timestamptz not null default now(),
  constraint reviews_one_per_reviewer_per_job unique (job_id, reviewer_id),
  constraint reviews_not_self check (reviewer_id <> reviewee_id)
);

create index reviews_reviewee_id_idx on public.reviews (reviewee_id);

create table public.sentiment_results (
  id                uuid primary key default gen_random_uuid(),
  review_id         uuid not null unique references public.reviews (id) on delete cascade,
  label             text not null check (label in ('positive', 'neutral', 'negative')),
  confidence_score  numeric(5, 4) not null check (confidence_score between 0 and 1),
  model_version     text not null,
  -- One {text, label, confidence} object per sentence, exactly as /classify
  -- returns them with sentences: true. Read by the insights theme lexicon.
  sentences         jsonb not null default '[]'::jsonb
                      check (jsonb_typeof(sentences) = 'array'),
  analyzed_at       timestamptz not null default now()
);

create table public.reputation_scores (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references public.users (id) on delete cascade,
  -- All on the 0 to 5 scale, stored to two decimals and shown to one.
  score                numeric(3, 2) not null check (score between 0 and 5),
  ratings_component    numeric(3, 2) not null check (ratings_component between 0 and 5),
  sentiment_component  numeric(3, 2) not null check (sentiment_component between 0 and 5),
  history_component    numeric(3, 2) not null check (history_component between 0 and 5),
  last_updated         timestamptz not null default now()
);

-- Row level security on, no policies yet (#45 adds them).
alter table public.users             enable row level security;
alter table public.skills            enable row level security;
alter table public.jobs              enable row level security;
alter table public.reviews           enable row level security;
alter table public.sentiment_results enable row level security;
alter table public.reputation_scores enable row level security;

-- Explicit privileges, so the result is the same whatever the project's
-- "expose new tables" setting was when it was created.
revoke all on table
  public.users, public.skills, public.jobs, public.reviews,
  public.sentiment_results, public.reputation_scores
  from anon, authenticated;

grant select, insert, update, delete on table
  public.users, public.skills, public.jobs, public.reviews,
  public.sentiment_results, public.reputation_scores
  to service_role;