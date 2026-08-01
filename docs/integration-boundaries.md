# Integration boundaries

What Icthus can and cannot do in each place a person might want it, and why.

This document exists because the honest answer is often "less than you'd hope",
and a product that blurs that is one that will eventually surprise someone with
their own private writing in a place they did not expect.

## The five capability classes

Every destination in the catalog carries exactly one of these. The class is
enforced in code, not just displayed: `allowedDeliveryModes()` derives from it,
route validation rejects any mismatch, and the Edge Function dispatcher
independently refuses to deliver to anything outside the `connected` class.

| Class                       | Meaning                                                      | Automatic delivery?         |
| --------------------------- | ------------------------------------------------------------ | --------------------------- |
| **In Icthus**               | Stays on the person's own account inside the app             | Yes                         |
| **On this device**          | Web notification from the installed PWA                      | Yes, with permission        |
| **Connected**               | Real OAuth/API integration to a target the person authorised | Yes, once credentials exist |
| **Ready to share**          | Icthus prepares a card; the person sends it                  | Never                       |
| **Future native extension** | Requires a native iOS app Icthus does not ship               | Never; cannot be enabled    |

## Per-destination detail

### Connected — real API, currently uncredentialed

**Slack, Discord, Notion.** These platforms do provide APIs that permit posting
to a channel or page a person has authorised. The route model, consent record,
scheduler, delivery queue, event history, and test endpoint are all built. What
is missing is an OAuth app and its tokens.

Until those exist, every delivery records `skipped / provider_unavailable`, and
the route editor refuses to enable the route at all. It does not queue work it
cannot do.

### Ready to share — no API exists for this

**iMessage.** Apple provides no API for a third-party app to send an iMessage.
The App Store's own messaging integrations are share-sheet extensions. Icthus
prepares the card and opens the share sheet; the person taps send.

**WhatsApp.** Sending on a person's behalf requires WhatsApp Business API
approval, a business account, and template message approval. Icthus has none of
these and does not claim to.

**Instagram, TikTok, Messenger.** None permit a third-party app to post to a
personal account unattended. Icthus generates the card.

**ChatGPT, Claude.** Neither exposes an API that lets an unrelated app inject a
message into a person's own conversation. Icthus generates a block to paste —
which is genuinely useful, and is exactly what it says it is.

**Apple Notes.** This one is worth being precise about, because the prototype
claimed otherwise. iOS gives a web app **no** access to Notes: not read, not
write, not background sync, not indexing. Import into Icthus is a paste or a
share-sheet hand-off the person performs each time. Export to Notes is the same
in reverse. There is no version of this that happens quietly.

**Calendar.** Icthus generates a calendar file. It cannot read your calendar or
create events in it.

**Church App, Family Group, Sermon Notes.** Generic exports. There is no common
API across church apps, and Icthus never contacts a church on anyone's behalf.

### Future native extension — not possible from a web app

**iOS Lock Screen and Home Screen widgets.** These require a WidgetKit
extension compiled into a native app and distributed through the App Store. An
installed PWA is not a native app and cannot provide one. Adding Icthus to your
home screen installs the web app; it does not create a widget.

This is the distinction the prototype elided, and it matters: "add to home
screen" and "home screen widget" sound similar and are completely different
capabilities. These destinations appear in the catalog — people ask for them —
but they cannot be enabled, and the route editor says why.

## Provider integrations

### YouVersion Platform

Required workstream. The `ScriptureProvider` interface is in place with two
implementations: a local public-domain corpus and a `YouVersionScriptureProvider`
shell.

The shell is deliberately **not** implemented against guessed endpoints. Writing
a plausible-looking request that has never run produces code that reviews as
integrated and fails in production — worse than an explicit gap. Once the app is
registered and approved, its documented endpoints go into that class and the
contract tests run against it unchanged.

Until then: passages come from the World English Bible, the UI reports "Local
sample content", and no protected content is scraped, cached, or reproduced.

### Gloo AI Studio

Required workstream. `FaithConnectionProvider` with a deterministic local
adapter and a `GlooStudioProvider` shell carrying the OAuth 2.0 client
credentials shape.

Every request is bounded and source-grounded: a passage, a short derived
**summary** of consented inputs, and one question composed by Icthus rather than
by the model. Full journal content is never sent. The request requires a
purpose-specific consent that is separate from the input selection — allowing
Icthus to _read_ something is not the same as allowing it to be _sent_.

Church recommendation and recruitment flows are not implemented, and will not be
without an approved Gloo capability plus explicit user consent.

### Transcription

Recording, playback, and deletion work locally. With no provider configured,
Icthus returns `manual_required` rather than a fabricated transcript — the
person writes what they said, in the same editable field a machine transcript
would land in. Audio defaults to being deleted once a transcript is confirmed.

### OCR

Feature-flagged and off. When enabled, extracted text is always editable and
marked as draft, images are deleted after extraction by default, and OCR is
never used to identify people or infer emotion.

## What "never" means here

Regardless of configuration, Icthus will not:

- send anything to a destination the person has not explicitly set up;
- route a raw journal entry without a second, separate confirmation;
- route content that was flagged by the safety classifier;
- deliver a memory insight while Memory is off;
- write reflection text, transcripts, prayers, or generated responses into any
  log, audit record, or delivery event;
- use private content for advertising, training, or church outreach without a
  separately revocable opt-in.
