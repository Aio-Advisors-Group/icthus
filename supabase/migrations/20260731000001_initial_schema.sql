-- Icthus initial schema.
--
-- Scope note: this migration creates only objects prefixed by Icthus's own
-- domain. It does not touch, drop, or alter anything else in the project.
--
-- Design rules enforced below:
--   * every user-owned table carries user_id and has RLS enabled
--   * derived data (memory, responses) cascades from the record it derives from
--   * delivery logs are content-free: status codes and reason codes only

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  display_name  text,
  translation_id text not null default 'web',
  time_zone     text not null default 'UTC',
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'One row per signed-in person. Deliberately minimal: no denomination, no church, no demographic fields.';

-- ---------------------------------------------------------------------------
-- Consents
-- ---------------------------------------------------------------------------

create table if not exists public.consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  type           text not null check (type in (
                   'privacy_onboarding', 'memory', 'audio_retention',
                   'notifications', 'gloo_processing', 'route', 'raw_journal_route')),
  policy_version text not null,
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz
);

create index if not exists consents_user_type_idx on public.consents (user_id, type);

comment on table public.consents is
  'Append-only consent ledger. Revoking sets revoked_at rather than deleting, so the history stays auditable.';

-- ---------------------------------------------------------------------------
-- Entries and their derivatives
-- ---------------------------------------------------------------------------

