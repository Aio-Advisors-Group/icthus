# ADR 0001 — Supabase and GitHub Pages, not AWS

**Status:** Accepted · 2026-07-31

## Context

Icthus needs authentication, a relational store with per-user isolation, object
storage, scheduled jobs, and a place to hold provider secrets. It also needs to
be deployable and reviewable by a small team under contest time pressure, and
to be open-sourceable without shipping infrastructure nobody can run.

## Decision

Supabase for Auth, Postgres, Storage, Edge Functions, and scheduling.
GitHub Pages for the static client. No AWS, no Terraform, no Redis, no
separately managed server.

The client is a React + Vite PWA that builds to static files. Every privileged
operation runs in a Deno Edge Function.

## Consequences

**Good.** Row Level Security gives per-user isolation in the database rather
than in application code, which is where it actually belongs for a product
holding private journals. There is one deploy target for the client and one for
the backend. A contributor can run the whole stack locally with
`supabase start`.

**Costs, accepted.**

- Edge Functions run on Deno and cannot import the bundler-resolved
  `@icthus/core` workspace package. See ADR 0004.
- GitHub Pages has no server-side rewriting, so deep links rely on a
  `404.html` fallback and return a 404 status while rendering correctly. See
  ADR 0002.
- Rate limiting uses a database table rather than an in-memory store. At this
  scale that is fine; at a much larger one it would not be.
- Vector search for the memory engine is deferred; the current extractor is
  deterministic and needs no embeddings. See ADR 0003.
