# Build status

**As of 2026-07-31.** Local build complete and verified. Not yet published —
see "Blocked" below.

## Done and verified

Everything here was exercised end to end, not just written.

### Product

- **Life-first capture → Scripture.** Write / Speak / Note, optional purpose,
  offline draft autosave, deterministic source-grounded response. Verified in
  a browser and by E2E.
- **Response contract.** Acknowledgement, theme, primary passage with exact
  reference and translation attribution, invitation-framed rationale, 80–220
  word reflection, up to three cited supporting sources, prayer prompt,
  optional next step, citation ledger. Validated before render.
- **Crisis routing.** Devotional generation is suppressed entirely on input
  indicating immediate danger; support resources render instead. The person is
  also warned _before_ submitting.
- **Study detail, Explore, Saved,** private reflection timeline, entry deletion
  that also removes derived saved items.
- **Memory engine.** Off by default. Deterministic, sensitive-category
  exclusion, ≥3-entry recurrence, evidence with entry links, hide / correct /
  erase.
- **Icthus Everywhere.** 19 destinations across the prototype's five groups,
  each honestly classified. Route editor with outputs, delivery mode, schedule,
  quiet hours, preview, test, pause, revoke, delete. Content-free delivery
  history.
- **Daily Devotional Companion.** Schedule, per-input consent, separate Gloo
  consent, run-now, and a private transcript showing exactly what was read,
  what was composed, what was sent, and which provider answered.
- **Privacy.** In-app export (JSON), delete-everything, per-entry Memory
  exclusion, consent toggles.

### Engineering

- **Supabase.** 3 migrations covering 19 tables; RLS enabled on all, forced on
  the sensitive ones; anon has no grants on any user table; private
  path-scoped storage buckets; seed generated from the canonical corpus.
- **4 Edge Functions:** `account-delete`, `asset-upload-url`,
  `delivery-dispatch`, `daily-companion-run`. Rate limited, CORS-allowlisted,
  content-free logging.
- **PWA.** Manifest, hand-written service worker with offline shell, original
  ichthys icons generated from a mathematical construction.
- **GitHub Actions.** CI (secret scan → lint → format → typecheck → tests →
  seed-drift check → build) and a Pages deploy gated on CI passing.

### Test results

```
npm run secretscan   Secret scan clean.
npm run lint         clean
npm run format:check All matched files use Prettier code style!
npm run typecheck    clean
npm test             9 files, 74 tests passed
npm run test:e2e     74 tests passed (iPhone WebKit + desktop Chrome)
npm run build        built, 4 chunks, no warnings
```

## Intentionally mocked or feature-flagged

Each of these renders its true state in the UI. Nothing here displays as
"Connected".

| Thing                                                                                                                      | State                                                                                               | Why                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **YouVersion Platform**                                                                                                    | Local public-domain corpus (WEB); UI says "Local sample content"                                    | No registered app or approved content licence. The adapter shell is not implemented against guessed endpoints on purpose |
| **Gloo AI Studio**                                                                                                         | Deterministic local fallback; deployed scheduled/manual Edge runs call Completions V2 after consent | OAuth client credentials, billing, and a successful deployment verification                                              |
| **Companion generation**                                                                                                   | Deterministic, offline, contract-validated                                                          | A real implementation, not a placeholder — it is the offline fallback and what the eval suite asserts against            |
| **Slack / Discord / Notion**                                                                                               | Routes configurable and testable; every delivery records `skipped / provider_unavailable`           | No OAuth apps                                                                                                            |
| **Transcription**                                                                                                          | Recording and playback work locally; the person writes the transcript                               | No provider key. Icthus will not invent words nobody said                                                                |
| **OCR**                                                                                                                    | Off                                                                                                 | Flagged out of this release                                                                                              |
| **iMessage, WhatsApp, Instagram, Messenger, TikTok, ChatGPT, Claude, Apple Notes, Calendar, church/family/sermon exports** | "Ready to share" — Icthus prepares, you send                                                        | No API exists for a third party to post on your behalf. This will not change with credentials                            |
| **Lock / Home Screen widgets**                                                                                             | "Future native extension"; cannot be enabled                                                        | Needs a native WidgetKit extension. A web app cannot provide one                                                         |
| **Supabase persistence**                                                                                                   | Local-only (IndexedDB) until env vars are set                                                       | Not yet linked — see below                                                                                               |

## Blocked on you

Two logins. Both CLIs are installed (`gh` 2.97.0, `supabase` 2.111.0); both
sign-in flows are interactive and cannot be completed for you.

**Approved target:** `Bahrcompany/icthus`, **public**, deployed to
`https://bahrcompany.github.io/icthus/`, backed by the existing Supabase
project `htqqvhxgkqzxcbzcnlzd`.

### 1. GitHub — needs `gh auth login`

The repository is initialised locally on `main` with eight commits and is ready
to push. Nothing on GitHub has been created, modified, or pushed to.

```bash
gh auth login
```

Then:

```bash
cd "icthus" && gh repo create Bahrcompany/icthus --public --source=. --remote=origin --push
```

Then enable Pages: repository → Settings → Pages → Source: **GitHub Actions**.

The first push triggers CI. The Pages deploy only runs after CI passes.

### 2. Supabase — needs `supabase login`

The project is not linked. It has not been connected to, inspected, or modified
in any way.

```bash
supabase login
```

```bash
cd "icthus" && supabase link --project-ref htqqvhxgkqzxcbzcnlzd
```

Then follow [`SUPABASE_SETUP.md`](../SUPABASE_SETUP.md) from step 3. It walks
through reviewing the migrations, applying them, seeding, auth redirect URLs,
function deployment, secrets, and the two cron jobs.

**Review the migrations before applying them.** They are additive and touch
only Icthus's own tables, but it is your project and you should see what runs.

### 3. Provider access — when you have it

`docs/PROVIDER_SETUP.md` lists exactly what to request from YouVersion and
Gloo, which redirect URLs to register, and which variable names to set. No
code changes are needed to _configure_ them; the YouVersion and Gloo adapter
methods need their real endpoints filled in from the official docs once
approved.

## Immediate next steps

1. ~~Approve the repository name and visibility.~~ Approved: `Bahrcompany/icthus`, public.
2. `gh auth login`, then `gh repo create … --push`.
3. Enable Pages → GitHub Actions.
4. `supabase login && supabase link`, review migrations, apply.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Actions secrets.
6. Register the YouVersion app and the Gloo OAuth client.
7. Fill in the two adapter shells, run their contract tests, then flip the
   flags.

## Known gaps

Stated plainly rather than left to be discovered:

- **No theological or editorial review** of the corpus, prompts, or safety copy
  has been performed. The engineering package requires one before public
  release.
- **No application-level envelope encryption** of journal bodies. Data is
  encrypted in transit and at rest by Supabase's platform controls, but a
  database compromise would expose plaintext entries.
- **No security review or penetration test.**
- **RLS integration tests are not automated.** Policies are written and
  reviewable, and `SUPABASE_SETUP.md` step 11 includes manual verification
  queries, but there is no test that runs two authenticated clients and asserts
  isolation. This is the highest-value gap to close next.
- **Theme extraction is English-only** and keyword-based; it will miss
  paraphrase. See ADR 0003.
- **Deep links return HTTP 404** with correct content — the standard GitHub
  Pages SPA limitation. See ADR 0002.
- **The dependency audit in CI is advisory** and does not block a release.
- **Sign in with Apple** is designed for but not shipped; it needs the native
  wrapper.
