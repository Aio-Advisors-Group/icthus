# ADR 0003 — Deterministic theme extraction before embeddings

**Status:** Accepted · 2026-07-31

## Context

The Memory engine's job is to notice that a theme keeps recurring in someone's
own saved reflections and to offer that observation back — with evidence, and
with the ability to hide, correct, or erase it.

The obvious implementation is embeddings plus clustering. For this product that
is the wrong first move:

- A cluster is not explainable. "These seven entries are semantically similar"
  is not something a person can check, disagree with, or correct.
- Embedding drift silently changes past insights.
- It requires a vector store and a model call before anything works at all,
  which means the offline path and the eval suite both stop existing.
- Most importantly, semantic similarity is very good at surfacing exactly the
  categories that must never be surfaced — health, sexuality, finances — because
  those cluster strongly.

## Decision

A deterministic keyword extractor (`packages/core/src/themes.ts`) with an
explicit rule table, a version string, and an explicit sensitive-category list.

It recognises words the person actually wrote. It does not infer mood,
diagnose, or model personality. Retrieval and Memory use it differently on
purpose: retrieval includes sensitive themes (someone writing about a diagnosis
should still be met with Scripture about fear), Memory excludes them entirely.

Insight gating requires: Memory enabled, entry inside the chosen window, entry
not excluded, theme not sensitive, theme not hidden, and at least three
_distinct entries_ containing it. The three-entry threshold is also a database
constraint, not only application logic.

## Consequences

**Good.** Every insight is explainable and checkable: it cites the entry IDs
behind it, and the person can open them. It works offline, is fully unit
tested, and is deterministic — the same entries always produce the same
insight. Turning Memory off deletes derived data with nothing left dormant.

**Costs, accepted.** It misses paraphrase: "I'm at the end of my rope" does not
match the weariness keywords. It is English-only. It will under-report rather
than over-report, which is the correct direction for this feature.

The schema (`memory_themes`, `memory_insights`) carries `extractor_version`, and
`pgvector` is available in the project, so an embedding-based extractor can be
added behind the same interface later. When it is, it must keep the evidence
contract: an insight that cannot name the entries behind it does not ship.
