# Provider setup

Registration and configuration for the external integrations. **Variable names
only — never put a real value in this file, in any other file, or in a chat.**

Everything here is optional in the sense that Icthus works without it. Nothing
here is optional in the sense that the contest requires YouVersion and Gloo.

---

## YouVersion Platform

**Console:** https://platform.youversion.com/platform/get-started

### What to request

- An application registered to the Icthus project.
- Scopes covering Bible **version metadata** and **passage text retrieval**.
- Confirmation of which translations the licence permits displaying, and
  whether full passage text may be shown or only a reference plus an approved
  preview and link.
- The caching policy: how long passage text may be stored, and whether it may
  be persisted at all.
- Attribution and branding requirements — exact copyright line, placement, and
  any required link back.

### Redirect URLs (if an OAuth flow is required)

```
https://bahrcompany.github.io/icthus/auth/callback
http://localhost:5173/auth/callback
```

### Secrets

```bash
supabase secrets set YOUVERSION_APP_ID=...
supabase secrets set YOUVERSION_API_KEY=...
supabase secrets set YOUVERSION_API_BASE_URL=...
supabase secrets set YOUVERSION_DEFAULT_VERSION_ID=...
```

Then set the repository variable `VITE_FEATURE_YOUVERSION=true`.

### Implementation

`packages/core/src/providers/scripture.ts` → `YouVersionScriptureProvider`.

Every method currently throws a descriptive "not configured" error. That is
deliberate: the class is not implemented against guessed endpoints, because
code that looks integrated and has never run is worse than an explicit gap.

Fill in the four methods from the official documentation. The rest of the app
needs no changes — it only knows the `ScriptureProvider` interface. Run the
contract tests against the real provider before enabling the flag.

### Rules that do not change

- Never scrape YouVersion or any other Bible site.
- Never substitute an unapproved third-party Bible API.
- Never commit licensed translation text to this repository.
- If full text cannot be displayed under the licence, show the canonical
  reference, the approved preview or link, and Icthus's own commentary.
- A provider outage must degrade to the local public-domain corpus with a
  visible, non-alarming state — never destroy a capture.

---

## Gloo AI Studio

**Console:** https://studio.ai.gloo.com/

### What to request

- An OAuth 2.0 **client credentials** application.
- The token endpoint URL and API base URL.
- Approved scopes for the values-aligned AI / retrieval capability Icthus uses.
- Written confirmation of what may be sent, retained, and logged on their side.
- Whether any contest-specific capability applies.

### Secrets

```bash
supabase secrets set GLOO_CLIENT_ID=...
supabase secrets set GLOO_CLIENT_SECRET=...
supabase secrets set GLOO_TOKEN_URL=...
supabase secrets set GLOO_API_BASE_URL=...
supabase secrets set GLOO_SCOPES=...
```

Then set `VITE_FEATURE_GLOO=true`.

**The client secret must only ever exist in Supabase Edge Function secrets.** It
must never appear in a `VITE_`-prefixed variable, because those are compiled
into the JavaScript bundle and are readable by anyone who opens the page.

### Implementation

`packages/core/src/providers/gloo.ts` → `GlooStudioProvider`, and the
server-side path in `supabase/functions/daily-companion-run/index.ts`.

Two invariants must survive the implementation:

1. **Bounded requests.** A Gloo request carries a passage, a short derived
   _summary_ of consented inputs, and one question composed by Icthus. It never
   carries a person's journal history, and never their raw entries beyond the
   bounded excerpt of today's capture that the transcript displays.
2. **Honest state.** The response's `providerState` is rendered verbatim in the
   run transcript. A mocked or failed call must never display as delivered.

### Not implemented, and gated

Church recommendation and recruitment flows are not built. They require an
approved Gloo capability **and** a separate, explicit user consent, and no
journal content may reach a church connection under any circumstances.

---

## Connected delivery providers

All three are optional. Without them, routes are configurable and testable but
record `skipped / provider_unavailable`, which is what the delivery history
shows.

### Slack

**Console:** https://api.slack.com/apps

- Bot token scopes: `chat:write`, `channels:read`, `groups:read`
- Redirect URL: `https://bahrcompany.github.io/icthus/auth/callback`

```bash
supabase secrets set SLACK_CLIENT_ID=...
supabase secrets set SLACK_CLIENT_SECRET=...
supabase secrets set SLACK_BOT_TOKEN=...
```

### Discord

**Console:** https://discord.com/developers/applications

- Bot permissions: Send Messages, Embed Links
- OAuth scopes: `bot`, `applications.commands`

```bash
supabase secrets set DISCORD_CLIENT_ID=...
supabase secrets set DISCORD_CLIENT_SECRET=...
supabase secrets set DISCORD_BOT_TOKEN=...
```

### Notion

**Console:** https://www.notion.so/my-integrations

- Capabilities: insert content
- Redirect URL: `https://bahrcompany.github.io/icthus/auth/callback`

```bash
supabase secrets set NOTION_CLIENT_ID=...
supabase secrets set NOTION_CLIENT_SECRET=...
supabase secrets set NOTION_TOKEN=...
```

Then set `VITE_FEATURE_CONNECTED_DELIVERY=true`.

The dispatcher checks `connectedProviderConfigured()` per destination, so
enabling one provider does not falsely light up the others.

---

## Optional: server-side companion model

Only add this if you want generated rather than deterministic responses. The
deterministic adapter is a real implementation, not a placeholder, and it is
what makes the offline path and the eval suite work.

```bash
supabase secrets set COMPANION_MODEL_API_KEY=...
supabase secrets set COMPANION_MODEL_BASE_URL=...
supabase secrets set COMPANION_MODEL_NAME=...
```

Then `VITE_FEATURE_COMPANION_LLM=true`.

Non-negotiable: generation runs **server-side only**, the model receives only
the retrieved evidence set, and output is validated by
`validateCompanionResult()` against that same set before it reaches a screen. A
response that cites something retrieval did not return is discarded, not shown.

---

## Optional: transcription

```bash
supabase secrets set TRANSCRIPTION_API_KEY=...
supabase secrets set TRANSCRIPTION_ENDPOINT=...
```

Then `VITE_FEATURE_TRANSCRIPTION=true`.

The transcript remains editable and requires confirmation before it becomes an
entry, whether it came from a machine or a person. Audio retention still follows
the person's own setting, defaulting to deletion after a confirmed transcript.

---

## Testing an integration before enabling it

1. Set the secrets, leave the `VITE_FEATURE_*` flag off.
2. Deploy the functions.
3. Exercise the provider from a local script or the function logs.
4. Run the contract tests against the real provider.
5. Only then set the flag and redeploy.

**You** → **Connections** in the app shows the live state of every provider and
names exactly what each one is still waiting on.
