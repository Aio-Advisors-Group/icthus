import type { ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';

/**
 * The app frame.
 *
 * Bottom navigation is five real links, always above the content and never
 * covered by an overlay. The prototype used hidden sheets as its only
 * navigation; here every destination is an addressable route.
 */

const NAV_ITEMS = [
  { to: '/', label: 'Today', glyph: '⌂', end: true },
  { to: '/explore', label: 'Explore', glyph: '⌕', end: false },
  { to: '/capture', label: 'Capture', glyph: '＋', end: false, prominent: true },
  { to: '/saved', label: 'Saved', glyph: '♡', end: false },
  { to: '/you', label: 'You', glyph: '◌', end: false },
] as const;

export function BottomNav(): ReactNode {
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-[460px] -translate-x-1/2 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_94%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="m-0 flex list-none items-center justify-around p-0">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex min-h-[60px] w-full flex-col items-center justify-center gap-1 py-2',
                  'text-[10px] no-underline transition-colors duration-150',
                  isActive ? 'font-extrabold text-[var(--ink)]' : 'text-[var(--muted)]',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={
                      'prominent' in item && item.prominent
                        ? 'grid h-[46px] w-[46px] -translate-y-2 place-items-center rounded-full bg-[var(--ink)] text-[20px] text-[var(--paper)] shadow-lg'
                        : 'text-[20px]'
                    }
                  >
                    {item.glyph}
                  </span>
                  <span className={'prominent' in item && item.prominent ? '-mt-2' : ''}>
                    {item.label}
                  </span>
                  {isActive ? <span className="sr-only">(current page)</span> : null}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AppHeader(): ReactNode {
  return (
    <header className="flex h-[54px] items-center justify-between">
      <Link
        to="/"
        aria-label="Icthus home"
        className="flex min-h-[44px] items-center gap-2 no-underline text-[var(--ink)]"
      >
        <span aria-hidden="true" className="text-[18px] text-[var(--gold)]">
          ◒
        </span>
        <span className="ic-serif text-[21px] font-bold tracking-[0.04em]">ICHTHUS</span>
      </Link>
      <Link
        to="/you"
        aria-label="You and settings"
        className="grid h-11 w-11 place-items-center rounded-full text-[20px] text-[var(--ink)] no-underline"
      >
        <span aria-hidden="true">◌</span>
      </Link>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }): ReactNode {
  const location = useLocation();
  return (
    <div className="mx-auto min-h-[100svh] w-full max-w-[460px] bg-[var(--paper)] px-[18px] pt-[env(safe-area-inset-top)] pb-[calc(96px+env(safe-area-inset-bottom))]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-[var(--ink)] focus:px-4 focus:py-2 focus:text-[var(--paper)]"
      >
        Skip to content
      </a>
      <AppHeader />
      {/* Keying on pathname resets scroll position between routes. */}
      <main id="main" key={location.pathname} tabIndex={-1}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

/** Header for a nested settings screen: a back link plus the page title. */
export function SubPageHeader({
  backTo,
  backLabel,
  title,
  lede,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  lede?: string;
}): ReactNode {
  return (
    <div className="mb-4">
      <Link
        to={backTo}
        className="mb-4 inline-flex min-h-[44px] items-center gap-2 text-[13px] font-semibold text-[var(--gold)] no-underline"
      >
        <span aria-hidden="true">‹</span> {backLabel}
      </Link>
      <h1 className="ic-serif m-0 text-[27px] leading-tight font-normal">{title}</h1>
      {lede ? (
        <p className="mt-3 mb-0 text-[14px] leading-relaxed text-[var(--muted)]">{lede}</p>
      ) : null}
    </div>
  );
}
