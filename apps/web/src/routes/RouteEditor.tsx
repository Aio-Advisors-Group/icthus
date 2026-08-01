import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CAPABILITY_BADGE,
  CAPABILITY_SPECS,
  DELIVERY_MODE_LABELS,
  buildShareCard,
  createDeliveryProvider,
  defaultOutputsFor,
  describeSchedule,
  findDestination,
  formatTimeLabel,
  nextRunAt,
  outputTypeSpec,
  resolveTimeZone,
  validateRoute,
  type DeliveryMode,
  type DeliveryRoute,
  type RouteOutput,
} from '@icthus/core';
import { useApp } from '../lib/AppProvider';
import { useMemoryPreferences, useMutateRepository, useRoutes } from '../lib/hooks';
import { SubPageHeader } from '../components/AppShell';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  Muted,
  Notice,
  Switch,
} from '../components/ui';
import { useToast } from '../components/Toast';
import { newId } from '../lib/id';

export default function RouteEditor(): ReactNode {
  const { destinationId } = useParams<{ destinationId: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { repository } = useApp();
  const routesQuery = useRoutes();
  const memory = useMemoryPreferences();

  const destination = destinationId ? findDestination(destinationId) : null;
  const existing = (routesQuery.data ?? []).find((r) => r.destinationId === destinationId) ?? null;

  const [draft, setDraft] = useState<DeliveryRoute | null>(null);
  const [journalConfirm, setJournalConfirm] = useState(false);

  useEffect(() => {
    if (!destination) return;
    if (existing) {
      setDraft(existing);
      return;
    }
    setDraft({
      id: newId(),
      destinationId: destination.id,
      targetRef: null,
      targetLabel: null,
      enabled: false,
      paused: false,
      timeZone: resolveTimeZone(),
      schedule: { frequency: 'daily', time: '07:30' },
      quietHours: { start: '22:00', end: '07:00' },
      outputs: defaultOutputsFor(destination.id),
      consentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      revokedAt: null,
    });
  }, [destination, existing]);

  const saveRoute = useMutateRepository((repo, route: DeliveryRoute) => repo.upsertRoute(route));
  const deleteRoute = useMutateRepository((repo, id: string) => repo.deleteRoute(id));

  const validation = useMemo(() => {
    if (!draft) return null;
    return validateRoute(draft, {
      memoryEnabled: memory.data?.enabled ?? false,
      // No connected provider has real credentials in this build; the flag in
      // env.ts flips this once OAuth apps exist.
      connectedProviderReady: false,
    });
  }, [draft, memory.data?.enabled]);

  if (!destination) {
    return (
      <>
        <SubPageHeader
          backTo="/you/everywhere/destinations"
          backLabel="Destinations"
          title="Unknown destination"
        />
        <EmptyState
          title="That destination does not exist"
          body="It may have been renamed or removed from the catalog."
          action={<LinkButton to="/you/everywhere/destinations">Browse destinations</LinkButton>}
        />
      </>
    );
  }

  const capability = CAPABILITY_SPECS[destination.capability];
  const canAutomate = capability.allowedDeliveryModes.includes('automatic');
  const isFutureNative = destination.capability === 'future_native';

  function patch(next: Partial<DeliveryRoute>): void {
    setDraft((current) => (current ? { ...current, ...next } : current));
  }

  function patchOutput(outputType: string, next: Partial<RouteOutput>): void {
    setDraft((current) =>
      current
        ? {
            ...current,
            outputs: current.outputs.map((output) =>
              output.outputType === outputType ? { ...output, ...next } : output,
            ),
          }
        : current,
    );
  }

  async function handleSave(): Promise<void> {
    if (!draft || !validation) return;
    if (!validation.ok) {
      notify('Check the highlighted settings');
      return;
    }
    await saveRoute.mutateAsync(draft);
    notify(`${destination!.name} saved`);
    navigate('/you/everywhere');
  }

  /**
   * A test delivery runs the real adapter for this capability class, so what
   * you see here is exactly what a scheduled run would do — including the
   * "prepared, not sent" outcome for share-only destinations.
   */
  async function handleTest(): Promise<void> {
    if (!draft) return;
    const provider = createDeliveryProvider(destination!.id, {
      saveInApp: async (payload) => {
        await repository.addSavedItem({
          id: newId(),
          kind: 'scripture',
          title: payload.title,
          body: payload.body,
          reference: payload.reference,
          attribution: payload.attribution,
          sourceId: null,
          entryId: null,
          createdAt: new Date().toISOString(),
        });
      },
      onPrepared: async (card) => {
        if (typeof navigator !== 'undefined' && navigator.share) {
          try {
            await navigator.share({ title: 'Icthus', text: card });
            return;
          } catch {
            /* dismissed — fall through */
          }
        }
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(card);
        }
      },
      host: typeof window !== 'undefined' ? (window as never) : {},
    });

    if (!provider) {
      notify('No adapter for this destination');
      return;
    }

    const payload = {
      routeId: draft.id,
      outputType: 'daily_scripture' as const,
      title: 'Matthew 11:28-30',
      body: '“Come to me, all you who labor and are heavily burdened, and I will give you rest.”',
      reference: 'Matthew 11:28-30',
      attribution: 'WEB · World English Bible (public domain)',
      idempotencyKey: `test-${draft.id}-${Date.now()}`,
      targetRef: draft.targetRef,
    };

    const outcome = await provider.deliver(payload);
    await repository.appendDeliveryEvent({
      id: newId(),
      routeId: draft.id,
      outputType: 'daily_scripture',
      status: outcome.status,
      scheduledFor: new Date().toISOString(),
      deliveredAt: outcome.status === 'delivered' ? new Date().toISOString() : null,
      reasonCode: outcome.reasonCode,
      idempotencyKey: payload.idempotencyKey,
      createdAt: new Date().toISOString(),
    });

    const messages: Record<string, string> = {
      delivered: 'Test delivered',
      prepared: 'Card prepared — nothing was sent for you',
      skipped: `Skipped: ${outcome.reasonCode ?? 'unavailable'}`,
      failed: `Failed: ${outcome.reasonCode ?? 'unknown'}`,
      queued: 'Queued',
      revoked: 'Revoked',
    };
    notify(messages[outcome.status] ?? outcome.status);
  }

  const nextRun =
    draft && draft.enabled && !draft.paused
      ? nextRunAt({
          schedule: draft.schedule,
          timeZone: draft.timeZone,
          quietHours: draft.quietHours,
        })
      : null;

  return (
    <>
      <SubPageHeader
        backTo="/you/everywhere"
        backLabel="Icthus Everywhere"
        title={destination.name}
        lede={destination.description}
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge tone={isFutureNative ? 'warn' : canAutomate ? 'ok' : 'neutral'}>
          {CAPABILITY_BADGE[destination.capability]}
        </Badge>
      </div>

      <div className="mb-6">
        <Notice tone={isFutureNative ? 'warn' : 'neutral'} title="What Icthus can do here">
          {capability.summary} {destination.limitation}
        </Notice>
      </div>

      {!draft ? null : (
        <>
          {/* Enabling is impossible for capability classes that cannot deliver. */}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="m-0 text-[14px] font-semibold">
                  {isFutureNative ? 'Cannot be enabled' : draft.enabled ? 'Enabled' : 'Not enabled'}
                </p>
                <Muted className="mt-1">
                  {isFutureNative
                    ? 'This needs a native app extension. Nothing here will run.'
                    : capability.requiresCredentials
                      ? 'This destination needs a connection that has not been configured in this build.'
                      : 'Icthus will act here only while this is on.'}
                </Muted>
              </div>
              <Switch
                label={`Enable ${destination.name}`}
                checked={draft.enabled}
                disabled={isFutureNative}
                onChange={(next) => patch({ enabled: next })}
              />
            </div>
          </Card>

          {draft.enabled ? (
            <Card className="mt-3 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="m-0 text-[14px] font-semibold">Paused</p>
                  <Muted className="mt-1">
                    Keeps the route and its settings, but stops every delivery immediately.
                  </Muted>
                </div>
                <Switch
                  label={`Pause ${destination.name}`}
                  checked={draft.paused}
                  onChange={(next) => patch({ paused: next })}
                />
              </div>
            </Card>
          ) : null}

          {capability.requiresCredentials ? (
            <div className="mt-6">
              <h2 className="ic-serif m-0 mb-3 text-[19px] font-normal">Where it posts</h2>
              <label htmlFor="target" className="mb-2 block text-[12px] text-[var(--muted)]">
                Channel or conversation
              </label>
              <input
                id="target"
                type="text"
                value={draft.targetLabel ?? ''}
                onChange={(event) =>
                  patch({
                    targetLabel: event.target.value || null,
                    targetRef: event.target.value ? `mock:${event.target.value}` : null,
                  })
                }
                placeholder="#devotions"
                className="min-h-[48px] w-full rounded-[15px] border border-[var(--line)] bg-[var(--surface)] px-4 text-[14px] outline-none focus:border-[var(--gold)]"
              />
              <Muted className="mt-2">
                Once a real OAuth app exists, this becomes a picker of channels you have authorised.
              </Muted>
            </div>
          ) : null}

          <section aria-labelledby="outputs-heading" className="mt-8">
            <h2 id="outputs-heading" className="ic-serif m-0 mb-2 text-[19px] font-normal">
              What Icthus sends here
            </h2>
            <Muted className="mb-3">
              Nothing is selected by default. Choose only what you want to leave Icthus.
            </Muted>

            {draft.outputs.map((output) => {
              const spec = outputTypeSpec(output.outputType);
              const supported = destination.supportedOutputs.includes(output.outputType);
              if (!supported) return null;
              const needsJournalConsent = spec.requiresSeparateConsent && !output.rawEntryConsentAt;

              return (
                <Card key={output.outputType} className="mb-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 text-[14px] font-semibold">
                        {spec.label}
                        {spec.sensitive ? (
                          <span className="ml-2">
                            <Badge tone="warn">Sensitive</Badge>
                          </span>
                        ) : null}
                      </p>
                      <Muted className="mt-1">{spec.description}</Muted>
                    </div>
                    <Switch
                      label={`Send ${spec.label} to ${destination.name}`}
                      checked={output.enabled}
                      disabled={isFutureNative}
                      onChange={(next) => {
                        if (next && spec.requiresSeparateConsent && !output.rawEntryConsentAt) {
                          setJournalConfirm(true);
                          return;
                        }
                        patchOutput(output.outputType, { enabled: next });
                      }}
                    />
                  </div>

                  {output.enabled ? (
                    <fieldset className="m-0 mt-4 border-0 p-0">
                      <legend className="mb-2 text-[12px] text-[var(--muted)]">
                        How it is sent
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {capability.allowedDeliveryModes.map((mode: DeliveryMode) => (
                          <button
                            key={mode}
                            type="button"
                            aria-pressed={output.deliveryMode === mode}
                            onClick={() => patchOutput(output.outputType, { deliveryMode: mode })}
                            className={[
                              'min-h-[44px] rounded-full border px-4 text-[12.5px]',
                              output.deliveryMode === mode
                                ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                                : 'border-[var(--line)] text-[var(--ink)]',
                            ].join(' ')}
                          >
                            {DELIVERY_MODE_LABELS[mode]}
                          </button>
                        ))}
                      </div>
                      {capability.allowedDeliveryModes.length === 0 ? (
                        <Muted>No delivery mode is possible for this destination.</Muted>
                      ) : null}
                    </fieldset>
                  ) : null}

                  {needsJournalConsent && journalConfirm ? (
                    <div className="mt-4">
                      <Notice tone="warn" title="This sends your own words">
                        <p className="m-0 mb-3">
                          You are about to allow Icthus to send the text of your journal entries to{' '}
                          {destination.name}. {destination.limitation}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="danger"
                            className="text-[12px]"
                            onClick={() => {
                              patchOutput(output.outputType, {
                                enabled: true,
                                rawEntryConsentAt: new Date().toISOString(),
                              });
                              setJournalConfirm(false);
                            }}
                          >
                            I understand — allow it
                          </Button>
                          <Button
                            variant="secondary"
                            className="text-[12px]"
                            onClick={() => setJournalConfirm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </Notice>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </section>

          {canAutomate ? (
            <section aria-labelledby="schedule-heading" className="mt-8">
              <h2 id="schedule-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
                When
              </h2>
              <Card className="p-4">
                <label htmlFor="route-time" className="mb-2 block text-[12px] text-[var(--muted)]">
                  Time
                </label>
                <input
                  id="route-time"
                  type="time"
                  value={'time' in draft.schedule ? draft.schedule.time : '07:30'}
                  onChange={(event) =>
                    patch({ schedule: { frequency: 'daily', time: event.target.value } })
                  }
                  className="min-h-[48px] w-full rounded-[15px] border border-[var(--line)] bg-[var(--surface)] px-4 text-[14px] outline-none focus:border-[var(--gold)]"
                />
                <Muted className="mt-2">{describeSchedule(draft.schedule, draft.timeZone)}</Muted>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="m-0 text-[14px] font-semibold">Quiet hours</p>
                    <Muted className="mt-1">
                      {draft.quietHours
                        ? `Nothing arrives between ${formatTimeLabel(draft.quietHours.start)} and ${formatTimeLabel(draft.quietHours.end)} — it waits until after.`
                        : 'Deliveries may arrive at any hour.'}
                    </Muted>
                  </div>
                  <Switch
                    label="Use quiet hours"
                    checked={Boolean(draft.quietHours)}
                    onChange={(next) =>
                      patch({ quietHours: next ? { start: '22:00', end: '07:00' } : null })
                    }
                  />
                </div>
              </Card>

              {nextRun ? (
                <Muted className="mt-3">
                  Next:{' '}
                  {nextRun.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </Muted>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="preview-heading" className="mt-8">
            <h2 id="preview-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
              Preview
            </h2>
            <Card tone="sand" className="p-4">
              <pre className="ic-serif m-0 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                {buildShareCard({
                  routeId: draft.id,
                  outputType: 'daily_scripture',
                  title: 'Matthew 11:28-30',
                  body: '“Come to me, all you who labor and are heavily burdened, and I will give you rest.”',
                  reference: 'Matthew 11:28-30',
                  attribution: 'WEB · World English Bible (public domain)',
                  idempotencyKey: 'preview',
                  targetRef: draft.targetRef,
                })}
              </pre>
            </Card>
          </section>

          {validation && !validation.ok ? (
            <div className="mt-6">
              <Notice tone="warn" title="This route cannot run yet">
                <ul className="m-0 list-disc pl-5">
                  {validation.issues.map((issue) => (
                    <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          ) : null}

          <div className="mt-8 space-y-3">
            <Button full onClick={handleSave} disabled={Boolean(validation && !validation.ok)}>
              Save destination
            </Button>
            <Button full variant="secondary" onClick={handleTest}>
              Send a test
            </Button>
            {existing ? (
              <Button
                full
                variant="danger"
                onClick={async () => {
                  await deleteRoute.mutateAsync(existing.id);
                  notify('Route revoked and deleted');
                  navigate('/you/everywhere');
                }}
              >
                Revoke and delete this route
              </Button>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}
