import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  PROVIDER_STATE_LABELS,
  describeInsight,
  describeInsightEvidence,
  themeLabel,
  toReferenceSlug,
  type CompanionDevotional,
  type CompanionSupport,
  type MemoryInsight,
  type ProviderState,
  type ScripturePassage,
  type SupportingSource,
} from '@icthus/core';
import { Badge, Button, Card, Muted, Notice } from './ui';

/**
 * Content surfaces.
 *
 * The rule these encode: Scripture is visually dominant, every source is
 * attributed, and the provider state is always visible rather than implied.
 */

export function ProviderBadge({ state }: { state: ProviderState }): ReactNode {
  const tone = state === 'live' ? 'ok' : state === 'mock' ? 'neutral' : 'warn';
  return <Badge tone={tone}>{PROVIDER_STATE_LABELS[state]}</Badge>;
}

export function ScriptureCard({
  passage,
  invitation,
  action,
}: {
  passage: ScripturePassage;
  invitation?: { title: string; body: string };
  action?: ReactNode;
}): ReactNode {
  return (
    <article className="ic-watermark relative overflow-hidden rounded-[22px] bg-[var(--sand)] px-[22px] pt-7 pb-5">
      <p className="m-0 text-[11px] font-extrabold tracking-[0.1em] text-[var(--gold)] uppercase">
        {passage.reference}
      </p>
      <blockquote className="ic-serif relative z-10 my-6 text-[24px] leading-[1.3] tracking-[-0.02em]">
        {passage.text}
      </blockquote>
      <div className="relative z-10 flex items-center justify-between gap-3">
        <p className="m-0 text-[11.5px] leading-snug text-[var(--muted)]">
          {passage.translation.abbreviation} · {passage.attribution}
        </p>
        {action}
      </div>
      {invitation ? (
        <div className="relative z-10 mt-4 border-t border-[color-mix(in_srgb,var(--gold)_20%,transparent)] pt-4">
          <p className="m-0 text-[11px] font-extrabold tracking-[0.11em] text-[var(--gold)] uppercase">
            {invitation.title}
          </p>
          <p className="ic-serif mt-2 mb-0 text-[16px] leading-relaxed">{invitation.body}</p>
          <Link
            to={`/study/${toReferenceSlug(passage.canonical)}`}
            className="mt-3 inline-flex min-h-[44px] items-center text-[13px] font-bold text-[var(--gold)] no-underline"
          >
            Read the passage and reflect →
          </Link>
        </div>
      ) : null}
    </article>
  );
}

