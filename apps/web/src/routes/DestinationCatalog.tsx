import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CAPABILITY_BADGE, CAPABILITY_SPECS, destinationsByGroup } from '@icthus/core';
import { SubPageHeader } from '../components/AppShell';
import { Badge, Muted, Notice } from '../components/ui';

/**
 * The catalog shows every destination people actually ask for — including the
 * ones Icthus cannot automate. Hiding them would not make the limitation go
 * away; it would just move the disappointment later.
 */
export default function DestinationCatalog(): ReactNode {
  const groups = destinationsByGroup();

  return (
    <>
      <SubPageHeader
        backTo="/you/everywhere"
        backLabel="Icthus Everywhere"
        title="Add a destination"
        lede="Every destination is labelled with what Icthus can genuinely do there."
      />

      <div className="mb-6">
        <Notice>
          Adding a destination does not turn anything on. You choose what it may send, and when, on
          the next screen.
        </Notice>
      </div>

      {groups.map((group) => (
        <section key={group.group} aria-labelledby={`group-${group.group}`} className="mb-8">
          <h2
            id={`group-${group.group}`}
            className="m-0 mb-2 text-[11px] font-extrabold tracking-[0.1em] text-[var(--gold)] uppercase"
          >
            {group.group}
          </h2>
          <ul className="m-0 list-none p-0">
            {group.items.map((destination) => {
              const capability = CAPABILITY_SPECS[destination.capability];
              const automatable = capability.allowedDeliveryModes.includes('automatic');
              return (
                <li key={destination.id}>
                  <Link
                    to={`/you/everywhere/destinations/${destination.id}`}
                    className="flex min-h-[64px] w-full items-center gap-3 border-b border-[var(--line)] py-3 no-underline last:border-b-0"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--sand)] text-[16px]"
                    >
                      {destination.glyph}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-semibold text-[var(--ink)]">
                        {destination.name}
                      </span>
                      <span className="mt-[2px] block text-[12px] leading-snug text-[var(--muted)]">
                        {destination.description}
                      </span>
                    </span>
                    <Badge
                      tone={
                        destination.capability === 'future_native'
                          ? 'warn'
                          : automatable
                            ? 'ok'
                            : 'neutral'
                      }
                    >
                      {CAPABILITY_BADGE[destination.capability]}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Muted>
        “Ready to share” means the platform gives third-party apps no way to post on your behalf.
        “Future native extension” means it needs a native iOS app that Icthus does not ship yet.
      </Muted>
    </>
  );
}
