import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { SavedItemKind } from '../lib/types';
import { useEntries, useMutateRepository, useSavedItems } from '../lib/hooks';
import { Button, Card, EmptyState, LinkButton, Muted, Spinner } from '../components/ui';
import { useToast } from '../components/Toast';

const FILTERS: { id: SavedItemKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'scripture', label: 'Scripture' },
  { id: 'prayer', label: 'Prayers' },
  { id: 'reflection', label: 'Reflections' },
];

export default function Saved(): ReactNode {
  const saved = useSavedItems();
  const entries = useEntries();
  const { notify } = useToast();
  const [filter, setFilter] = useState<SavedItemKind | 'all'>('all');

  const remove = useMutateRepository((repository, id: string) => repository.removeSavedItem(id));

  const items = (saved.data ?? []).filter((item) => filter === 'all' || item.kind === filter);
  const journal = entries.data ?? [];

  return (
    <>
      <h1 className="ic-serif mt-7 mb-3 text-[30px] leading-tight font-normal">Saved</h1>
      <Muted className="mb-5">
        Everything here is private to you. Nothing is shared unless you set up a destination
        yourself.
      </Muted>

      <div role="tablist" aria-label="Filter saved items" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            role="tab"
            aria-selected={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={[
              'min-h-[44px] rounded-full border px-4 text-[13px] font-medium',
              filter === option.id
                ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                : 'border-[var(--line)] text-[var(--ink)]',
            ].join(' ')}
          >
            {option.label}
          </button>
        ))}
      </div>

      {saved.isLoading ? <Spinner /> : null}

      {!saved.isLoading && items.length === 0 ? (
        <EmptyState
          glyph="♡"
          title="Nothing saved yet"
          body="When a passage or prayer is worth returning to, save it and it will wait here for you."
          action={<LinkButton to="/">Go to Today</LinkButton>}
        />
      ) : (
        <ul className="m-0 mt-6 list-none space-y-3 p-0">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="p-4">
                {item.reference ? (
                  <p className="m-0 text-[11px] font-extrabold tracking-[0.1em] text-[var(--gold)] uppercase">
                    {item.reference}
                  </p>
                ) : (
                  <p className="m-0 text-[11px] font-extrabold tracking-[0.1em] text-[var(--gold)] uppercase">
                    {item.kind}
                  </p>
                )}
                <p className="ic-serif mt-2 mb-0 text-[16px] leading-relaxed">{item.body}</p>
                {item.attribution ? (
                  <p className="mt-2 mb-0 text-[11px] text-[var(--muted)]">{item.attribution}</p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  {item.entryId ? (
                    <LinkButton to={`/entry/${item.entryId}`} variant="quiet">
                      Open reflection
                    </LinkButton>
                  ) : null}
                  <Button
                    variant="quiet"
                    className="px-3 text-[12px]"
                    onClick={() => {
                      remove.mutate(item.id);
                      notify('Removed from Saved');
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <h2 className="ic-serif mt-10 mb-3 text-[21px] font-normal">Your reflections</h2>
      {journal.length === 0 ? (
        <EmptyState
          glyph="✎"
          title="No reflections yet"
          body="Anything you bring to Icthus is kept here, in the order it happened."
          action={<LinkButton to="/capture">Bring something</LinkButton>}
        />
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {journal.map(({ entry, response }) => (
            <li key={entry.id}>
              <Link to={`/entry/${entry.id}`} className="block no-underline">
                <Card className="p-4">
                  <p className="m-0 text-[11px] text-[var(--muted)]">
                    {new Date(entry.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {response && response.kind === 'companion'
                      ? ` · ${response.primaryPassage.reference}`
                      : ''}
                  </p>
                  <p className="ic-serif mt-2 mb-0 line-clamp-2 text-[15.5px] leading-relaxed text-[var(--ink)]">
                    {entry.body}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
