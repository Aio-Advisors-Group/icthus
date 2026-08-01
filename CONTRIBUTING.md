# Contributing to Icthus

Thank you for wanting to help. A few things about this codebase are unusual,
and they matter more than the usual style rules.

## The three rules that are not negotiable

### 1. Never claim a capability the product does not have

This is the single most important rule here. If Icthus cannot post to WhatsApp,
the UI says so in plain language. If Gloo is mocked, the transcript says "Local
sample content", not "Connected". If a widget needs a native extension, the
route cannot be enabled.

The capability catalog in `packages/core/src/destinations.ts` is the mechanism:
each destination declares a class, and delivery modes, route validation, and the
server-side dispatcher all derive from it. Do not add a UI affordance that
implies more than the class allows.

### 2. Never log user content

No reflection text, transcript, prayer, generated response, or Scripture study
content may enter a log line, an audit record, a delivery event, an analytics
payload, or an error report. `delivery_events` and `audit_events` take
identifiers, counts, and reason codes only.

ESLint bans bare `console.log`. The Edge Functions use `logEvent()`, which only
accepts scalars.

### 3. Scripture leads, and every claim is cited

A companion response is validated by `validateCompanionResult()` before it can
render. If you change response generation, it still has to pass — including the
rule that every citation must resolve to a source that retrieval actually
returned, and the guardrail against claiming personal divine instruction.

## Getting set up

```bash
npm install
npm run dev
```

No backend is needed. The app runs local-first and the whole product experience
works without any credentials.

## Before you open a pull request

```bash
npm run lint && npm run typecheck && npm test && npm run test:e2e
```

```bash
npm run secretscan
```

If you touched `packages/core/src/corpus.ts`:

```bash
npm run seed:generate
```

CI fails if `supabase/seed.sql` is stale.

If you added or changed a destination, the Deno mirror in
`supabase/functions/_shared/capabilities.ts` must be updated to match.
`capabilityMirror.test.ts` enforces this.

## Commits

Conventional Commits:

```
feat(everywhere): add Notion route editor
fix(safety): match expanded negations in crisis patterns
docs(providers): document Gloo OAuth scopes
```

Keep pull requests small and focused. A PR that changes a safety pattern, a
consent gate, an RLS policy, or the source corpus should change only that.

## Code style

- TypeScript strict. No `any`, no non-null assertions on values that can be
  absent.
- Domain logic lives in `packages/core` and does not import React or touch the
  DOM. If it needs a browser API, it belongs in `apps/web`.
- Screens talk to adapter interfaces, never to a vendor SDK directly.
- Comments explain _why_, not _what_. Most of the comments in this codebase
  exist to record a decision someone would otherwise undo.

## Adding a destination

1. Add it to `DESTINATIONS` with an honest `capability` and a `limitation` that
   names the specific platform constraint.
2. Mirror it in `supabase/functions/_shared/capabilities.ts`.
3. Run the tests — `routes.test.ts` and `capabilityMirror.test.ts` will tell you
   if the classification is inconsistent.
4. Add an E2E assertion if the destination introduces a new limitation people
   need to see.

## Adding a passage or source

1. Add it to `packages/core/src/corpus.ts`.
2. **Public domain only.** Copyrighted Bible text and licensed translations
   must never be committed. Licensed content comes from the YouVersion adapter
   at runtime.
3. Author its guidance entry in `providers/companion.ts` — the reflection must
   be 80–220 words, or the contract test fails.
4. Run `npm run seed:generate`.

## Reporting security issues

See [`SECURITY.md`](SECURITY.md). Please do not open a public issue.