export function SourceCard({ source }: { source: SupportingSource }): ReactNode {
  return (
    <Card className="mb-3 p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[14px] font-semibold">{source.title}</p>
          <p className="m-0 text-[12px] text-[var(--muted)]">
            {source.author} · {source.locator}
          </p>
        </div>
        {source.tradition ? <Badge tone="info">{source.tradition}</Badge> : null}
      </div>
      <p className="ic-serif m-0 text-[15px] leading-relaxed">“{source.excerpt}”</p>
      <p className="mt-3 mb-0 text-[11px] text-[var(--muted)]">
        {source.edition} · {source.rights}
        {source.canonicalUrl ? (
          <>
            {' · '}
            <a
              href={source.canonicalUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[var(--gold)] underline"
            >
              Source
            </a>
          </>
        ) : null}
      </p>
    </Card>
  );
}

export function MemoryInsightCard({
  insight,
  onViewEntries,
  onHide,
}: {
  insight: MemoryInsight;
  onViewEntries?: () => void;
  onHide?: () => void;
}): ReactNode {
  return (
    <Card tone="rose" className="my-5 p-4">
      <div className="flex gap-3">
        <span aria-hidden="true" className="text-[18px] text-[var(--clay)]">
          ✦
        </span>
        <div className="min-w-0 flex-1">
          <p className="ic-serif m-0 text-[15px] leading-snug">{describeInsight(insight)}</p>
          <p className="mt-1 mb-0 text-[11px] text-[var(--muted)]">
            {describeInsightEvidence(insight)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onViewEntries ? (
              <Button variant="secondary" onClick={onViewEntries} className="px-3 text-[12px]">
                View {insight.entryCount} entries
              </Button>
            ) : null}
            {onHide ? (
              <Button variant="quiet" onClick={onHide} className="px-3 text-[12px]">
                Hide this theme
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function SupportResponseView({ response }: { response: CompanionSupport }): ReactNode {
  return (
    <section aria-labelledby="support-heading">
      <h1 id="support-heading" className="ic-serif m-0 text-[27px] leading-tight font-normal">
        {response.acknowledgement}
      </h1>
      <p className="ic-serif mt-4 text-[17px] leading-relaxed">{response.message}</p>

      <ul className="mt-6 list-none space-y-3 p-0">
        {response.resources.map((resource) => (
          <li key={resource.label}>
            <Card className="p-4">
              <p className="m-0 text-[14px] font-semibold">{resource.label}</p>
              <p className="mt-1 mb-0 text-[13px] leading-relaxed text-[var(--muted)]">
                {resource.detail}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <Notice tone="warn">{response.disclaimer}</Notice>
      </div>
    </section>
  );
}

export function DevotionalResponseView({
  response,
  saveAction,
  shareAction,
}: {
  response: CompanionDevotional;
  saveAction?: ReactNode;
  shareAction?: ReactNode;
}): ReactNode {
  return (
    <section aria-labelledby="response-heading">
      <p className="m-0 text-[11px] font-extrabold tracking-[0.12em] text-[var(--gold)] uppercase">
        A place to begin
      </p>
      <h1 id="response-heading" className="ic-serif mt-2 text-[26px] leading-tight font-normal">
        {response.theme}
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
        {response.acknowledgement}
      </p>

      <div className="mt-5">
        <ScriptureCard passage={response.primaryPassage} />
      </div>

      <details className="mt-4 rounded-[14px] bg-[var(--sand)] px-4 py-3">
        <summary className="min-h-[28px] cursor-pointer text-[13px] font-bold text-[var(--gold)]">
          Why this passage?
        </summary>
        <p className="mt-2 mb-0 text-[13.5px] leading-relaxed text-[var(--muted)]">
          {response.whyThisPassage}
        </p>
      </details>

      <h2 className="ic-serif mt-7 mb-3 text-[19px] font-normal">A reflection</h2>
      <p className="ic-serif m-0 text-[16.5px] leading-[1.6]">{response.reflection}</p>

      {response.supportingSources.length > 0 ? (
        <>
          <h2 className="ic-serif mt-7 mb-3 text-[19px] font-normal">Alongside this</h2>
          {response.supportingSources.map((source) => (
            <SourceCard key={source.sourceId} source={source} />
          ))}
        </>
      ) : null}

      <h2 className="ic-serif mt-7 mb-3 text-[19px] font-normal">A prayer to begin with</h2>
      <Card tone="sand" className="p-4">
        <p className="ic-serif m-0 text-[16px] leading-relaxed">{response.prayerPrompt}</p>
      </Card>

      {response.nextStep ? (
        <>
          <h2 className="ic-serif mt-7 mb-3 text-[19px] font-normal">One next step</h2>
          <Card className="p-4">
            <p className="m-0 text-[15px] leading-relaxed">{response.nextStep}</p>
            <Muted className="mt-2">
              An invitation, not an instruction. Leave it if it is not right.
            </Muted>
          </Card>
        </>
      ) : null}

      {response.memoryInsight ? <MemoryInsightCard insight={response.memoryInsight} /> : null}

      {saveAction || shareAction ? (
        <div className="mt-7 flex gap-3">
          {saveAction}
          {shareAction}
        </div>
      ) : null}

      <div className="mt-7">
        <CitationLedger response={response} />
      </div>
    </section>
  );
}

/** Every displayed claim, traced to the record it came from. */
export function CitationLedger({ response }: { response: CompanionDevotional }): ReactNode {
  return (
    <details className="rounded-[14px] border border-[var(--line)] px-4 py-3">
      <summary className="min-h-[28px] cursor-pointer text-[12px] font-bold text-[var(--muted)]">
        Sources used ({response.citations.length})
      </summary>
      <ul className="mt-3 list-none space-y-2 p-0">
        {response.citations.map((citation) => (
          <li key={`${citation.sourceId}-${citation.supports}`} className="text-[12px]">
            <span className="font-semibold">{citation.displayReference}</span>
            <span className="text-[var(--muted)]"> · {citation.sourceId}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 mb-0 text-[11px] leading-relaxed text-[var(--muted)]">
        Generated by {response.meta.adapter} ({response.meta.promptVersion}). Scripture provider:{' '}
        {PROVIDER_STATE_LABELS[response.meta.scriptureProviderState]}.
      </p>
    </details>
  );
}

export function ThemeChips({ themes }: { themes: readonly string[] }): ReactNode {
  if (themes.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {themes.map((theme) => (
        <li key={theme}>
          <Badge tone="neutral">{themeLabel(theme)}</Badge>
        </li>
      ))}
    </ul>
  );
}
