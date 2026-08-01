import { useState, type ReactNode } from 'react';
import { SUPPORT_RESOURCES } from '@icthus/core';
import { useApp } from '../lib/AppProvider';
import { useEntries, useMutateRepository } from '../lib/hooks';
import { SubPageHeader } from '../components/AppShell';
import { Button, Card, Muted, Notice } from '../components/ui';
import { useToast } from '../components/Toast';

export default function Privacy(): ReactNode {
  const { repository, session } = useApp();
  const entries = useEntries();
  const { notify } = useToast();
  const [confirmingPurge, setConfirmingPurge] = useState(false);
  const [exporting, setExporting] = useState(false);

  const purge = useMutateRepository((repo, _: void) => repo.purgeAll());

  async function handleExport(): Promise<void> {
    setExporting(true);
    try {
      const bundle = await repository.exportAll();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `icthus-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify('Export downloaded');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <SubPageHeader
        backTo="/you"
        backLabel="You"
        title="Privacy and your data"
        lede="A spiritual journal is sensitive personal information. Icthus treats it that way."
      />

      <section aria-labelledby="promises-heading">
        <h2 id="promises-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
          What Icthus does and does not do
        </h2>
        <ul className="m-0 list-none space-y-2 p-0 text-[13.5px] leading-relaxed">
          {[
            'Your reflections are private by default and are never published, shared, or sold.',
            'Nothing is sent to any external service unless you set up that route yourself.',
            'There is no advertising SDK and no session replay anywhere in this app.',
            'Your writing is never used to train a model without a separate, revocable opt-in.',
            'Delivery history records status codes only, never the content of what was sent.',
            'Memory is off until you turn it on, and turning it off erases what it derived.',
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden="true" className="text-[var(--gold)]">
                ·
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="export-heading" className="mt-8">
        <h2 id="export-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
          Take your data with you
        </h2>
        <Card className="p-4">
          <p className="m-0 text-[13.5px] leading-relaxed">
            Downloads everything Icthus holds for you — reflections, responses, saved items, routes,
            consents, and companion runs — as one JSON file.
          </p>
          <Muted className="mt-2">
            {entries.data?.length ?? 0} reflections ·{' '}
            {repository.mode === 'supabase' ? 'from your account' : 'from this device'}
          </Muted>
          <div className="mt-4">
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? 'Preparing…' : 'Download my data'}
            </Button>
          </div>
        </Card>
      </section>

      <section aria-labelledby="delete-heading" className="mt-8">
        <h2 id="delete-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
          Delete
        </h2>
        <Muted className="mb-3">
          Individual reflections can be deleted from the reflection itself. This removes everything
          at once.
        </Muted>

        {confirmingPurge ? (
          <Card className="p-4">
            <p className="m-0 text-[14px] font-semibold">Delete everything?</p>
            <Muted className="mt-1">
              This erases every reflection, response, saved item, route, and companion run. It
              cannot be undone.
              {session
                ? ' Your sign-in account itself is removed by a separate server-side step — see SUPABASE_SETUP.md.'
                : ''}
            </Muted>
            <div className="mt-4 flex gap-2">
              <Button
                variant="danger"
                onClick={async () => {
                  await purge.mutateAsync();
                  setConfirmingPurge(false);
                  notify('Everything deleted');
                }}
              >
                Delete everything
              </Button>
              <Button variant="secondary" onClick={() => setConfirmingPurge(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="danger" onClick={() => setConfirmingPurge(true)}>
            Delete all my data
          </Button>
        )}
      </section>

      <section aria-labelledby="limits-heading" className="mt-10">
        <h2 id="limits-heading" className="ic-serif m-0 mb-3 text-[19px] font-normal">
          What Icthus is not
        </h2>
        <Notice tone="warn">
          Icthus is not emergency support, medical or psychological care, confession or absolution,
          spiritual direction, or a replacement for a local church. It cannot contact anyone on your
          behalf.
        </Notice>
        <ul className="m-0 mt-4 list-none space-y-3 p-0">
          {SUPPORT_RESOURCES.map((resource) => (
            <li key={resource.label}>
              <Card className="p-4">
                <p className="m-0 text-[13.5px] font-semibold">{resource.label}</p>
                <p className="mt-1 mb-0 text-[12.5px] leading-relaxed text-[var(--muted)]">
                  {resource.detail}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
