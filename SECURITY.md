# Security policy

Icthus holds people's private spiritual reflections. That is sensitive personal
data, and a breach here is not an inconvenience — it is a betrayal of the one
thing this product promises.

## Reporting a vulnerability

Email **security@bahrcompany.com** with:

- what you found and where,
- how to reproduce it,
- what an attacker could reach with it.

Please do not open a public issue for a vulnerability, and please do not test
against other people's accounts. If you need an account to demonstrate
something, create your own.

We aim to acknowledge within 3 working days and to keep you updated until it is
resolved. We will credit you in the fix unless you prefer otherwise.

## Scope

In scope: this repository, the deployed web app, the Supabase schema and RLS
policies, and the Edge Functions.

Out of scope: the security of Supabase, GitHub Pages, or any third-party
provider themselves — report those to the vendor.

## What we consider critical

- Any path by which one person can read, modify, or delete another person's
  entries, responses, saved items, memory data, routes, or companion runs.
- Any leak of the Supabase service-role key or a provider secret.
- Any journal content, transcript, prayer, or generated response appearing in a
  log, an audit record, a delivery event, an analytics payload, or an error
  report.
- Delivery of content to a destination the person did not explicitly authorise.
- A raw journal entry leaving Icthus without its second, separate consent.

## Design commitments

These are enforced in code and tests, not just intended:

- **RLS on every user-owned table.** Every policy is `auth.uid() = user_id`,
  and `force row level security` is set on the tables holding entries and
  responses. There is no policy anywhere that permits cross-user reads.
- **The anon role has no access to any user table.** A signed-out client keeps
  drafts in IndexedDB rather than writing to the database.
- **Privileged work happens only in Edge Functions.** The service-role key is
  never in the browser bundle, and the web app has no code path that could use
  it.
- **Storage is private, path-scoped.** Objects live at
  `<bucket>/<user_id>/<entry_id>/<asset_id>`, and the policies check the first
  path segment against `auth.uid()`. Clients receive short-lived signed URLs
  issued by a function that re-verifies ownership.
- **Content-free logs.** `delivery_events` stores status and reason codes.
  `audit_events` stores identifiers and counts. `logEvent()` takes only scalar
  fields. ESLint bans bare `console.log`.
- **Rate limiting on expensive endpoints**, backed by the audit table, failing
  closed if the counter cannot be read.
- **Explicit CORS allowlist** on the functions rather than `*`.
- **Secret scanning in CI**, running before any other step, with a rule
  specifically for service-role JWTs.

## If a credential leaks

1. Rotate it immediately in the provider console (Supabase: Settings → API →
   roll the key).
2. Revoke the exposed value.
3. Purge it from git history — rotation alone is not enough if it was committed.
4. Check `audit_events` for unexpected activity in the exposure window.
5. If any user data may have been reached, notify affected users promptly and
   plainly.

## Known limitations of this build

Stated so nobody has to discover them:

- Application-level envelope encryption of journal bodies is **not**
  implemented. Data is encrypted in transit and at rest by Supabase's managed
  platform controls, but a database compromise would expose plaintext entries.
- No penetration test or third-party security review has been performed.
- No theological or editorial review of the corpus and safety copy has been
  performed.
- The dependency audit step in CI is advisory (`continue-on-error`) and does not
  yet block a release.
