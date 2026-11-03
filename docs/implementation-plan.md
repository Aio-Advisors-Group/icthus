# Icthus — implementation plan

Maps the requirements in `Icthus_Engineering_Package.txt` (v3.0), the Claude
Code build prompt, and `Icthus_PRD.md` onto the milestones in this repository.

Where the sources disagree, the order of precedence used throughout is: the
build prompt, then the engineering package, then the current standalone
prototype, then earlier prototypes. Product truthfulness, consent, platform
limits, and security override any of them.

## Corrections made to the prototype

The standalone prototype is the interaction reference, but several of its
states are simulated in ways that would be untrue in a shipped product. These
were changed deliberately:

| Prototype behaviour                                                | What this build does                                                                              | Why                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Apple Notes shown as connected, "Sync reflections automatically"   | Classified `ready_to_share`; copy states Icthus cannot sync or read Notes                         | iOS provides no background Notes access to a web app  |
| YouVersion and Gloo both show a green "Connected" pill             | Show "Local sample content" / "Not permitted yet" until credentials exist                         | A mocked provider must never render as live           |
| Companion run shows "✓ Delivered" for a mock call                  | Run status is `succeeded`/`degraded`/`blocked`, with the provider state printed on the transcript | Nothing is reported as delivered that was not         |
| Widget style options include "Streak — days you have shown up"     | Removed entirely                                                                                  | No streaks or gamification anywhere in the product    |
| iMessage/WhatsApp/etc. described as "A message to yourself, daily" | Classified `ready_to_share` with the specific platform limitation named                           | These platforms expose no API for third-party sending |
| Lock/Home Screen widgets configurable                              | Classified `future_native`; cannot be enabled                                                     | Requires a native WidgetKit extension                 |
| Navigation is hidden sheets only                                   | Every screen is an addressable React Router route                                                 | Deep links, refresh, and testability                  |
| NIV passage text                                                   | World English Bible (public domain)                                                               | Shipping copyrighted Bible text is not permissible    |

## Milestones

### M1 — Foundation

_Requirements: build prompt §3, §4A, §7; package §04 frontend architecture._

- npm workspace monorepo: `apps/web`, `packages/core`, `supabase/`, `docs/`.
- React 19 + TypeScript (strict) + Vite 6 + Tailwind v4 token layer.
- React Router with explicit routes for every screen; five-item bottom nav.
- PWA manifest, hand-written service worker, generated original ichthys icons.
- ESLint, Prettier, secret scan, GitHub Actions CI.

**Done when:** every bottom-nav item navigates visibly and a deep link loads on
refresh, verified by Playwright.

### M2 — Supabase core

_Requirements: build prompt §5; package §04 backend, database schema._

- Versioned SQL migrations for all required tables plus `consents`,
  `audit_events`, and the Daily Companion tables.
- RLS enabled and forced on every user-owned table; `auth.uid() = user_id`.
- Private storage buckets with path-owner policies.
- Seed generated from the canonical corpus (`npm run seed:generate`).
- Magic-link auth, local-first fallback when Supabase is unconfigured.

**Done when:** every user-owned table has an owner-only policy and the seed
matches the corpus (CI-enforced).

### M3 — Life-first flow

_Requirements: build prompt §4B; package FR-01, FR-02, FR-08–FR-11; PRD §5._

- Capture composer with Write / Speak / Note and an optional purpose selector.
- IndexedDB draft autosave before sign-in; never uploaded without confirmation.
- Deterministic companion adapter producing a contract-validated response.
- Study detail, saved items, private reflection timeline, entry deletion.

**Done when:** the response contract validates against retrieved sources and
every reflection stays within its word bounds (unit-tested per passage).

### M4 — Memory engine

_Requirements: build prompt §4C; package memory engine, FR-13._

- Off by default; opt-in only.
- Deterministic extraction, sensitive-category exclusion, ≥3-entry recurrence.
- Insight cards cite count, window, and the entry IDs behind them.
- View entries / hide theme / correct / erase controls.

**Done when:** Memory produces nothing before opt-in and never surfaces a
sensitive category (unit-tested).

### M5 — You and Daily Devotional Companion

