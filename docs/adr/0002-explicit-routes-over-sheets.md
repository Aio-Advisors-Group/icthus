# ADR 0002 — Explicit routes, not sheets

**Status:** Accepted · 2026-07-31

## Context

The interaction prototype implemented its entire information architecture as
hidden bottom sheets toggled by a CSS class. Navigation worked by calling
`openSheet(id)`; nothing had a URL.

That is reasonable for a prototype and unworkable as a product:

- No deep link. "Open your Icthus Everywhere settings" cannot be a link.
- No refresh. Reloading always returns to Today.
- No back button.
- Nothing is testable. A click test cannot assert that navigation happened,
  because nothing changes.
- A single JavaScript error at startup makes the entire app unreachable, since
  every transition depends on the handler being bound.

## Decision

Every screen is an addressable React Router route, including the nested
settings surfaces:

```
/  /capture  /explore  /saved  /you
/you/everywhere
/you/everywhere/destinations
/you/everywhere/destinations/:destinationId
/you/everywhere/schedule
/you/daily-companion  /you/memory  /you/integrations
/entry/:id  /study/:reference
/privacy  /onboarding  /auth/*
```

Bottom navigation is five `NavLink`s in a `<nav aria-label="Primary">`, fixed
above content, never covered by an overlay.

Because GitHub Pages cannot rewrite unknown paths to `index.html`, the deploy
workflow copies `index.html` to `404.html`. A deep link returns HTTP 404 with
the app's HTML, the bundle loads from absolute base-path URLs, and the router
resolves the path client-side. This is verified in `e2e/navigation.spec.ts`.

## Consequences

Deep links, refresh, and the back button all work. Every route is covered by a
Playwright test that fails if a startup error prevents navigation.

The accepted cost is the 404 status code on deep links — a known GitHub Pages
limitation. Moving to a host with rewrite support (or adding one) would remove
it; nothing else in the app would change.
