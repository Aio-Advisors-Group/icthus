import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  DEFAULT_MEMORY_PREFERENCES,
  MEMORY_MIN_ENTRIES,
  MEMORY_WINDOWS_DAYS,
  describeInsight,
  describeInsightEvidence,
  themeLabel,
  type MemoryPreferences,
  type MemoryWindowDays,
} from '@icthus/core';
import { useEntries, useMemoryInsights, useMutateRepository } from '../lib/hooks';
import { SubPageHeader } from '../components/AppShell';
import { Button, Card, Muted, Notice, Spinner, Switch } from '../components/ui';
import { useToast } from '../components/Toast';

export default function MemorySettings(): ReactNode {
  const { insights, preferences, isLoading } = useMemoryInsights();
  const entries = useEntries();
  const { notify } = useToast();

  const save = useMutateRepository((repo, next: MemoryPreferences) =>
    repo.setMemoryPreferences(next),
  );

  // Heading first, so the loading state is still an identifiable page.
  if (isLoading || !preferences) {
    return (
      <>
        <SubPageHeader backTo="/you" backLabel="You" title="Memory" />
        <Spinner label="Loading Memory settings" />
      </>
    );
  }

  function update(patch: Partial<MemoryPreferences>): void {
    if (!preferences) return;
    save.mutate({ ...preferences, ...patch });
  }

  const entryLookup = new Map((entries.data ?? []).map((r) => [r.entry.id, r.entry]));

  return (
    <>
      <SubPageHeader
        backTo="/you"
        backLabel="You"
        title="Memory"
        lede="Memory notices when a theme keeps appearing in the reflections you have saved. It is an observation about your own writing — not a claim to understand you."
      />

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="m-0 text-[14px] font-semibold">
              {preferences.enabled ? 'Memory is on' : 'Memory is off'}
            </p>
            <Muted className="mt-1">
              Off by default. Turning it off deletes everything Memory has derived; your reflections
              themselves are untouched.
            </Muted>
          </div>
          <Switch
            label="Turn Memory on"
            checked={preferences.enabled}
            onChange={(next) => {
              update({ enabled: next });
              notify(next ? 'Memory on' : 'Memory off — derived data erased');
            }}
          />
        </div>
      </Card>

      <div className="mt-5">
        <Notice title="What Memory will never do">
          It never looks at health, sexuality, finances, location, or anything flagged as a crisis.
          It never infers a diagnosis or a trait. It is never used for advertising, church outreach,
          or any outbound delivery without a separate permission from you.
        </Notice>
      </div>

      {preferences.enabled ? (
        <>
          <section aria-labelledby="window-heading" className="mt-8">
            <h2 id="window-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
              How far back to look
            </h2>
            <div className="flex gap-2">
              {MEMORY_WINDOWS_DAYS.map((days: MemoryWindowDays) => (
                <button
                  key={days}
                  type="button"
                  aria-pressed={preferences.windowDays === days}
                  onClick={() => update({ windowDays: days })}
                  className={[
                    'min-h-[44px] flex-1 rounded-full border px-4 text-[13px] font-medium',
                    preferences.windowDays === days
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                      : 'border-[var(--line)] text-[var(--ink)]',
                  ].join(' ')}
                >
                  {days} days
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="insights-heading" className="mt-8">
            <h2 id="insights-heading" className="ic-serif m-0 mb-2 text-[19px] font-normal">
              What Memory has noticed
            </h2>
            <Muted className="mb-4">
              A theme appears here only after it shows up in at least {MEMORY_MIN_ENTRIES} separate
              saved reflections inside the window.
            </Muted>

            {insights.length === 0 ? (
              <Notice>
                Nothing yet. That is normal — Memory stays quiet until it has real evidence.
              </Notice>
            ) : (
              <ul className="m-0 list-none space-y-4 p-0">
                {insights.map((insight) => (
                  <li key={insight.id}>
                    <Card className="p-4">
                      <p className="ic-serif m-0 text-[16px] leading-snug">
                        {describeInsight(insight)}
                      </p>
                      <p className="mt-1 mb-0 text-[11px] text-[var(--muted)]">
                        {describeInsightEvidence(insight)} · confidence: {insight.confidence}
                      </p>

                      <details className="mt-3">
                        <summary className="min-h-[32px] cursor-pointer text-[12.5px] font-bold text-[var(--gold)]">
                          View the {insight.entryCount} entries behind this
                        </summary>
                        <ul className="mt-2 list-none space-y-2 p-0">
                          {insight.entryIds.map((entryId) => {
                            const entry = entryLookup.get(entryId);
                            return (
                              <li key={entryId} className="text-[12.5px]">
                                <Link
                                  to={`/entry/${entryId}`}
                                  className="text-[var(--gold)] underline"
                                >
                                  {entry
                                    ? new Date(entry.createdAt).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                      })
                                    : 'Entry'}
                                </Link>
                                {entry ? (
                                  <span className="ml-2 text-[var(--muted)]">
                                    {entry.body.slice(0, 70)}
                                    {entry.body.length > 70 ? '…' : ''}
                                  </span>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </details>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          className="px-3 text-[12px]"
                          onClick={() => {
                            update({
                              hiddenThemes: [...preferences.hiddenThemes, insight.theme],
                            });
                            notify(`${themeLabel(insight.theme)} hidden`);
                          }}
                        >
                          Hide this theme
                        </Button>
                        <Button
                          variant="quiet"
                          className="px-3 text-[12px]"
                          onClick={() => {
                            update({
                              excludedEntryIds: [
                                ...preferences.excludedEntryIds,
                                ...insight.entryIds,
                              ],
                            });
                            notify('These entries are no longer used by Memory');
                          }}
                        >
                          That is not right — exclude these
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {preferences.hiddenThemes.length > 0 ? (
            <section aria-labelledby="hidden-heading" className="mt-8">
              <h2 id="hidden-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
                Hidden themes
              </h2>
              <ul className="m-0 list-none p-0">
                {preferences.hiddenThemes.map((theme) => (
                  <li
                    key={theme}
                    className="flex min-h-[52px] items-center justify-between border-b border-[var(--line)] py-2 last:border-b-0"
                  >
                    <span className="text-[14px]">{themeLabel(theme)}</span>
                    <Button
                      variant="quiet"
                      className="px-3 text-[12px]"
                      onClick={() =>
                        update({
                          hiddenThemes: preferences.hiddenThemes.filter((t) => t !== theme),
                        })
                      }
                    >
                      Unhide
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      <div className="mt-10">
        <Button
          full
          variant="danger"
          onClick={() => {
            save.mutate(DEFAULT_MEMORY_PREFERENCES);
            notify('Memory data erased');
          }}
        >
          Erase all Memory data
        </Button>
        <Muted className="mt-2">
          Removes every derived theme, insight, and exclusion. Your reflections stay exactly as they
          are.
        </Muted>
      </div>
    </>
  );
}
