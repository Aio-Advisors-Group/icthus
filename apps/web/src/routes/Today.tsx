import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PROVIDER_STATE_LABELS } from '@icthus/core';
import { useApp } from '../lib/AppProvider';
import { useMemoryInsights, useMutateRepository } from '../lib/hooks';
import { MemoryInsightCard, ScriptureCard } from '../components/content';
import { Button, Card, LinkButton, Muted, SectionHeading, Spinner } from '../components/ui';
import { useToast } from '../components/Toast';
import { newId } from '../lib/id';

const QUICK_STARTS = [
  'I feel anxious',
  'I need hope',
  'I have a question',
  'I am grateful',
] as const;

export default function Today(): ReactNode {
  const { scripture } = useApp();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { insights, preferences } = useMemoryInsights();

  const today = useMemo(() => new Date(), []);
  const passageQuery = useQuery({
    queryKey: ['passageOfTheDay', today.toDateString()],
    queryFn: () => scripture.passageOfTheDay(today),
  });

  const savePassage = useMutateRepository(async (repository, _: void) => {
    const passage = passageQuery.data;
    if (!passage) return;
    await repository.addSavedItem({
      id: newId(),
      kind: 'scripture',
      title: passage.reference,
      body: passage.text,
      reference: passage.reference,
      attribution: `${passage.translation.abbreviation} · ${passage.attribution}`,
      sourceId: passage.sourceId,
      entryId: null,
      createdAt: new Date().toISOString(),
    });
  });

  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const topInsight = insights[0];

  return (
    <>
      <p className="mt-7 mb-2 text-[11px] font-extrabold tracking-[0.12em] text-[var(--gold)] uppercase">
        {dateLabel}
      </p>
      <h1 className="ic-serif m-0 text-[37px] leading-[1.08] font-normal tracking-[-0.03em]">
        Bring what is real.
      </h1>
      <p className="mt-4 mb-6 text-[15px] leading-relaxed text-[var(--muted)]">
        You do not need the right words or a Bible verse to begin.
      </p>

      <Card className="p-[18px] shadow-[var(--shadow-paper)]">
        <p className="ic-serif m-0 mb-4 text-[20px] leading-snug font-medium">
          What is happening in your life today?
        </p>
        <button
          type="button"
          onClick={() => navigate('/capture')}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-[15px] bg-[var(--sand)] px-3 py-2 text-left"
        >
          <span className="flex-1 text-[14px] text-[var(--muted)]">
            Write, speak, or share a note…
          </span>
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-[18px] shadow-sm"
          >
            +
          </span>
        </button>

        <ul className="ic-scrollbar-none m-0 mt-4 flex list-none gap-2 overflow-x-auto p-0">
          {QUICK_STARTS.map((chip) => (
            <li key={chip}>
              <button
                type="button"
                onClick={() => navigate(`/capture?prompt=${encodeURIComponent(chip)}`)}
                className="min-h-[40px] rounded-full border border-[var(--line)] px-3 text-[12px] whitespace-nowrap text-[var(--ink)]"
              >
                {chip}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {/* Memory stays invisible until it is turned on and has real evidence. */}
      {preferences?.enabled && topInsight ? (
        <MemoryInsightCard
          insight={topInsight}
          onViewEntries={() => navigate('/you/memory')}
          onHide={() => navigate('/you/memory')}
        />
      ) : null}

      <SectionHeading
        action={
          <LinkButton to="/explore" variant="quiet">
            Explore
          </LinkButton>
        }
      >
        A place to begin
      </SectionHeading>

      {passageQuery.isLoading ? <Spinner label="Finding a passage" /> : null}

      {passageQuery.data ? (
        <>
          <ScriptureCard
            passage={passageQuery.data}
            invitation={{
              title: 'A gentle invitation',
              body: 'You do not have to carry everything alone today. Start by bringing the truest part of it to Jesus.',
            }}
            action={
              <Button
                variant="secondary"
                className="min-h-[40px] px-3 text-[12px]"
                onClick={() => {
                  savePassage.mutate();
                  notify('Saved privately');
                }}
              >
                Save
              </Button>
            }
          />
          <Muted className="mt-3">
            Scripture source: {PROVIDER_STATE_LABELS[passageQuery.data.providerState]} ·{' '}
            {passageQuery.data.translation.name}. Translation is set in You.
          </Muted>
        </>
      ) : null}

      {passageQuery.isError ? (
        <Card className="p-4">
          <p className="m-0 text-[14px]">
            A passage could not be loaded right now. Anything you write is still saved.
          </p>
        </Card>
      ) : null}
    </>
  );
}
