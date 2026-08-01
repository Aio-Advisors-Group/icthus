import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  CAPABILITY_BADGE,
  CAPABILITY_SPECS,
  describeSchedule,
  findDestination,
  isRouteDeliverable,
  outputTypeSpec,
} from '@icthus/core';
import { useRoutes } from '../lib/hooks';
import { SubPageHeader } from '../components/AppShell';
import { Badge, Card, EmptyState, LinkButton, Muted, Notice, Spinner } from '../components/ui';

export default function Everywhere(): ReactNode {
  const routes = useRoutes();
  const list = routes.data ?? [];

  return (
    <>
      <SubPageHeader
        backTo="/you"
        backLabel="You"
        title="Icthus Everywhere"
        lede="Bring reflections and Scripture into the places you already spend time. Icthus tells you exactly what it can and cannot do in each one."
      />

      <div className="mb-5">
        <Notice title="What “connected” means here">
          Icthus can only deliver on its own where a platform provides an API for it. Everywhere
          else it prepares something for you to send. Every card says which it is.
        </Notice>
      </div>

      <Link
        to="/you/everywhere/schedule"
        className="mb-5 inline-flex min-h-[44px] items-center text-[13px] font-bold text-[var(--gold)] no-underline"
      >
        View scheduled tasks →
      </Link>

      {routes.isLoading ? <Spinner /> : null}

      {!routes.isLoading && list.length === 0 ? (
        <EmptyState
          glyph="◌"
          title="No destinations yet"
          body="Add a place for Icthus to reach you. Nothing is enabled by default, and everything can be paused or revoked."
        />
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {list.map((route) => {
            const destination = findDestination(route.destinationId);
            if (!destination) return null;
            const enabledOutputs = route.outputs.filter((output) => output.enabled);
            const live = isRouteDeliverable(route);
            return (
              <li key={route.id}>
                <Link
                  to={`/you/everywhere/destinations/${destination.id}`}
                  className="block no-underline"
                >
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--sand)] text-[16px]"
                      >
                        {destination.glyph}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-[14.5px] font-semibold text-[var(--ink)]">
                          {destination.name}
                        </p>
                        <p className="mt-1 mb-0 text-[12px] text-[var(--muted)]">
                          {describeSchedule(route.schedule, route.timeZone)}
                        </p>
                        {enabledOutputs.length > 0 ? (
                          <p className="mt-1 mb-0 text-[12px] text-[var(--muted)]">
                            {enabledOutputs
                              .map((output) => outputTypeSpec(output.outputType).label)
                              .join(', ')}
                          </p>
                        ) : null}
                      </div>
                      <Badge tone={live ? 'ok' : route.paused ? 'neutral' : 'warn'}>
                        {route.revokedAt
                          ? 'Revoked'
                          : route.paused
                            ? 'Paused'
                            : live
                              ? CAPABILITY_BADGE[destination.capability]
                              : 'Not enabled'}
                      </Badge>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6">
        <LinkButton to="/you/everywhere/destinations" variant="secondary" full>
          + Add a destination
        </LinkButton>
      </div>

      <section aria-labelledby="capability-key" className="mt-10">
        <h2 id="capability-key" className="ic-serif m-0 mb-3 text-[19px] font-normal">
          What the labels mean
        </h2>
        <dl className="m-0">
          {Object.values(CAPABILITY_SPECS).map((spec) => (
            <div key={spec.id} className="border-b border-[var(--line)] py-3 last:border-b-0">
              <dt className="m-0">
                <Badge tone={spec.allowedDeliveryModes.includes('automatic') ? 'ok' : 'neutral'}>
                  {spec.label}
                </Badge>
              </dt>
              <dd className="m-0 mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">
                {spec.summary}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Muted className="mt-6">
        A raw journal entry is never part of a default selection and always needs its own separate
        confirmation before it can leave Icthus.
      </Muted>
    </>
  );
}