create table if not exists public.entries (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  kind                 text not null check (kind in (
                         'reflection', 'prayer', 'question', 'experience',
                         'imported_note', 'voice')),
  mode                 text not null check (mode in ('write', 'speak', 'note')),
  purpose              text not null check (purpose in ('pray', 'understand', 'discern', 'reflect')),
  body                 text not null,
  occurred_at          timestamptz not null default now(),
  source_kind          text not null check (source_kind in ('typed', 'voice', 'imported_note')),
  imported_from        text,
  excluded_from_memory boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index if not exists entries_user_created_idx
  on public.entries (user_id, created_at desc);
create index if not exists entries_user_active_idx
  on public.entries (user_id) where deleted_at is null;

comment on column public.entries.deleted_at is
  'Soft delete. Reads filter on this immediately; a scheduled function performs the hard purge.';

create table if not exists public.entry_assets (
  id                   uuid primary key default gen_random_uuid(),
  entry_id             uuid not null references public.entries (id) on delete cascade,
  user_id              uuid not null references auth.users (id) on delete cascade,
  kind                 text not null check (kind in ('audio', 'image')),
  storage_path         text not null,
  mime_type            text not null,
  byte_size            bigint,
  duration_seconds     integer,
  transcript           text,
  transcription_status text not null default 'pending'
                         check (transcription_status in ('pending', 'ready', 'manual_required', 'failed')),
  retention_policy     text not null default 'delete_after_transcript'
                         check (retention_policy in ('delete_after_transcript', 'keep_until_deleted')),
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index if not exists entry_assets_user_idx on public.entry_assets (user_id);

create table if not exists public.companion_responses (
  id                       uuid primary key default gen_random_uuid(),
  entry_id                 uuid not null references public.entries (id) on delete cascade,
  user_id                  uuid not null references auth.users (id) on delete cascade,
  payload                  jsonb not null,
  safety_state             text not null check (safety_state in ('normal', 'pastoral_support', 'urgent_support')),
  prompt_version           text not null,
  model_version            text,
  scripture_provider_state text not null check (scripture_provider_state in ('live', 'mock', 'unavailable')),
  companion_provider_state text not null check (companion_provider_state in ('live', 'mock', 'unavailable')),
  created_at               timestamptz not null default now()
);

create index if not exists companion_responses_entry_idx on public.companion_responses (entry_id);
create index if not exists companion_responses_user_idx on public.companion_responses (user_id);

-- ---------------------------------------------------------------------------
-- Approved source corpus (not user data)
-- ---------------------------------------------------------------------------

create table if not exists public.scripture_sources (
  id              text primary key,
  reference       text not null,
  canonical       jsonb not null,
  body            text not null,
  context         text,
  translation     jsonb not null,
  attribution     text not null,
  provider        text not null,
  canonical_url   text,
  themes          text[] not null default '{}',
  approval_status text not null default 'approved'
                    check (approval_status in ('draft', 'approved', 'retired')),
  version         integer not null default 1,
  created_at      timestamptz not null default now()
);

comment on table public.scripture_sources is
  'Editorially approved passages. Public read, service-role write. Only content Icthus has the rights to store may be inserted here.';

create table if not exists public.supporting_sources (
  id              text primary key,
  kind            text not null check (kind in (
                    'scripture_context', 'historic_witness', 'scholarship', 'tradition_specific')),
  title           text not null,
  author          text not null,
  locator         text not null,
  edition         text not null,
  excerpt         text not null,
  tradition       text,
  canonical_url   text,
  rights          text not null,
  approval_status text not null default 'approved'
                    check (approval_status in ('draft', 'approved', 'retired')),
  created_at      timestamptz not null default now()
);

create table if not exists public.citations (
  id                uuid primary key default gen_random_uuid(),
  response_id       uuid not null references public.companion_responses (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  source_id         text not null,
  display_reference text not null,
  supports          text not null check (supports in ('primary_passage', 'reflection', 'supporting_source')),
  created_at        timestamptz not null default now()
);

create index if not exists citations_response_idx on public.citations (response_id);

-- ---------------------------------------------------------------------------
-- Saved items
-- ---------------------------------------------------------------------------

create table if not exists public.saved_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('scripture', 'prayer', 'reflection')),
  title       text not null,
  body        text not null,
  reference   text,
  attribution text,
  source_id   text,
  entry_id    uuid references public.entries (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists saved_items_user_created_idx
  on public.saved_items (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Memory
-- ---------------------------------------------------------------------------

create table if not exists public.memory_preferences (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  enabled            boolean not null default false,
  window_days        integer not null default 30 check (window_days in (7, 30, 90)),
  hidden_themes      text[] not null default '{}',
  excluded_entry_ids uuid[] not null default '{}',
  updated_at         timestamptz not null default now()
);

comment on column public.memory_preferences.enabled is
  'Default false. Memory does not aggregate anything until the person turns it on.';

create table if not exists public.memory_themes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  entry_id          uuid not null references public.entries (id) on delete cascade,
  theme             text not null,
  hits              integer not null default 1,
  confidence        text not null check (confidence in ('low', 'moderate', 'high')),
  extractor_version text not null,
  created_at        timestamptz not null default now()
);

create index if not exists memory_themes_user_theme_idx on public.memory_themes (user_id, theme);

create table if not exists public.memory_insights (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  theme             text not null,
  entry_count       integer not null check (entry_count >= 3),
  period_start      date not null,
  period_end        date not null,
  entry_ids         uuid[] not null,
  confidence        text not null check (confidence in ('moderate', 'high')),
  extractor_version text not null,
  status            text not null default 'active' check (status in ('active', 'hidden', 'corrected')),
  hidden_at         timestamptz,
  created_at        timestamptz not null default now()
);

comment on constraint memory_insights_entry_count_check on public.memory_insights is
  'The recurrence threshold is a database constraint, not just application logic.';

create index if not exists memory_insights_user_idx on public.memory_insights (user_id, status);

-- ---------------------------------------------------------------------------
-- Integrations and delivery
-- ---------------------------------------------------------------------------

create table if not exists public.integration_connections (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  provider               text not null,
  external_account_label text,
  scopes                 text[] not null default '{}',
  -- A reference to a secret held server-side, never the token itself.
  token_ref              text,
  consent_id             uuid references public.consents (id) on delete set null,
  created_at             timestamptz not null default now(),
  revoked_at             timestamptz,
  unique (user_id, provider)
);

comment on column public.integration_connections.token_ref is
  'Opaque pointer to a secret held in Edge Function secrets. Access tokens are never stored in this table.';

create table if not exists public.delivery_routes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  destination_id  text not null,
  capability_class text not null default 'ready_to_share'
                     check (capability_class in ('in_app', 'on_device', 'connected', 'ready_to_share', 'future_native')),
  target_ref      text,
  target_label    text,
  enabled         boolean not null default false,
  paused          boolean not null default false,
  time_zone       text not null default 'UTC',
  schedule        jsonb not null,
  quiet_hours     jsonb,
  outputs         jsonb not null default '[]'::jsonb,
  consent_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  unique (user_id, destination_id)
);

comment on column public.delivery_routes.enabled is
  'Default false. A destination existing is not the same as it being allowed to send.';

create table if not exists public.delivery_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  route_id        uuid not null references public.delivery_routes (id) on delete cascade,
  output_type     text not null check (output_type in (
                    'daily_scripture', 'reflection', 'prayer_prompt', 'memory_insight', 'journal_entry')),
  status          text not null check (status in (
                    'queued', 'delivered', 'failed', 'skipped', 'revoked', 'prepared')),
  scheduled_for   timestamptz not null,
  delivered_at    timestamptz,
  reason_code     text,
  idempotency_key text not null,
  created_at      timestamptz not null default now(),
  unique (route_id, idempotency_key)
);

comment on table public.delivery_events is
  'Content-free by design: status and reason codes only. The text of a delivery is never written here.';

create index if not exists delivery_events_user_created_idx
  on public.delivery_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Daily Devotional Companion
-- ---------------------------------------------------------------------------

create table if not exists public.daily_companion_settings (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  enabled         boolean not null default false,
  schedule        jsonb not null default '{"frequency":"daily","time":"07:30"}'::jsonb,
  time_zone       text not null default 'UTC',
  inputs          jsonb not null default '{"capture":true,"journal":false,"recent":false}'::jsonb,
  -- Separate from `inputs` on purpose: reading is not the same as sending.
  gloo_consent_at timestamptz,
  updated_at      timestamptz not null default now()
);

create table if not exists public.daily_companion_runs (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users (id) on delete cascade,
  status                   text not null check (status in ('succeeded', 'degraded', 'blocked')),
  trigger                  text not null check (trigger in ('manual', 'scheduled')),
  started_at               timestamptz not null default now(),
  completed_at             timestamptz not null default now(),
  -- Consent snapshot: what the run was permitted to read at the time it ran.
  input_selection          text[] not null default '{}',
  input_summary            text not null,
  used_entry_ids           uuid[] not null default '{}',
  passage                  jsonb,
  question                 text,
  gloo_response            jsonb,
  scripture_provider_state text not null check (scripture_provider_state in ('live', 'mock', 'unavailable')),
  gloo_provider_state      text not null check (gloo_provider_state in ('live', 'mock', 'unavailable', 'not_consented')),
  degraded_reason          text,
  created_at               timestamptz not null default now()
);

create index if not exists daily_companion_runs_user_idx
  on public.daily_companion_runs (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Feature flags and audit
-- ---------------------------------------------------------------------------

create table if not exists public.feature_flags (
  id          text primary key,
  enabled     boolean not null default false,
  description text not null,
  updated_at  timestamptz not null default now()
);

comment on table public.feature_flags is
  'Global kill switches. Readable by everyone, writable only by service role.';

create table if not exists public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  event_type  text not null,
  entity_type text not null,
  entity_id   text,
  -- Metadata only. Reflection text, transcripts, prayers, and generated
  -- responses must never be written here.
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_events_user_idx on public.audit_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Timestamps
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

drop trigger if exists delivery_routes_set_updated_at on public.delivery_routes;
create trigger delivery_routes_set_updated_at
  before update on public.delivery_routes
  for each row execute function public.set_updated_at();

-- Create the profile row on sign-up so the client never has to.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
