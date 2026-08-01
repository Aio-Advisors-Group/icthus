import { useState, type ReactNode } from 'react';
import {
  COMPANION_INPUT_SPECS,
  executeCompanionRun,
  formatTimeLabel,
  nextCompanionRun,
  providerBadge,
  type CompanionInputEntry,
  type CompanionInputKind,
  type DailyCompanionRun,
  type DailyCompanionSettings,
} from '@icthus/core';
import { useApp } from '../lib/AppProvider';
import { supabase } from '../lib/supabase';
import {
  useCompanionRuns,
  useCompanionSettings,
  useEntries,
  useMutateRepository,
} from '../lib/hooks';
import { SubPageHeader } from '../components/AppShell';
import { Badge, Button, Card, InfoRow, Muted, Notice, Spinner, Switch } from '../components/ui';
import { useToast } from '../components/Toast';

/**
 * The Daily Devotional Companion.
 *
 * Not a chat screen. It is a scheduled run with an inspectable transcript: the
 * inputs it was allowed to read, the passage it retrieved, the exact question
 * it composed, and what came back — each labelled with which provider actually
 * answered.
 */
export default function DailyCompanion(): ReactNode {
  const { scripture, gloo, session } = useApp();
  const { notify } = useToast();
  const settingsQuery = useCompanionSettings();
  const runsQuery = useCompanionRuns();
  const entriesQuery = useEntries();
  const [running, setRunning] = useState(false);

  const saveSettings = useMutateRepository((repo, settings: DailyCompanionSettings) =>
    repo.setCompanionSettings(settings),
  );
  const appendRun = useMutateRepository((repo, run: DailyCompanionRun) =>
    repo.appendCompanionRun(run),
  );

  const settings = settingsQuery.data;
  // The page heading renders before the data does: a loading screen with no
  // <h1> leaves a screen reader on an untitled page.
  if (settingsQuery.isLoading || !settings) {
    return (
      <>
        <SubPageHeader backTo="/you" backLabel="You" title="Daily Devotional Companion" />
        <Spinner label="Loading your companion" />
      </>
    );
  }

  const nextRun = nextCompanionRun(settings);

  function update(patch: Partial<DailyCompanionSettings>): void {
    if (!settings) return;
    saveSettings.mutate({ ...settings, ...patch, updatedAt: new Date().toISOString() });
  }

  async function handleRunNow(): Promise<void> {
    if (!settings) return;
    setRunning(true);
    try {
      // A signed-in account runs through the Edge Function, so Gloo OAuth
      // credentials and raw entry access remain server-side. Local-only use
      // deliberately retains the deterministic, offline path below.
      const client = supabase();
      if (client && session) {
        const { error } = await client.functions.invoke('daily-companion-run');
        if (error) throw new Error(error.message);
        await runsQuery.refetch();
        notify('Run complete');
        return;
      }

      // Only entries from the last day are offered as companion inputs, and
      // only the kinds the person has allowed are read at all.
      const cutoff = Date.now() - 86_400_000;
      const inputs: CompanionInputEntry[] = (entriesQuery.data ?? [])
        .filter((record) => new Date(record.entry.createdAt).getTime() >= cutoff)
        .map((record, index) => ({
          id: record.entry.id,
          kind: (index === 0
            ? 'capture'
            : record.entry.sourceKind === 'imported_note'
              ? 'journal'
              : 'recent') as CompanionInputKind,
          occurredAt: record.entry.occurredAt,
          body: record.entry.body,
        }));

      const run = await executeCompanionRun(
        { scripture, gloo },
        { settings, entries: inputs, trigger: 'manual' },
      );
      await appendRun.mutateAsync(run);
      notify(
        run.status === 'succeeded'
          ? 'Run complete'
          : run.status === 'blocked'
            ? 'Nothing was selected to read'
            : 'Run finished with a degraded state',
      );
    } finally {
      setRunning(false);
    }
  }

  const scriptureBadge = providerBadge(scripture.state);
  const glooBadge = providerBadge(settings.glooConsentAt ? gloo.state : 'not_consented');

  return (
    <>
      <SubPageHeader
        backTo="/you"
        backLabel="You"
        title="Daily Devotional Companion"
        lede="Rather than asking you to go find Scripture on your own, Icthus meets you in what you have already shared, and gently guides you back toward Jesus through Scripture and trusted Christian tradition."
      />

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="m-0 text-[14px] font-semibold">Run automatically</p>
            <Muted className="mt-1">
              {settings.enabled && nextRun
                ? `Next run ${nextRun.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · ${settings.timeZone}`
                : 'Off — run it yourself with the button below.'}
            </Muted>
          </div>
          <Switch
            label="Run the companion automatically"
            checked={settings.enabled}
            onChange={(next) => update({ enabled: next })}
          />
        </div>

        {settings.enabled ? (
          <div className="mt-4">
            <label htmlFor="companion-time" className="mb-2 block text-[12px] text-[var(--muted)]">
              Time (
              {formatTimeLabel('time' in settings.schedule ? settings.schedule.time : '07:30')})
            </label>
            <input
              id="companion-time"
              type="time"
              value={'time' in settings.schedule ? settings.schedule.time : '07:30'}
              onChange={(event) =>
                update({ schedule: { frequency: 'daily', time: event.target.value } })
              }
              className="min-h-[48px] w-full rounded-[15px] border border-[var(--line)] bg-[var(--surface)] px-4 text-[14px] outline-none focus:border-[var(--gold)]"
            />
          </div>
        ) : null}
      </Card>

      <section aria-labelledby="inputs-heading" className="mt-8">
        <h2 id="inputs-heading" className="ic-serif m-0 mb-2 text-[19px] font-normal">
          Listens to
        </h2>
        <Muted className="mb-3">
          This is a data-processing choice, stored separately from the schedule. Changing it affects
          the next run only — a past run keeps the permissions it had when it happened.
        </Muted>

        {COMPANION_INPUT_SPECS.map((spec) => (
          <InfoRow
            key={spec.id}
            glyph={spec.id === 'capture' ? '✎' : spec.id === 'journal' ? '◒' : '◔'}
            title={spec.label}
            subtitle={spec.description}
            trailing={
              <Switch
                label={`Allow the companion to read ${spec.label}`}
                checked={settings.inputs[spec.id]}
                onChange={(next) => update({ inputs: { ...settings.inputs, [spec.id]: next } })}
              />
            }
          />
        ))}
      </section>

      <section aria-labelledby="providers-heading" className="mt-8">
        <h2 id="providers-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
          Draws from
        </h2>
        <InfoRow
          glyph="✧"
          title="YouVersion"
          subtitle="Passage and translation source"
          trailing={<Badge tone={scriptureBadge.tone}>{scriptureBadge.label}</Badge>}
        />
        <InfoRow
          glyph="◈"
          title="Gloo"
          subtitle="Theological reasoning layer"
          trailing={<Badge tone={glooBadge.tone}>{glooBadge.label}</Badge>}
        />

        <div className="mt-4">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="m-0 text-[14px] font-semibold">Allow Icthus to send to Gloo</p>
                <Muted className="mt-1">
                  Sends a short summary of the inputs above plus one question. Never your full
                  journal. You can see exactly what was sent in every transcript below.
                </Muted>
              </div>
              <Switch
                label="Allow Icthus to send a bounded question to Gloo"
                checked={Boolean(settings.glooConsentAt)}
                onChange={(next) =>
                  update({ glooConsentAt: next ? new Date().toISOString() : null })
                }
              />
            </div>
          </Card>
        </div>

        {gloo.state !== 'live' ? (
          <div className="mt-4">
            <Notice title="Gloo is not connected in this build">
              Runs use a local adapter that never leaves this device. Every transcript is labelled
              accordingly — Icthus will not show a run as delivered when it was not.
            </Notice>
          </div>
        ) : null}
      </section>

      <div className="mt-8">
        <Button full onClick={handleRunNow} disabled={running}>
          {running ? 'Running…' : 'Run now'}
        </Button>
      </div>

      <section aria-labelledby="transcript-heading" className="mt-10">
        <h2 id="transcript-heading" className="ic-serif m-0 mb-2 text-[19px] font-normal">
          Run history
        </h2>
        <Muted className="mb-4">Private to you. Nothing here has been shared anywhere.</Muted>

        {(runsQuery.data ?? []).length === 0 ? (
          <Notice>No runs yet. Use “Run now” to see exactly what the companion does.</Notice>
        ) : (
          <ul className="m-0 list-none space-y-4 p-0">
            {(runsQuery.data ?? []).map((run) => (
              <li key={run.id}>
                <RunTranscript run={run} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function RunTranscript({ run }: { run: DailyCompanionRun }): ReactNode {
  const glooLabel = providerBadge(run.glooProviderState);
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="m-0 text-[12px] text-[var(--muted)]">
          {new Date(run.startedAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}{' '}
          · {run.trigger === 'manual' ? 'Run by you' : 'Scheduled'}
        </p>
        <Badge
          tone={run.status === 'succeeded' ? 'ok' : run.status === 'blocked' ? 'neutral' : 'warn'}
        >
          {run.status === 'succeeded'
            ? 'Complete'
            : run.status === 'blocked'
              ? 'Blocked'
              : 'Degraded'}
        </Badge>
      </div>

      {run.degradedReason ? (
        <div className="mb-3">
          <Notice tone="warn">{run.degradedReason}</Notice>
        </div>
      ) : null}

      <div className="rounded-[12px] bg-[var(--sand)] px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
        <span className="font-bold text-[var(--ink)]">What it read: </span>
        {run.inputSummary}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {run.passage ? (
          <div className="max-w-[92%] self-start rounded-[16px] rounded-bl-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <span className="mb-1 block text-[10px] font-bold tracking-[0.09em] text-[var(--gold)] uppercase">
              Scripture · {run.passage.reference} ({run.passage.translation.abbreviation})
            </span>
            <span className="ic-serif text-[15.5px] leading-relaxed">{run.passage.text}</span>
          </div>
        ) : null}

        {run.question ? (
          <div className="max-w-[92%] self-end rounded-[16px] rounded-br-sm bg-[var(--ink)] px-4 py-3 text-[var(--paper)]">
            <span className="mb-1 block text-[10px] font-bold tracking-[0.09em] text-[color-mix(in_srgb,var(--gold)_70%,white)] uppercase">
              {run.glooProviderState === 'not_consented'
                ? 'Composed — not sent'
                : run.glooProviderState === 'unavailable'
                  ? 'Attempted'
                  : 'Sent to Gloo'}
            </span>
            <span className="ic-serif text-[14.5px] leading-relaxed whitespace-pre-wrap">
              {run.question}
            </span>
          </div>
        ) : null}

        {run.glooResponse && run.glooResponse.answer ? (
          <div className="max-w-[92%] self-start rounded-[16px] rounded-bl-sm border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <span className="mb-1 block text-[10px] font-bold tracking-[0.09em] text-[var(--gold)] uppercase">
              Gloo — {glooLabel.label}
            </span>
            <span className="ic-serif text-[15.5px] leading-relaxed">
              {run.glooResponse.answer}
            </span>
            {run.glooResponse.citations.length > 0 ? (
              <span className="mt-2 block text-[11px] text-[var(--muted)]">
                Grounded in: {run.glooResponse.citations.map((c) => c.label).join('; ')}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-4 mb-0 text-[11px] text-[var(--muted)]">
        Inputs allowed for this run: {run.inputSelection.join(', ') || 'none'} · Scripture:{' '}
        {providerBadge(run.scriptureProviderState).label} · Gloo: {glooLabel.label}
      </p>
    </Card>
  );
}