_Requirements: build prompt §4E; package FR-07, acceptance criterion 15._

- `/you` with a large, clickable Icthus Everywhere card.
- `/you/daily-companion`: schedule, input consent, run-now, private transcript.
- Input selection stored as a data-processing consent, snapshotted per run.
- Separate Gloo consent; bounded question composed by Icthus, not the model.

**Done when:** a run without Gloo consent composes but does not send, and every
transcript prints its true provider state.

### M6 — Icthus Everywhere

_Requirements: build prompt §4D; package FR-03–FR-07, criteria 11–14._

- Destination catalog in the prototype's five groups, honestly classified.
- Route editor: outputs, delivery mode, schedule, quiet hours, preview, test,
  pause, revoke, delete.
- Content-free delivery event history.
- Second confirmation before a raw journal entry can be routed.

**Done when:** a `ready_to_share` destination cannot be configured for
automatic delivery and a `future_native` destination cannot be enabled at all.

### M7 — Providers and media

_Requirements: build prompt §4F; package YouVersion/Gloo/voice/OCR sections._

- `ScriptureProvider`, `CompanionProvider`, `FaithConnectionProvider`,
  `TranscriptionProvider`, `DestinationProvider` interfaces with mocks.
- Integration health screen naming exactly what each provider is waiting on.
- Voice recording with local playback, retention choice, editable transcript.
- OCR behind a flag, off for this release.

**Done when:** no screen can report a provider as connected when it is not.

### M8 — Hardening

_Requirements: build prompt §5, §6, §7; package non-functional requirements._

- WCAG AA pass: one `h1` per route, 44px targets, labels, focus, reduced motion.
- Export, entry deletion, account deletion, consent toggles.
- Crisis-aware copy and support routing.
- Unit, component, and Playwright suites green.

### M9 — Deploy

_Requirements: build prompt §9, §10._

- Pages workflow with correct base path and SPA fallback.
- `SUPABASE_SETUP.md` for the existing project `drtjcdzwlzevajlubxzc`.
- `docs/PROVIDER_SETUP.md` for YouVersion and Gloo.
- `docs/build-status.md`.

**Blocked on:** GitHub authentication and one explicit approval to create
`Bahrcompany/icthus`. See `docs/build-status.md`.

## Acceptance criteria coverage

| Package criterion                                        | Where it is verified                                     |
| -------------------------------------------------------- | -------------------------------------------------------- |
| 1. Sign in, submit a pasted note, save privately         | `e2e/capture.spec.ts`, Note mode in `Capture.tsx`        |
| 2. Record, edit and submit a transcript                  | `VoiceRecorder.tsx`; transcription honestly unconfigured |
| 3. Response has passage, citation, prayer, next action   | `providers/companion.test.ts`, `e2e/capture.spec.ts`     |
| 4. Every supporting source resolves                      | `validateCompanionResult` + contract tests               |
| 5. View, export, delete an entry and response            | `Privacy.tsx`, `EntryDetail.tsx`, `e2e/capture.spec.ts`  |
| 6. Memory absent until opt-in, erasable                  | `memory.test.ts`, `e2e/settings.spec.ts`                 |
| 7. Crisis prompts trigger support                        | `safety.test.ts`, `e2e/capture.spec.ts`                  |
| 8. Provider outages degrade without losing work          | `dailyCompanion.test.ts`                                 |
| 9. Mobile accessibility                                  | `e2e/accessibility.spec.ts` (iPhone WebKit project)      |
| 10. CI gates release                                     | `.github/workflows/ci.yml`                               |
| 11. Configure a route with a precise preview             | `RouteEditor.tsx`, `e2e/settings.spec.ts`                |
| 12. Connected routes stop on pause/revoke                | `routes.test.ts`, `e2e/settings.spec.ts`                 |
| 13. Share-only platforms labelled, never automatic       | `routes.test.ts`, `e2e/settings.spec.ts`                 |
| 14. No journal plaintext in logs                         | content-free `delivery_events`; `audit()` metadata only  |
| 15. Companion inputs, manual run, inspectable transcript | `dailyCompanion.test.ts`, `e2e/settings.spec.ts`         |
