import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMPANION_SETTINGS,
  buildInputSummary,
  composeQuestion,
  executeCompanionRun,
  type CompanionInputEntry,
  type DailyCompanionSettings,
} from './dailyCompanion';
import {
  MockGlooProvider,
  type FaithConnectionProvider,
  type GlooResponse,
} from './providers/gloo';
import { LocalScriptureProvider } from './providers/scripture';

const NOW = new Date('2026-07-31T14:30:00Z');

const ENTRIES: CompanionInputEntry[] = [
  {
    id: 'capture-1',
    kind: 'capture',
    occurredAt: NOW.toISOString(),
    body: 'Feeling stretched thin between closing a deal and being present at home.',
  },
  {
    id: 'journal-1',
    kind: 'journal',
    occurredAt: NOW.toISOString(),
    body: 'A long private devotional note that should never be transmitted verbatim anywhere.',
  },
  {
    id: 'recent-1',
    kind: 'recent',
    occurredAt: NOW.toISOString(),
    body: 'Another private entry from earlier with sensitive detail inside it.',
  },
];

function settings(overrides: Partial<DailyCompanionSettings> = {}): DailyCompanionSettings {
  return {
    ...DEFAULT_COMPANION_SETTINGS,
    enabled: true,
    glooConsentAt: '2026-07-31T00:00:00.000Z',
    inputs: { capture: true, journal: false, recent: false },
    ...overrides,
  };
}

const deps = { scripture: new LocalScriptureProvider(), gloo: new MockGlooProvider() };

describe('input summary minimisation', () => {
  it('sends only a bounded excerpt of today’s capture', () => {
    const { summary, usedEntryIds } = buildInputSummary(ENTRIES, ['capture']);
    expect(summary).toContain('Today’s capture');
    expect(summary).toContain('stretched thin');
    expect(usedEntryIds).toEqual(['capture-1']);
  });

  it('reduces journal and recent entries to counts, never content', () => {
    const { summary } = buildInputSummary(ENTRIES, ['capture', 'journal', 'recent']);
    expect(summary).toContain('1 imported note (content not sent)');
    expect(summary).toContain('1 other entry (content not sent)');
    expect(summary).not.toContain('never be transmitted');
    expect(summary).not.toContain('sensitive detail');
  });

  it('excludes entries whose input kind was not selected', () => {
    const { summary, usedEntryIds } = buildInputSummary(ENTRIES, ['journal']);
    expect(summary).not.toContain('stretched thin');
    expect(usedEntryIds).toEqual(['journal-1']);
  });

  it('caps the capture excerpt length', () => {
    const long = 'word '.repeat(200);
    const { summary } = buildInputSummary(
      [{ id: 'c', kind: 'capture', occurredAt: NOW.toISOString(), body: long }],
      ['capture'],
    );
    expect(summary.length).toBeLessThan(260);
    expect(summary).toContain('…');
  });
});

describe('bounded question', () => {
  it('anchors the question to the retrieved passage and forbids authority claims', async () => {
    const [passage] = await deps.scripture.search(['work'], 1);
    expect(passage).toBeDefined();
    if (!passage) return;
    const question = composeQuestion(passage, ['work'], 'Today’s capture: “a hard day”');
    expect(question).toContain(passage.reference);
    expect(question).toContain(passage.translation.abbreviation);
    expect(question).toMatch(/Do not claim certainty about God’s will/);
    expect(question).toMatch(/do not offer clinical or crisis advice/i);
  });
});

describe('companion run', () => {
  it('completes a run and reports the mock provider state honestly', async () => {
    const run = await executeCompanionRun(deps, {
      settings: settings(),
      entries: ENTRIES,
      trigger: 'manual',
      now: NOW,
    });
    expect(run.status).toBe('succeeded');
    expect(run.passage).not.toBeNull();
    expect(run.glooResponse?.answer.length).toBeGreaterThan(0);
    expect(run.glooProviderState).toBe('mock');
    expect(run.scriptureProviderState).toBe('mock');
  });

  it('snapshots the consent selection onto the run', async () => {
    const run = await executeCompanionRun(deps, {
      settings: settings({ inputs: { capture: true, journal: true, recent: false } }),
      entries: ENTRIES,
      trigger: 'scheduled',
      now: NOW,
    });
    expect(run.inputSelection).toEqual(['capture', 'journal']);
    expect(run.usedEntryIds).toEqual(['capture-1', 'journal-1']);
    expect(run.usedEntryIds).not.toContain('recent-1');
  });

  it('composes but does not send the question without Gloo consent', async () => {
    const run = await executeCompanionRun(deps, {
      settings: settings({ glooConsentAt: null }),
      entries: ENTRIES,
      trigger: 'manual',
      now: NOW,
    });
    expect(run.status).toBe('degraded');
    expect(run.question).not.toBeNull();
    expect(run.glooResponse).toBeNull();
    expect(run.glooProviderState).toBe('not_consented');
    expect(run.degradedReason).toMatch(/not allowed Icthus to send/i);
  });

  it('blocks a run with no selected inputs', async () => {
    const run = await executeCompanionRun(deps, {
      settings: settings({ inputs: { capture: false, journal: false, recent: false } }),
      entries: ENTRIES,
      trigger: 'manual',
      now: NOW,
    });
    expect(run.status).toBe('blocked');
    expect(run.question).toBeNull();
  });

  it('preserves the input and degrades honestly when the provider fails', async () => {
    const failing: FaithConnectionProvider = {
      id: 'gloo-failing',
      state: 'unavailable',
      async ask(): Promise<GlooResponse> {
        throw new Error('network');
      },
      async connectionCard() {
        return {
          title: '',
          body: '',
          actionLabel: '',
          actionUrl: null,
          providerState: 'unavailable' as const,
        };
      },
    };
    const run = await executeCompanionRun(
      { scripture: deps.scripture, gloo: failing },
      { settings: settings(), entries: ENTRIES, trigger: 'manual', now: NOW },
    );
    expect(run.status).toBe('degraded');
    expect(run.inputSummary).toContain('stretched thin');
    expect(run.passage).not.toBeNull();
    expect(run.glooProviderState).toBe('unavailable');
    expect(run.degradedReason).toMatch(/run this again/i);
  });

  it('never reports a mocked run as delivered', async () => {
    const run = await executeCompanionRun(deps, {
      settings: settings(),
      entries: ENTRIES,
      trigger: 'manual',
      now: NOW,
    });
    expect(run.glooProviderState).not.toBe('live');
  });
});
