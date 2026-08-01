import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PROVIDER_STATE_LABELS } from '@icthus/core';
import { useApp } from '../lib/AppProvider';
import { useMutateRepository } from '../lib/hooks';
import { ScriptureCard } from '../components/content';
import { Button, Card, EmptyState, LinkButton, Muted, Spinner } from '../components/ui';
import { SubPageHeader } from '../components/AppShell';
import { useToast } from '../components/Toast';
import { newId } from '../lib/id';

export default function StudyDetail(): ReactNode {
  const { reference } = useParams<{ reference: string }>();
  const { scripture } = useApp();
  const { notify } = useToast();

  const passageQuery = useQuery({
    queryKey: ['passage', reference],
    queryFn: () => (reference ? scripture.getByReferenceSlug(reference) : Promise.resolve(null)),
    enabled: Boolean(reference),
  });

  const save = useMutateRepository(async (repository, _: void) => {
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

  if (passageQuery.isLoading) return <Spinner label="Opening the passage" />;

  const passage = passageQuery.data;
  if (!passage) {
    return (
      <>
        <SubPageHeader backTo="/explore" backLabel="Explore" title="Passage" />
        <EmptyState
          title="That passage is not in the current corpus"
          body="Icthus ships a small public-domain corpus. Connecting a licensed Scripture provider makes the whole Bible available here."
          action={<LinkButton to="/explore">Back to Explore</LinkButton>}
        />
      </>
    );
  }

  return (
    <>
      <SubPageHeader backTo="/explore" backLabel="Explore" title={passage.reference} />

      <ScriptureCard passage={passage} />

      {passage.context ? (
        <section aria-labelledby="context-heading" className="mt-7">
          <h2 id="context-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
            Where this sits
          </h2>
          <p className="ic-serif m-0 text-[16px] leading-[1.6]">{passage.context}</p>
        </section>
      ) : null}

      <section aria-labelledby="carry-heading" className="mt-7">
        <h2 id="carry-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
          A question to carry
        </h2>
        <Card tone="sand" className="p-4">
          <p className="ic-serif m-0 text-[16px] leading-relaxed">
            What would it look like to bring one honest thing from today to Jesus, in the light of
            this passage?
          </p>
        </Card>
      </section>

      <div className="mt-7 flex gap-3">
        <Button
          className="flex-1"
          onClick={() => {
            save.mutate();
            notify('Saved privately');
          }}
        >
          Save passage
        </Button>
        <LinkButton to="/capture" variant="secondary" full={false}>
          Bring this into a reflection
        </LinkButton>
      </div>

      <Muted className="mt-6">
        {passage.translation.name} ({passage.translation.abbreviation}) ·{' '}
        {passage.translation.rights} · Source state: {PROVIDER_STATE_LABELS[passage.providerState]}.
        {passage.canonicalUrl ? (
          <>
            {' '}
            <a
              href={passage.canonicalUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[var(--gold)] underline"
            >
              Read the chapter
            </a>
          </>
        ) : null}
      </Muted>
    </>
  );
}
