# Supabase setup — project `htqqvhxgkqzxcbzcnlzd`

This connects Icthus to the **existing** Supabase project. Do not create a
replacement project. Everything below is additive: it creates objects prefixed
by Icthus's own domain and does not drop, alter, or read anything else already
in the project.

Dashboard: https://supabase.com/dashboard/project/htqqvhxgkqzxcbzcnlzd

> **Before you run anything:** open the dashboard and check whether the project
> already contains tables, buckets, or functions belonging to something else.
> If it does, read "Sharing the project" at the bottom first.

---

## 1. Install and authenticate the CLI

```bash
brew install supabase/tap/supabase
```

```bash
supabase login
```

That opens a browser and stores a token locally. Do not paste an access token
into a chat, a file, or a commit.

## 2. Link the project

From the repository root:

```bash
supabase link --project-ref htqqvhxgkqzxcbzcnlzd
```

It will ask for the database password (dashboard → Settings → Database). The
CLI stores it in `supabase/.temp/`, which is gitignored.

## 3. Review the migrations before applying them

Read them first. There are three, and they are short:

- `supabase/migrations/20260731000001_initial_schema.sql` — tables
- `supabase/migrations/20260731000002_rls_policies.sql` — Row Level Security
- `supabase/migrations/20260731000003_storage_buckets.sql` — private buckets

Dry run against the linked project:

```bash
supabase db diff --linked --schema public
```

Then apply:

```bash
supabase db push
```

## 4. Seed the source corpus

`supabase/seed.sql` is generated from `packages/core/src/corpus.ts` and contains
only public-domain content. Apply it with:

```bash
supabase db push --include-seed
```

Or paste its contents into the dashboard SQL editor. It is idempotent — every
insert has an `on conflict do update`.

## 5. Create the storage buckets

Migration `…0003` creates them. Verify in **Storage** that all three exist and
that **Public** is off for each:

| Bucket           | Contents                                       | Limit |
| ---------------- | ---------------------------------------------- | ----- |
| `icthus-audio`   | Voice recordings                               | 25 MB |
| `icthus-images`  | Photo captures (feature-flagged, unused today) | 10 MB |
| `icthus-exports` | Generated data exports                         | 50 MB |

Clients never receive a storage key. An Edge Function issues a short-lived
signed URL, and the object path (`<user_id>/<entry_id>/<asset_id>.<ext>`) is
what the RLS policies check.

## 6. Configure Auth

Dashboard → **Authentication → Providers → Email**:

- Enable email provider
- Enable **magic link**
- Disable **Confirm password** (Icthus has no password flow)

Dashboard → **Authentication → URL Configuration**:

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Site URL      | `https://bahrcompany.github.io/icthus/`                                                       |
| Redirect URLs | `https://bahrcompany.github.io/icthus/auth/callback`<br>`http://localhost:5173/auth/callback` |

The trailing path matters — the app's callback route is `/auth/callback`
relative to the Pages base path.

## 7. Deploy the Edge Functions

```bash
supabase functions deploy account-delete
```

```bash
supabase functions deploy asset-upload-url
```

```bash
supabase functions deploy delivery-dispatch --no-verify-jwt
```

```bash
supabase functions deploy daily-companion-run --no-verify-jwt
```

The last two are invoked by the scheduler rather than by a signed-in person, so
they authenticate with a shared secret they check on every request instead of a
JWT.

## 8. Set the Edge Function secrets

Names only below — put real values in the command, never in a file.

```bash
supabase secrets set ICTHUS_ALLOWED_ORIGINS="https://bahrcompany.github.io,http://localhost:5173"
```

```bash
supabase secrets set ICTHUS_SCHEDULER_SECRET="$(openssl rand -hex 32)"
```

```bash
supabase secrets set ICTHUS_DISPATCH_WINDOW_MINUTES=15
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the Edge runtime automatically. Do not set them yourself and never
put the service-role key anywhere near the web app.

Provider secrets (Gloo, YouVersion, Slack, Discord, Notion) are covered in
[`docs/PROVIDER_SETUP.md`](docs/PROVIDER_SETUP.md). Until they are set, the
corresponding features report themselves as unconfigured, which is correct.

## 9. Schedule the jobs

Dashboard → **SQL Editor**. Replace both placeholders with the value you
generated in step 8 and the project ref:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'icthus-delivery-dispatch',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://htqqvhxgkqzxcbzcnlzd.supabase.co/functions/v1/delivery-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scheduler-secret', '<ICTHUS_SCHEDULER_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'icthus-daily-companion',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://htqqvhxgkqzxcbzcnlzd.supabase.co/functions/v1/daily-companion-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scheduler-secret', '<ICTHUS_SCHEDULER_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Both run every 15 minutes and each job only acts on routes whose local wall-clock
time falls inside that window, which is how a single cron entry serves users in
every timezone.

## 10. Add the GitHub Actions secrets

Repository → **Settings → Secrets and variables → Actions**:

| Type   | Name                     | Value                                        |
| ------ | ------------------------ | -------------------------------------------- |
| Secret | `VITE_SUPABASE_URL`      | `https://htqqvhxgkqzxcbzcnlzd.supabase.co`   |
| Secret | `VITE_SUPABASE_ANON_KEY` | Dashboard → Settings → API → `anon` `public` |

Variables (optional, all default to off):

`VITE_FEATURE_YOUVERSION`, `VITE_FEATURE_GLOO`, `VITE_FEATURE_COMPANION_LLM`,
`VITE_FEATURE_TRANSCRIPTION`, `VITE_FEATURE_OCR`,
`VITE_FEATURE_CONNECTED_DELIVERY`.

The anon key is safe to ship in the bundle — it is a public identifier, and RLS
is what protects the data. **Never** add the service-role key here.

## 11. Verify

```bash
supabase db lint --linked
```

Then in the SQL editor, confirm no user-owned table is missing protection:

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;
```

Every Icthus table should show `rls_enabled = true`. And confirm each has at
least one policy:

```sql
select tablename, count(*) as policies
from pg_policies where schemaname = 'public'
group by tablename order by tablename;
```

Finally, sign in to the deployed app, write one reflection, and check it appears
in **Table Editor → entries** with your `user_id` — and that signing in as a
second account shows none of the first account's rows.

---

## Local development against a local stack

```bash
supabase start
```

```bash
supabase db reset
```

`db reset` applies every migration plus `seed.sql` to a throwaway local
database. Point `.env` at the local URL and anon key that `supabase start`
prints. Emails land in Inbucket at http://localhost:54324.

## Sharing the project

If `htqqvhxgkqzxcbzcnlzd` already hosts something else:

- Every Icthus table name is listed in `20260731000001_initial_schema.sql`.
  Check for collisions before pushing.
- The migrations only `create table if not exists` and add policies to their own
  tables. Nothing drops or truncates.
- The `on_auth_user_created` trigger on `auth.users` is the one shared object.
  If another application already has a trigger there, merge the two rather than
  replacing — `handle_new_user()` only inserts an Icthus profile row and exits.

## Rollback

Migrations are additive and take no destructive action. To remove Icthus from
the project entirely, drop its tables in reverse dependency order, delete the
three buckets, unschedule both cron jobs, and delete the four functions. Take a
backup first (Database → Backups).
