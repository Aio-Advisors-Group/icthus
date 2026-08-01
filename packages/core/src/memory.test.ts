import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MEMORY_PREFERENCES,
  MEMORY_MIN_ENTRIES,
  buildMemoryInsights,
  describeInsight,
  type MemoryCandidateEntry,
  type MemoryPreferences,
} from './memory';

const NOW = new Date('2026-07-31T12:00:00Z');

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function entries(bodies: readonly { body: string; days: number }[]): MemoryCandidateEntry[] {
  return bodies.map((item, index) => ({
    id: `entry-${index}`,
    occurredAt: daysAgo(item.days),
    body: item.body,
  }));
}

const enabled = (overrides: Partial<MemoryPreferences> = {}): MemoryPreferences => ({
  ...DEFAULT_MEMORY_PREFERENCES,
  enabled: true,
  ...overrides,
});

describe('memory engine', () => {
  it('is off by default and produces nothing until opted in', () => {
    const data = entries([
      { body: 'I am struggling with patience', days: 1 },
      { body: 'patience again today', days: 3 },
      { body: 'waiting and being patient', days: 5 },
    ]);
    expect(buildMemoryInsights(data, DEFAULT_MEMORY_PREFERENCES, NOW)).toEqual([]);
    expect(buildMemoryInsights(data, enabled(), NOW).length).toBeGreaterThan(0);
  });

  it('requires the recurrence threshold before surfacing a theme', () => {
    const twoEntries = entries([
      { body: 'feeling anxious', days: 1 },
      { body: 'anxious again', days: 2 },
    ]);
    expect(buildMemoryInsights(twoEntries, enabled(), NOW)).toEqual([]);

    const threeEntries = entries([
      { body: 'feeling anxious', days: 1 },
      { body: 'anxious again', days: 2 },
      { body: 'so much worry today', days: 4 },
    ]);
    const insights = buildMemoryInsights(threeEntries, enabled(), NOW);
    expect(insights[0]?.theme).toBe('anxiety');
    expect(insights[0]?.entryCount).toBe(MEMORY_MIN_ENTRIES);
  });

  it('counts an entry once no matter how often a word repeats inside it', () => {
    const data = entries([
      { body: 'anxious anxious anxious anxious worried worried', days: 1 },
      { body: 'anxious', days: 2 },
    ]);
    expect(buildMemoryInsights(data, enabled(), NOW)).toEqual([]);
  });

  it('never aggregates sensitive categories', () => {
    const data = entries([
      { body: 'my diagnosis and the medication side effects', days: 1 },
      { body: 'back at the hospital for surgery', days: 3 },
      { body: 'more medication and another diagnosis', days: 5 },
      { body: 'worried about debt and the mortgage', days: 2 },
      { body: 'more debt and unpaid bills', days: 4 },
      { body: 'bills and rent and debt again', days: 6 },
    ]);
    const themes = buildMemoryInsights(data, enabled(), NOW).map((i) => i.theme);
    expect(themes).not.toContain('medical');
    expect(themes).not.toContain('finances');
  });

  it('respects hidden themes and excluded entries', () => {
    const data = entries([
      { body: 'grateful today', days: 1 },
      { body: 'so thankful', days: 2 },
      { body: 'gratitude again', days: 3 },
    ]);
    expect(buildMemoryInsights(data, enabled({ hiddenThemes: ['gratitude'] }), NOW)).toEqual([]);
    expect(buildMemoryInsights(data, enabled({ excludedEntryIds: ['entry-0'] }), NOW)).toEqual([]);
  });

  it('ignores entries outside the chosen window', () => {
    const data = entries([
      { body: 'lonely', days: 1 },
      { body: 'lonely again', days: 2 },
      { body: 'feeling isolated', days: 45 },
    ]);
    expect(buildMemoryInsights(data, enabled({ windowDays: 30 }), NOW)).toEqual([]);
    expect(buildMemoryInsights(data, enabled({ windowDays: 90 }), NOW).length).toBe(1);
  });

  it('carries the evidence needed to open the underlying entries', () => {
    const data = entries([
      { body: 'I need to forgive him', days: 1 },
      { body: 'still feeling bitter', days: 4 },
      { body: 'holding a grudge again', days: 8 },
    ]);
    const [insight] = buildMemoryInsights(data, enabled(), NOW);
    expect(insight).toBeDefined();
    expect(insight?.entryIds).toHaveLength(3);
    expect(insight?.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(insight?.extractorVersion).toContain('themes@');
  });

  it('states an observation, never an interpretation', () => {
    const data = entries([
      { body: 'anxious', days: 1 },
      { body: 'anxious', days: 2 },
      { body: 'worried', days: 3 },
    ]);
    const [insight] = buildMemoryInsights(data, enabled(), NOW);
    expect(insight).toBeDefined();
    if (!insight) return;
    const sentence = describeInsight(insight);
    expect(sentence).toBe('Anxiety has appeared in 3 saved reflections.');
    expect(sentence).not.toMatch(/you are|I know|God/i);
  });
});
