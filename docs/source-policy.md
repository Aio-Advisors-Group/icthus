# Source and theology policy

## The core commitment

Scripture is authoritative and always the primary source in an interpretive
response. AI illuminates and organises; it never replaces Scripture, and it
never speaks for God.

Icthus is Christ-centred, Scripture-first, and hospitable before it is
denominational. Membership in a denomination, prior church literacy, and
agreement with any in-app tradition are never conditions of welcome. There is
no denomination selector in this product and there will not be one.

## Source hierarchy

1. **Sacred Scripture** — licensed or public-domain translations, exact
   references.
2. **Immediate literary and historical context** from the approved corpus.
3. **Church Fathers and historic Christian witnesses**, from approved editions,
   clearly labelled by source.
4. **Editorially approved secondary scholarship**, clearly labelled.
5. **Tradition-specific sources** (Catholic, Orthodox, Protestant, evangelical)
   only on request or plainly labelled as one tradition's teaching — never
   presented as a prerequisite for meeting Jesus.

Every source card carries title, author, locator, edition, rights, and a
canonical URL where one exists. A card from a specific tradition renders a
visible tradition badge.

## What is in this repository

**Scripture:** the World English Bible, which is in the public domain. This is
a licensing decision, not a placeholder. Copyrighted Bible text must never be
committed to this repository, and `supabase/seed.sql` is generated from the
same corpus so the two cannot drift apart.

**Supporting sources:** public-domain editions of Augustine, Thomas à Kempis,
Julian of Norwich, Brother Lawrence, John Chrysostom, and Teresa of Ávila. Each
carries its edition and translator so the attribution is checkable.

When YouVersion is connected, licensed translations are fetched at runtime
under that provider's terms — displayed, attributed, and cached according to
their rules, and never written into this repository.

## The response contract

Every non-crisis response must contain, and is validated to contain:

- a compassionate, concise, non-diagnostic acknowledgement;
- one short sentence naming the theme the person stated — not a verdict;
- a primary Scripture passage with exact reference, translation, and provider
  attribution;
- a rationale framed as invitation ("may", "might"), never as certainty;
- an 80–220 word reflection grounded in the retrieved sources;
- zero to three supporting source cards, each cited;
- a prayer or prayer prompt;
- one optional next faithful action, framed as an invitation;
- a memory insight only when consent, evidence, and confidence gates all pass.

`validateCompanionResult()` enforces this before anything reaches a screen. It
checks the shape, the word bounds, that every citation resolves to a source the
retrieval step actually returned, that the primary passage carries its own
citation, and that no displayed source is uncited.

## Guardrails

The validator rejects a response whose rationale or reflection asserts personal
divine instruction — phrases of the form "God is telling you to…", "God wants
you to…", "you are being called to…". The product may say _"This passage may
help you reflect on…"_. It may not say _"God is telling you…"_.

Icthus must never:

- claim divine revelation or private knowledge of God's will for a person;
- offer sacramental absolution, assign penance, or replace confession;
- present itself as clergy, spiritual director, therapist, or physician;
- fabricate a quotation, reference, translation, saint, teaching, or URL;
- adjudicate a person's conscience;
- argue denominations or treat one tradition as a test of belonging.

## Safety routing

Classification is a routing decision, never a clinical assessment, and the
matched text is never recorded — only a signal class.

- **normal** — the ordinary devotional contract.
- **pastoral_support** — devotional content plus a gentle suggestion to involve
  a person the reader trusts.
- **urgent_support** — devotional generation is skipped entirely. The response
  is presence, local emergency guidance, and an explicit statement that Icthus
  is not emergency support and cannot contact anyone.

The classifier matches contracted and expanded negations alike, and covers
named relations as well as pronouns, because someone in crisis does not write
carefully.

## Editorial process

Sources enter the corpus with `approval_status` and a version. Only `approved`
rows are readable through RLS. The corpus is defined once in
`packages/core/src/corpus.ts`; the database seed is generated from it, and CI
fails if the two diverge.

Before public release, the prompts, corpus, safety copy, and a red-team test set
(hallucination, proof-texting, crisis handling, manipulation, privacy leakage,
denominational hostility) require human editorial and theological review. That
review has **not** been performed on this build.
