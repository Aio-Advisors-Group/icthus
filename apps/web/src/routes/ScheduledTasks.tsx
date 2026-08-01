import type { ReactNode } from 'react';
import {
  DELIVERY_EVENT_LABELS,
  DELIVERY_REASON_LABELS,
  describeSchedule,
  findDestination,
  isRouteDeliverable,
  outputTypeSpec,
} from '@icthus/core';
import { useDeliveryEvents, useRoutes } from '../lib/hooks';
import { SubPageHeader } from '../components/AppShell';
import { Badge, Card, EmptyState, LinkButton, Muted, Notice, Spinner } from '../components/ui';

export default function ScheduledTasks(): ReactNode {
  const routes = useRoutes();
  const events = useDeliveryEvents();

  const scheduled = (routes.data ?? []).flatMap((route) => {
    const destination = findDestination(route.destinationId);
    if (!destination) return [];
    return route.outputs
      .filter((output) => output.enabled)
      .map((output) => ({ route, destination, output }));
  });

  return (
    <>
      <SubPageHeader
        backTo="/you/everywhere"
        backLabel="Icthus Everywhere"
        title="Scheduled tasks"
        lede="Everything Icthus is set to send, across every destination."
      />

      {routes.isLoading ? <Spinner /> : null}

      {!routes.isLoading && scheduled.length === 0 ? (
        <EmptyState
          glyph="◌"
          title="Nothing scheduled yet"
          body="Add a destination and choose what it may send. Nothing runs until you say so."
          action={<LinkButton to="/you/everywhere/destinations">Add a destination</LinkButton>}
        />
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {scheduled.map(({ route, destination, output }) => {
            const live = isRouteDeliverable(route);
            return (
              <li key={`${route.id}-${output.outputType}`}>
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--sand)] text-[15px]"
                    >
                      {destination.glyph}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[14px] font-semibold">
                        {destination.name} · {outputTypeSpec(output.outputType).label}
                      </p>
                      <p className="mt-1 mb-0 text-[12px] text-[var(--muted)]">
                        {describeSchedule(route.schedule, route.timeZone)}
                      </p>
                      <p className="mt-1 mb-0 text-[12px] text-[var(--muted)]">
                        {output.deliveryMode === 'automatic'
                          ? 'Sent automatically'
                          : output.deliveryMode === 'prepare_and_prompt'
                            ? 'Prepared, then Icthus reminds you'
                            : 'You share it yourself'}
                      </p>
                    </div>
                    <Badge tone={live ? 'ok' : 'neutral'}>
                      {route.revokedAt
                        ? 'Revoked'
                        : route.paused
                          ? 'Paused'
                          : live
                            ? 'Active'
                            : 'Off'}
                    </Badge>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="history-heading" className="mt-10">
        <h2 id="history-heading" className="ic-serif m-0 mb-2 text-[19px] font-normal">
          Delivery history
        </h2>
        <Muted className="mb-3">
          Status only. Icthus never records the content of a delivery in its logs.
        </Muted>

        {(events.data ?? []).length === 0 ? (
          <Notice>Nothing has been delivered or prepared yet.</Notice>
        ) : (
          <ul className="m-0 list-none p-0">
            {(events.data ?? []).map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="m-0 text-[13px] font-semibold">
                    {outputTypeSpec(event.outputType).label}
                  </p>
                  <p className="mt-1 mb-0 text-[11.5px] text-[var(--muted)]">
                    {new Date(event.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                    {event.reasonCode
                      ? ` · ${DELIVERY_REASON_LABELS[event.reasonCode] ?? event.reasonCode}`
                      : ''}
                  </p>
                </div>
                <Badge
                  tone={
                    event.status === 'delivered'
                      ? 'ok'
                      : event.status === 'failed'
                        ? 'warn'
                        : 'neutral'
                  }
                >
                  {DELIVERY_EVENT_LABELS[event.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
