import type { ReactNode } from 'react';
import { describeIntegrations } from '@icthus/core';
import { useApp, useFlags } from '../lib/AppProvider';
import { SubPageHeader } from '../components/AppShell';
import { Badge, Card, Muted, Notice } from '../components/ui';

/**
 * Integration health.
 *
 * One screen that answers "is this real?" for every external dependency, with
 * the specific thing a human has to go do next.
 */
export default function Integrations(): ReactNode {
  const flags = useFlags();
  const { repository } = useApp();
  const integrations = describeIntegrations(flags);

  return (
    <>
      <SubPageHeader
        backTo="/you"
        backLabel="You"
        title="Connections"
        lede="What is genuinely connected, what is running locally, and exactly what each one is waiting on."
      />

      <div className="mb-6">
        <Notice>
          Icthus will not show something as connected when it is not. Where a provider is not
          configured, the feature still works from local content and says so.
        </Notice>
      </div>

      <ul className="m-0 list-none space-y-3 p-0">
        {integrations.map((integration) => (
          <li key={integration.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-[14.5px] font-semibold">{integration.label}</p>
                  <p className="mt-1 mb-0 text-[12.5px] leading-relaxed text-[var(--muted)]">
                    {integration.detail}
                  </p>
                </div>
                <Badge
                  tone={
                    integration.state === 'live'
                      ? 'ok'
                      : integration.state === 'mock'
                        ? 'neutral'
                        : 'warn'
                  }
                >
                  {integration.state === 'live'
                    ? 'Connected'
                    : integration.state === 'mock'
                      ? 'Local'
                      : integration.state === 'disabled'
                        ? 'Off'
                        : 'Not configured'}
                </Badge>
              </div>

              {integration.blockedBy ? (
                <p className="mt-3 mb-0 text-[12px] leading-relaxed text-[var(--muted)]">
                  <span className="font-bold text-[var(--ink)]">Needs: </span>
                  {integration.blockedBy}
                </p>
              ) : null}

              {integration.docsUrl ? (
                <p className="mt-2 mb-0 text-[12px]">
                  <a
                    href={integration.docsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[var(--gold)] underline"
                  >
                    Provider documentation
                  </a>
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      <Muted className="mt-6">
        Storage mode:{' '}
        {repository.mode === 'supabase' ? 'Supabase (your account)' : 'this device only'}. Provider
        keys are never held in this app — they belong in Supabase Edge Function secrets.
      </Muted>
    </>
  );
}
