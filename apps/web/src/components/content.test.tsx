import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  DeterministicCompanionProvider,
  LocalScriptureProvider,
  type CompanionDevotional,
  type MemoryInsight,
} from '@icthus/core';
import { DevotionalResponseView, MemoryInsightCard, ProviderBadge } from './content';

const scripture = new LocalScriptureProvider();
const companion = new DeterministicCompanionProvider(scripture);

async function devotional(): Promise<CompanionDevotional> {
  const result = await companion.respond({
    entryId: 'entry-1',
    body: 'I am anxious and worried about tomorrow.',
    purpose: 'pray',
  });
  if (result.kind !== 'companion') throw new Error('Expected a devotional response');
  return result;
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('DevotionalResponseView', () => {
  it('makes Scripture visually primary and attributes the translation', async () => {
    const response = await devotional();
    renderWithRouter(<DevotionalResponseView response={response} />);

    expect(screen.getByText(response.primaryPassage.text)).toBeInTheDocument();
    expect(
      screen.getAllByText(new RegExp(response.primaryPassage.reference)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/World English Bible/)).toBeInTheDocument();
  });

  it('renders every citation with its resolvable source id', async () => {
    const response = await devotional();
    renderWithRouter(<DevotionalResponseView response={response} />);

    expect(screen.getByText(`Sources used (${response.citations.length})`)).toBeInTheDocument();
    for (const citation of response.citations) {
      expect(screen.getByText(new RegExp(citation.sourceId))).toBeInTheDocument();
    }
  });

  it('frames the rationale as an invitation rather than an instruction', async () => {
    const response = await devotional();
    renderWithRouter(<DevotionalResponseView response={response} />);

    const rationale = screen.getByText(new RegExp(response.whyThisPassage.slice(0, 40)));
    expect(rationale.textContent ?? '').toMatch(/\bmay\b|\bmight\b/);
    expect(rationale.textContent ?? '').not.toMatch(/God is telling you|you must/i);
  });

  it('labels the next step as optional', async () => {
    const response = await devotional();
    renderWithRouter(<DevotionalResponseView response={response} />);
    expect(screen.getByText(/An invitation, not an instruction/)).toBeInTheDocument();
  });
});

describe('MemoryInsightCard', () => {
  const insight: MemoryInsight = {
    id: 'insight:patience:30',
    theme: 'patience',
    entryCount: 4,
    periodStart: '2026-07-01',
    periodEnd: '2026-07-30',
    entryIds: ['a', 'b', 'c', 'd'],
    confidence: 'moderate',
    extractorVersion: 'themes@1.0.0',
  };

  it('states an observation with its evidence, not an interpretation', () => {
    renderWithRouter(<MemoryInsightCard insight={insight} />);
    expect(screen.getByText('Patience has appeared in 4 saved reflections.')).toBeInTheDocument();
    expect(
      screen.getByText(/From your saved reflections · 2026-07-01 to 2026-07-30/),
    ).toBeInTheDocument();
  });

  it('never claims to know the person', () => {
    const { container } = renderWithRouter(<MemoryInsightCard insight={insight} />);
    expect(container.textContent ?? '').not.toMatch(/I know you|you are a|God is showing/i);
  });
});

describe('ProviderBadge', () => {
  it('does not render a mocked provider as connected', () => {
    const { container } = render(<ProviderBadge state="mock" />);
    expect(container.textContent).toBe('Local sample content');
    expect(container.textContent).not.toBe('Connected');
  });

  it('renders an unavailable provider honestly', () => {
    const { container } = render(<ProviderBadge state="unavailable" />);
    expect(container.textContent).toBe('Unavailable');
  });
});
