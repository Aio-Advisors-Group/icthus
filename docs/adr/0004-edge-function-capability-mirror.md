# ADR 0004 — The Edge Function capability mirror

**Status:** Accepted · 2026-07-31

## Context

`packages/core/src/destinations.ts` is the single source of truth for what
Icthus can do at each destination. It is the mechanism that keeps the product
honest: delivery modes, route validation, and the UI badges all derive from a
destination's declared capability class.

The delivery dispatcher needs the same knowledge. But it runs as a Supabase
Edge Function on Deno, which cannot resolve the `@icthus/core` workspace package
— that resolution is done by Vite's bundler and by npm workspaces, neither of
which exists in the Deno runtime.

Three options:

1. **Bundle core into each function.** Adds a build step to the deploy path and
   an artifact nobody reviews.
2. **Query the capability from the database.** Makes the honesty rule a data
   value that could be edited in a dashboard, which is precisely the wrong place
   for it.
3. **Duplicate the mapping and enforce agreement in CI.**

## Decision

Option 3. `supabase/functions/_shared/capabilities.ts` holds a minimal mirror:
destination id to capability class, plus the set of classes the server may ever
deliver to (`connected` only).

`packages/core/src/capabilityMirror.test.ts` parses that file and fails if it
covers a different set of destinations than the catalog, or assigns any of them
a different class.

## Consequences

**Good.** The functions stay plain Deno files that can be read and deployed
without a build step. The duplication cannot drift: a destination classified
`ready_to_share` in the app and `connected` on the server would be exactly the
dishonesty the catalog exists to prevent, and CI stops it.

The dispatcher also enforces the rule independently rather than trusting the
route row — a route pointing at a non-`connected` destination is recorded as
skipped, whatever the database says.

**Costs, accepted.** Two files to update when adding a destination, and a test
that parses TypeScript with a regex. The test is brittle to formatting changes
in the mirror, which is tolerable because it fails loudly and the fix is
obvious. `CONTRIBUTING.md` documents the two-file step.
