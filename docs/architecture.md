# Architecture

## System boundaries

```
┌─────────────────────────────────────────────────────────────┐
│  PWA client (React 19 + Vite, static → GitHub Pages)         │
│                                                              │
│  routes/          screens, one per addressable URL           │
│  components/      UI kit, app shell, content surfaces        │
│  lib/                                                        │
│    AppProvider    composition root — picks every adapter     │
│    repository     IcthusRepository (local | supabase)        │
│    hooks          TanStack Query bindings                    │
└───────┬──────────────────────────────────┬──────────────────┘
        │                                  │
        │ signed out / no backend          │ signed in
        ▼                                  ▼
┌──────────────────┐          ┌───────────────────────────────┐
│  IndexedDB       │          │  Supabase                     │
│  entries, saved  │          │  Auth (magic link)            │
│  drafts, routes  │          │  Postgres + RLS               │
│  companion runs  │          │  Storage (private buckets)    │
└──────────────────┘          │  Edge Functions (Deno)        │
                              │  pg_cron → scheduled jobs     │
                              └───────────┬───────────────────┘
                                          │ service role + secrets
                                          ▼
                              ┌───────────────────────────────┐
                              │  Providers                    │
                              │  YouVersion · Gloo            │
                              │  Slack · Discord · Notion     │
                              │  transcription · model        │
                              └───────────────────────────────┘
```

**No client ever calls a provider with a privileged key.** Provider secrets
exist only in Edge Function secrets.

## packages/core

Pure domain logic. No React, no DOM, no network. This is where the rules live,
which is why it is also where almost all of the tests are.

| Module              | Responsibility                                                    |
| ------------------- | ----------------------------------------------------------------- |
| `contracts.ts`      | Response contract, Zod schemas, `validateCompanionResult`         |
| `corpus.ts`         | Public-domain Scripture and supporting sources, retrieval ranking |
| `themes.ts`         | Deterministic extraction, sensitive-category list                 |
| `safety.ts`         | Crisis classification and support copy                            |
| `memory.ts`         | Consented recurrence engine with evidence                         |
| `destinations.ts`   | Capability catalog — the honesty layer                            |
| `routes.ts`         | Delivery route model and validation                               |
| `schedule.ts`       | Timezone-aware next-run and quiet hours                           |
| `dailyCompanion.ts` | Companion run orchestration and input minimisation                |
| `flags.ts`          | Feature flags and integration health                              |
| `providers/`        | Adapter interfaces plus local implementations                     |

## The adapter pattern

Every external capability sits behind an interface, and each adapter reports
its own `providerState`:

```
ScriptureProvider        LocalScriptureProvider | YouVersionScriptureProvider
CompanionProvider        DeterministicCompanionProvider | (server LLM)
FaithConnectionProvider  MockGlooProvider | GlooStudioProvider
TranscriptionProvider    ManualTranscriptionProvider | HostedTranscriptionProvider
DestinationProvider      InApp | WebNotification | ShareCard | Connected | Unsupported
```

The UI renders `providerState` verbatim. `mock` displays as "Local sample
content", never as "Connected". This is the mechanism that makes the honesty
requirement structural rather than a matter of remembering.

`createDeliveryProvider()` derives the adapter from the destination's declared
capability class, so a new destination cannot accidentally receive a more
capable adapter than its class permits.

## Request flow: a reflection

1. Capture composer autosaves a draft to IndexedDB (never uploaded).
2. On submit, `classifySafety()` runs first. Urgent risk short-circuits to the
   support contract and no devotional content is generated.
3. `retrievalThemes()` extracts themes deterministically.
4. `ScriptureProvider.search()` returns ranked passages; the top one is primary.
5. Supporting sources are selected from the same themes, capped at three.
6. `DeterministicCompanionProvider` composes the response from those retrieved
   records only.
7. `validateCompanionResult()` checks shape, word bounds, citation resolution
   against the retrieved set, and the authority guardrail. A failure throws
   rather than rendering.
8. The entry and response are written through the active repository.

## Request flow: a companion run

1. Read the input-selection consent (stored separately from the schedule).
2. `buildInputSummary()` derives what may leave: a bounded excerpt of today's
   capture, and counts only for everything else.
3. Retrieve Scripture for the extracted themes.
4. `composeQuestion()` builds one bounded question — written by Icthus, not by
   a model — including explicit instructions against authority claims and
   clinical advice.
5. Check the _separate_ Gloo consent. Without it the run is `degraded`: the
   question is composed and stored, and nothing is sent.
6. Call the provider. Failure or absence yields `degraded` with the input
   preserved.
7. Persist the full transcript with a consent snapshot and true provider states.

## Data protection layers

1. **Database.** RLS on every user-owned table, forced on the sensitive ones.
   `anon` has no grants on any user table.
2. **Storage.** Private buckets, path-owner policies, signed URLs from a
   function that re-verifies ownership.
3. **Functions.** JWT verification, per-user rate limiting, explicit CORS
   allowlist, typed confirmation for destructive operations.
4. **Logs.** Content-free by construction — status codes, reason codes,
   identifiers, and counts.
5. **Client.** Drafts in a separate IndexedDB store so an unauthenticated draft
   cannot be swept into a sync.

## Testing strategy

| Layer     | Tool         | What it protects                                                                                            |
| --------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| Domain    | Vitest       | Contract validation, safety routing, memory gating, route validation, scheduling, capability classification |
| Mirror    | Vitest       | Edge Function capability table cannot drift from the catalog                                                |
| Component | Vitest + RTL | Citations render, provider badges stay honest, memory states an observation                                 |
| E2E       | Playwright   | Every route navigates, the full capture flow, consent gates, a11y smoke, mobile viewport                    |

E2E runs against a production build on iPhone WebKit and desktop Chrome,
because a route that only works under the dev server is not a working route.
