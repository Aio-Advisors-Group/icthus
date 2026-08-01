import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buildShareCard } from '@icthus/core';
import { useEntry, useMutateRepository } from '../lib/hooks';
import { DevotionalResponseView, SupportResponseView } from '../components/content';
import {
  Button,
  Card,
  EmptyState,
  LinkButton,
  Muted,
  Notice,
  Spinner,
  Switch,
} from '../components/ui';
import { SubPageHeader } from '../components/AppShell';
import { useToast } from '../components/Toast';
import { newId } from '../lib/id';

export default function EntryDetail(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();
  const entryQuery = useEntry(id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const savePrayer = useMutateRepository(
    async (repository, args: { title: string; body: string; entryId: string }) => {
      await repository.addSavedItem({
        id: newId(),
        kind: 'prayer',
        title: args.title,
        body: args.body,
        reference: null,
        attribution: null,
        sourceId: null,
        entryId: args.entryId,
        createdAt: new Date().toISOString(),
      });
    },
  );

  const setExcluded = useMutateRepository(
    async (repository, args: { id: string; excluded: boolean }) => {
      await repository.updateEntry(args.id, { excludedFromMemory: args.excluded });
    },
  );

  const deleteEntry = useMutateRepository((repository, entryId: string) =>
    repository.deleteEntry(entryId),
  );

  if (entryQuery.isLoading) return <Spinner label="Opening your reflection" />;

  const record = entryQuery.data;
  if (!record) {
    return (
      <EmptyState
        title="That reflection is not here"
        body="It may have been deleted, or the link may belong to a different device."
        action={<LinkButton to="/saved">Go to Saved</LinkButton>}
      />
    );
  }

  const { entry, response } = record;

  async function handleShare(): Promise<void> {
    if (!response || response.kind !== 'companion') return;
    const card = buildShareCard({
      routeId: 'manual',
      outputType: 'daily_scripture',
      title: response.primaryPassage.reference,
      body: response.primaryPassage.text,
      reference: response.primaryPassage.reference,
      attribution: `${response.primaryPassage.translation.abbreviation} · ${response.primaryPassage.attribution}`,
      idempotencyKey: response.id,
      targetRef: null,
    });
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Icthus', text: card });
        return;
      } catch {
        // The person dismissed the sheet; fall through to the clipboard.
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(card);
      notify('Copied — ready for you to paste');
      return;
    }
    notify('Sharing is unavailable in this browser');
  }

  return (
    <>
      <SubPageHeader backTo="/saved" backLabel="Saved" title="Your reflection" />

      <Card tone="sand" className="mb-6 p-4">
        <p className="m-0 text-[11px] text-[var(--muted)]">
          {new Date(entry.createdAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          {entry.sourceKind === 'imported_note' ? ' · imported note' : ''}
          {entry.sourceKind === 'voice' ? ' · spoken' : ''}
        </p>
        <p className="ic-serif mt-2 mb-0 text-[16px] leading-relaxed whitespace-pre-wrap">
          {entry.body}
        </p>
      </Card>

      {response?.kind === 'support' ? <SupportResponseView response={response} /> : null}

      {response?.kind === 'companion' ? (
        <DevotionalResponseView
          response={response}
          saveAction={
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                savePrayer.mutate({
                  title: response.primaryPassage.reference,
                  body: response.prayerPrompt,
                  entryId: entry.id,
                });
                notify('Prayer saved');
              }}
            >
              Save prayer
            </Button>
          }
          shareAction={
            <Button variant="secondary" className="flex-1" onClick={handleShare}>
              Share
            </Button>
          }
        />
      ) : null}

      {!response ? (
        <Notice tone="warn" title="No response was generated">
          Your words are saved. You can try again from Capture when you are ready.
        </Notice>
      ) : null}

      <section aria-labelledby="entry-controls" className="mt-10">
        <h2 id="entry-controls" className="ic-serif m-0 mb-3 text-[19px] font-normal">
          This entry
        </h2>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="m-0 text-[14px] font-semibold">Keep out of Memory</p>
              <Muted className="mt-1">
                Memory will ignore this entry when looking for recurring themes.
              </Muted>
            </div>
            <Switch
              label="Keep this entry out of Memory"
              checked={entry.excludedFromMemory}
              onChange={(next) => {
                setExcluded.mutate({ id: entry.id, excluded: next });
                notify(next ? 'Excluded from Memory' : 'Included in Memory');
              }}
            />
          </div>
        </Card>

        <div className="mt-4">
          {confirmingDelete ? (
            <Card className="p-4">
              <p className="m-0 text-[14px] font-semibold">Delete this reflection?</p>
              <Muted className="mt-1">
                This removes your words, the response, and anything saved from it. It cannot be
                undone.
              </Muted>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="danger"
                  onClick={async () => {
                    await deleteEntry.mutateAsync(entry.id);
                    notify('Reflection deleted');
                    navigate('/saved');
                  }}
                >
                  Delete permanently
                </Button>
                <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </Button>
              </div>
            </Card>
          ) : (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Delete this reflection
            </Button>
          )}
        </div>
      </section>
    </>
  );
}
