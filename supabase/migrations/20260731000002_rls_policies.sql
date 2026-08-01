-- Row Level Security.
--
-- Every user-owned table denies by default and then allows exactly one thing:
-- the authenticated person acting on their own rows. There is no policy
-- anywhere in this file that lets one person read another's reflections.
--
-- The corpus tables (scripture_sources, supporting_sources, feature_flags) are
-- readable by everyone and writable only by the service role, because they are
-- editorial content rather than user data.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.profiles                 enable row level security;
alter table public.consents                 enable row level security;
alter table public.entries                  enable row level security;
alter table public.entry_assets             enable row level security;
alter table public.companion_responses      enable row level security;
alter table public.citations                enable row level security;
alter table public.saved_items              enable row level security;
alter table public.memory_preferences       enable row level security;
alter table public.memory_themes            enable row level security;
alter table public.memory_insights          enable row level security;
alter table public.integration_connections  enable row level security;
alter table public.delivery_routes          enable row level security;
alter table public.delivery_events          enable row level security;
alter table public.daily_companion_settings enable row level security;
alter table public.daily_companion_runs     enable row level security;
alter table public.audit_events             enable row level security;
alter table public.scripture_sources        enable row level security;
alter table public.supporting_sources       enable row level security;
alter table public.feature_flags            enable row level security;

-- Force RLS so even a table owner connecting through PostgREST is constrained.
alter table public.entries                  force row level security;
alter table public.companion_responses      force row level security;
alter table public.entry_assets             force row level security;
alter table public.saved_items              force row level security;
alter table public.daily_companion_runs     force row level security;

-- ---------------------------------------------------------------------------
-- Profiles: keyed by id rather than user_id
-- ---------------------------------------------------------------------------

drop policy if exists "profiles owner select" on public.profiles;
create policy "profiles owner select" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profiles owner insert" on public.profiles;
create policy "profiles owner insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "profiles owner update" on public.profiles;
create policy "profiles owner update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "profiles owner delete" on public.profiles;
create policy "profiles owner delete" on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Owner-only policies for every user_id table
-- ---------------------------------------------------------------------------

do $$
declare
  target text;
  owned_tables text[] := array[
    'consents',
    'entries',
    'entry_assets',
    'companion_responses',
    'citations',
    'saved_items',
    'memory_preferences',
    'memory_themes',
    'memory_insights',
    'integration_connections',
    'delivery_routes',
    'delivery_events',
    'daily_companion_settings',
    'daily_companion_runs'
  ];
begin
  foreach target in array owned_tables loop
    execute format('drop policy if exists %I on public.%I', target || ' owner select', target);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      target || ' owner select', target);

    execute format('drop policy if exists %I on public.%I', target || ' owner insert', target);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      target || ' owner insert', target);

    execute format('drop policy if exists %I on public.%I', target || ' owner update', target);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      target || ' owner update', target);

    execute format('drop policy if exists %I on public.%I', target || ' owner delete', target);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      target || ' owner delete', target);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit events: the person may read their own, but may not write or alter them
-- ---------------------------------------------------------------------------

drop policy if exists "audit owner select" on public.audit_events;
create policy "audit owner select" on public.audit_events
  for select to authenticated using ((select auth.uid()) = user_id);

-- No insert/update/delete policy: writes happen through Edge Functions using
-- the service role, so an audit trail cannot be edited by the person it is
-- about.

-- ---------------------------------------------------------------------------
-- Editorial corpus: public read, service-role write
-- ---------------------------------------------------------------------------

drop policy if exists "scripture readable" on public.scripture_sources;
create policy "scripture readable" on public.scripture_sources
  for select to anon, authenticated using (approval_status = 'approved');

drop policy if exists "supporting readable" on public.supporting_sources;
create policy "supporting readable" on public.supporting_sources
  for select to anon, authenticated using (approval_status = 'approved');

drop policy if exists "flags readable" on public.feature_flags;
create policy "flags readable" on public.feature_flags
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Least privilege on the API roles
-- ---------------------------------------------------------------------------

revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;

revoke all on public.scripture_sources from anon, authenticated;
grant select on public.scripture_sources to anon, authenticated;

revoke all on public.supporting_sources from anon, authenticated;
grant select on public.supporting_sources to anon, authenticated;

revoke all on public.feature_flags from anon, authenticated;
grant select on public.feature_flags to anon, authenticated;

-- The anon role has no business touching any user-owned table; a signed-out
-- client keeps its drafts in IndexedDB instead.
revoke all on public.entries              from anon;
revoke all on public.entry_assets         from anon;
revoke all on public.companion_responses  from anon;
revoke all on public.citations            from anon;
revoke all on public.saved_items          from anon;
revoke all on public.consents             from anon;
revoke all on public.memory_preferences   from anon;
revoke all on public.memory_themes        from anon;
revoke all on public.memory_insights      from anon;
revoke all on public.integration_connections from anon;
revoke all on public.delivery_routes      from anon;
revoke all on public.delivery_events      from anon;
revoke all on public.daily_companion_settings from anon;
revoke all on public.daily_companion_runs from anon;
revoke all on public.profiles             from anon;
