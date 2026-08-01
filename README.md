# Icthus

**Bring what is real. Return to Christ.**

Icthus begins with life, not Scripture. A person brings what is actually
happening in their day — joy, grief, anxiety, a question, gratitude, a note,
a prayer — and Icthus helps them find a grounded place to begin. Scripture is
not an AI-generated answer; it is God's response to the journey. AI is a
humble companion that illuminates, contextualises, and remembers. It never
replaces Scripture, claims spiritual authority, diagnoses, or manipulates.

Icthus is a mobile-first installable web app (PWA) built for honest seekers,
new believers, people without a church home, and people in sensitive or
restricted regions. It never asks your denomination.

---

## What is real, and what is not

This build is deliberately explicit about its own limits, because a spiritual
companion that overstates what it can do is worse than one that does less.

| Area                                                              | State                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Life-first capture → source-grounded response                     | **Working.** Deterministic, offline-capable, contract-validated                             |
| Private reflections, saved items, deletion, export                | **Working.** Local-first; Supabase-backed once configured                                   |
| Memory engine (consented recurring themes)                        | **Working.** Off by default, evidence-backed, erasable                                      |
| Icthus Everywhere catalog, routes, delivery history               | **Working.** Honestly classified per destination                                            |
| Daily Devotional Companion                                        | **Working** against local adapters, with a private inspectable transcript                   |
| Scripture text                                                    | **World English Bible (public domain).** Licensed translations arrive with YouVersion       |
| YouVersion Platform API                                           | **Not connected.** Adapter and feature flag in place; needs an approved app                 |
| Gloo AI Studio API                                                | **Not connected.** Adapter and OAuth shape documented; needs approved credentials           |
| Slack / Discord / Notion delivery                                 | **Not connected.** Routes configurable and testable; nothing is sent                        |
| iMessage, WhatsApp, Instagram, Messenger, TikTok, ChatGPT, Claude | **Ready to share only.** No API exists for a third party to post on your behalf             |
| iOS Lock/Home Screen widgets                                      | **Not possible from a web app.** Documented as future native work                           |
| Voice transcription                                               | **Recording works locally.** No transcription provider configured; you write the transcript |
| Photo / OCR capture                                               | **Off.** Feature-flagged, not part of this release                                          |

Nothing in the UI reports a mocked provider as "Connected". See
[`docs/integration-boundaries.md`](docs/integration-boundaries.md).

---

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. With no environment configured, Icthus runs
local-only: reflections stay in this browser's IndexedDB and nothing is
uploaded. The whole product experience — capture, response, Memory, Everywhere,
the Daily Companion — works in that mode.

To connect a backend, copy `.env.example` to `.env` and fill in the two
Supabase values. See [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md).

### Commands

| Command                  | What it does                                    |
| ------------------------ | ----------------------------------------------- |
| `npm run dev`            | Vite dev server                                 |
| `npm run build`          | Typecheck, then production build                |
| `npm test`               | Unit, contract and component tests (Vitest)     |
| `npm run test:e2e`       | Playwright, on iPhone WebKit and desktop Chrome |
| `npm run lint`           | ESLint                                          |
| `npm run typecheck`      | TypeScript, strict                              |
| `npm run secretscan`     | Fails on any credential-shaped string           |
| `npm run seed:generate`  | Regenerates `supabase/seed.sql` from the corpus |
| `npm run icons:generate` | Regenerates the PWA icon set                    |

---

## Architecture

```
icthus/
  apps/web/              React 19 + TypeScript + Vite PWA
    src/routes/          One file per addressable route
    src/components/      UI kit, app shell, content surfaces
    src/lib/             Repositories, providers, hooks, env
  packages/core/         Domain logic — no React, no DOM
    src/contracts.ts     Response contract + validation
    src/corpus.ts        Public-domain Scripture and sources
    src/destinations.ts  Capability catalog (the honesty layer)
    src/memory.ts        Consented recurrence engine
    src/safety.ts        Crisis routing
    src/providers/       Adapter interfaces + local implementations
  supabase/
    migrations/          Versioned SQL; RLS on every user table
    functions/           Deno Edge Functions (privileged operations)
  docs/                  ADRs, policy, setup, build status
```

**The rule that shapes the codebase:** screens never talk to a vendor. They
talk to an adapter interface, and the adapter reports its own state
(`live` / `mock` / `unavailable`), which the UI renders verbatim.

### Storage modes

Icthus runs in one of two modes, chosen at runtime:

- **Local** — no Supabase configured, or signed out. Everything lives in
  IndexedDB in this browser. Drafts are kept in a separate store so an
  unauthenticated draft can never be swept into a sync.
- **Supabase** — signed in. Every read and write passes through Row Level
  Security; a bug in the client cannot expose another person's reflections.

Both implement the same `IcthusRepository` interface.

---

## Safety and theology

- Scripture is authoritative and always leads the response. AI only illuminates.
- The response contract is validated before rendering: every citation must
  resolve to a source record that retrieval actually returned, and the
  rationale is rejected if it claims personal divine instruction.
- Sources from a particular tradition are labelled as such and never presented
  as a condition of being met where you are.
- Input suggesting immediate danger suppresses devotional generation entirely
  and returns support resources instead.
- Icthus is not emergency support, medical or psychological care, confession or
  absolution, spiritual direction, or a replacement for a local church.

Full detail in [`docs/source-policy.md`](docs/source-policy.md).

## Privacy

- Private by default. No advertising SDK, no session replay, no analytics on
  journal or response views.
- Memory is off until turned on, and turning it off deletes what it derived.
- Delivery logs record status and reason codes only, never content.
- Export and delete are in the app, not a support request.
- Provider keys live in Supabase Edge Function secrets and never reach the
  browser bundle.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Security issues:
[`SECURITY.md`](SECURITY.md).

## Licence

Apache-2.0. See [`LICENSE`](LICENSE).

Scripture in this repository is the **World English Bible**, which is in the
public domain. Supporting sources are public-domain editions of historic
Christian writings, each carrying its own attribution. No copyrighted Bible
text or scraped content is stored in this repository, and none may be added.
