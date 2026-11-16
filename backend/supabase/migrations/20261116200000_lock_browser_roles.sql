-- #45. The browser roles get no access to any table, now or later.
--
-- Every read and write goes through Express, which connects with the secret
-- key as service_role. service_role bypasses row level security, so a policy
-- never runs for the API. Policies could only ever apply to anon (publishable
-- key, signed out) and authenticated (publishable key plus a user's token),
-- and the browser never queries a table as either. The publishable key ships
-- in the frontend bundle and anyone can sign up for a token, so instead of
-- policies the database relies on three locks:
--
--   1. anon and authenticated hold no privileges on any table. The first
--      migration revoked them; the check at the end of this file proves it.
--   2. Row level security stays on with no policies, so a privilege granted
--      by mistake still returns no rows and allows no writes.
--   3. The defaults below make anything a later migration creates start
--      closed to anon and authenticated.
--
-- Supabase's security advisor reports "RLS enabled, no policy" on all six
-- tables. That is the intended state.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

-- Postgres lets every role execute a new function through PUBLIC, and a
-- revoke limited to one schema cannot remove that, so this one is global.
-- A function that Express later calls through rpc() needs its own
-- "grant execute on function ... to service_role" in the migration that
-- creates it.
alter default privileges for role postgres
  revoke execute on functions from public;

-- Stop the push if any table in public has row level security off, or if
-- anon or authenticated (directly or through PUBLIC) hold any privilege on a
-- table, view or function in public.
do $$
declare
  problems text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into problems
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity;
  if problems is not null then
    raise exception 'Row level security is off on: %', problems;
  end if;

  select string_agg(r.rolname || ' on ' || c.relname, ', ' order by c.relname, r.rolname)
    into problems
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join (values ('anon'), ('authenticated')) as r (rolname)
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and has_table_privilege(r.rolname, c.oid,
          'select, insert, update, delete, truncate, references, trigger');
  if problems is not null then
    raise exception 'Browser roles hold table privileges: %', problems;
  end if;

  -- Trigger and event trigger functions are left out: Postgres runs them only
  -- when their trigger fires, so neither SQL nor the Data API can call them.
  -- This project has one, public.rls_auto_enable, which Supabase installs at
  -- project creation to switch row level security on for every new table.
  select string_agg(r.rolname || ' on ' || p.proname, ', ' order by p.proname, r.rolname)
    into problems
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join (values ('anon'), ('authenticated')) as r (rolname)
  where n.nspname = 'public'
    and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
    and has_function_privilege(r.rolname, p.oid, 'execute');
  if problems is not null then
    raise exception 'Browser roles can execute functions: %', problems;
  end if;
end
$$;
