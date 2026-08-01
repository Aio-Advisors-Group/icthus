import { describe, expect, it } from 'vitest';
import {
  REFLECTION_MAX_WORDS,
  REFLECTION_MIN_WORDS,
  countWords,
  validateCompanionResult,
} from '../contracts';
import { SCRIPTURE_CORPUS } from '../corpus';
import { DeterministicCompanionProvider, guidanceSourceIds } from './companion';
import { LocalScriptureProvider } from './scripture';

const scripture = new LocalScriptureProvider();
const companion = new DeterministicCompanionProvider(scripture);

/** Text that reliably retrieves each corpus passage, keyed by source id. */
const PROMPTS: Record<string, string> = {
  'web:matthew-11-28': 'I am so tired and burdened, completely exhausted and overwhelmed.',
  'web:psalm-34-18': 'My heart is broken. I am grieving a loss and feel crushed.',
  'web:philippians-4-6': 'I am anxious and worried, my mind is racing with worry.',
  'web:matthew-6-33': 'Work and this deal and the client deadline are taking over my priorities.',
  'web:lamentations-3-22': 'I need hope. I am starting over and trying to keep going.',
  'web:isaiah-41-10': 'I am afraid and scared about this change and uncertainty.',
  'web:1-thessalonians-5-16': 'I am so grateful and thankful today, full of gratitude.',
  'web:matthew-18-21': 'I need to forgive someone. I feel bitter and hold a grudge.',
  'web:james-1-5': 'I have a question and I am confused, full of doubt and wondering why.',
  'web:psalm-139-1': 'I feel lonely and invisible, isolated and unseen.',
  'web:1-corinthians-10-13': 'I was tempted again. The temptation and craving came back.',
  'web:proverbs-3-5': 'I have a decision to make and I am unsure which choice to make.',
  'web:john-11-33': 'Someone died. The funeral was today and I am mourning.',
  'web:ecclesiastes-4-9': 'I am alone in this and feel isolated with nobody to help.',
  'web:john-14-27': 'I want peace. I want to feel calm and settled and still.',
};

describe('response contract', () => {
  it('authors guidance for every passage in the corpus', () => {
    const corpusIds = SCRIPTURE_CORPUS.map((p) => p.sourceId).sort();
    expect(guidanceSourceIds().sort()).toEqual(corpusIds);
  });

  it('keeps every authored reflection inside the contract word bounds', async () => {
    for (const [sourceId, prompt] of Object.entries(PROMPTS)) {
      const result = await companion.respond({
        entryId: `entry-${sourceId}`,
        body: prompt,
        purpose: 'reflect',
      });
      if (result.kind !== 'companion') throw new Error(`Expected devotional for ${sourceId}`);
      const words = countWords(result.reflection);
      expect(
        words,
        `${result.primaryPassage.sourceId} reflection was ${words} words`,
      ).toBeGreaterThanOrEqual(REFLECTION_MIN_WORDS);
      expect(words).toBeLessThanOrEqual(REFLECTION_MAX_WORDS);
    }
  });

  it('produces a validated, fully cited response', async () => {
    const result = await companion.respond({
      entryId: 'entry-1',
      body: 'I am anxious about tomorrow and cannot stop worrying.',
      purpose: 'pray',
    });
    if (result.kind !== 'companion') throw new Error('Expected devotional response');

    const knownIds = new Set([
      result.primaryPassage.sourceId,
      ...result.supportingSources.map((s) => s.sourceId),
    ]);
    const validation = validateCompanionResult(result, knownIds);
    expect(validation.ok).toBe(true);
    expect(result.citations.some((c) => c.supports === 'primary_passage')).toBe(true);
    expect(result.supportingSources.length).toBeLessThanOrEqual(3);
  });

  it('is deterministic — identical input yields identical Scripture', async () => {
    const body = 'I feel lonely and unseen lately.';
    const first = await companion.respond({ entryId: 'a', body, purpose: 'reflect' });
    const second = await companion.respond({ entryId: 'b', body, purpose: 'reflect' });
    if (first.kind !== 'companion' || second.kind !== 'companion') {
      throw new Error('Expected devotional responses');
    }
    expect(first.primaryPassage.sourceId).toBe(second.primaryPassage.sourceId);
    expect(first.reflection).toBe(second.reflection);
  });

  it('rejects a citation that does not resolve to a retrieved source', async () => {
    const result = await companion.respond({
      entryId: 'entry-2',
      body: 'I am grateful today.',
      purpose: 'reflect',
    });
    if (result.kind !== 'companion') throw new Error('Expected devotional response');

    const tampered = {
      ...result,
      citations: [
        ...result.citations,
        {
          sourceId: 'fabricated:not-a-real-source',
          displayReference: 'Hezekiah 4:12',
          supports: 'reflection' as const,
        },
      ],
    };
    const validation = validateCompanionResult(
      tampered,
      new Set([result.primaryPassage.sourceId, ...result.supportingSources.map((s) => s.sourceId)]),
    );
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.issues.some((i) => i.message.includes('does not resolve'))).toBe(true);
    }
  });

  it('rejects a response that claims personal divine instruction', async () => {
    const result = await companion.respond({
      entryId: 'entry-3',
      body: 'I have a decision to make.',
      purpose: 'discern',
    });
    if (result.kind !== 'companion') throw new Error('Expected devotional response');

    const tampered = { ...result, whyThisPassage: 'God is telling you to take the job.' };
    const validation = validateCompanionResult(
      tampered,
      new Set([result.primaryPassage.sourceId, ...result.supportingSources.map((s) => s.sourceId)]),
    );
    expect(validation.ok).toBe(false);
  });

  it('omits the next step when the person only asked to reflect', async () => {
    const reflect = await companion.respond({
      entryId: 'entry-4',
      body: 'I am tired and burdened.',
      purpose: 'reflect',
    });
    const discern = await companion.respond({
      entryId: 'entry-5',
      body: 'I am tired and burdened.',
      purpose: 'discern',
    });
    if (reflect.kind !== 'companion' || discern.kind !== 'companion') {
      throw new Error('Expected devotional responses');
    }
    expect(reflect.nextStep).toBeNull();
    expect(discern.nextStep).not.toBeNull();
  });
});

describe('crisis routing', () => {
  it('returns the support contract instead of devotional content', async () => {
    const result = await companion.respond({
      entryId: 'entry-crisis',
      body: 'I do not want to be alive anymore.',
      purpose: 'pray',
    });
    expect(result.kind).toBe('support');
    if (result.kind !== 'support') return;
    expect(result.safetyState).toBe('urgent_support');
    expect(result.resources.length).toBeGreaterThan(0);
    expect(result.disclaimer).toMatch(/not emergency/i);
  });

  it('adds a pastoral note without suppressing Scripture for lower distress', async () => {
    const result = await companion.respond({
      entryId: 'entry-distress',
      body: 'Everything is falling apart and I feel hopeless about all of it.',
      purpose: 'pray',
    });
    expect(result.kind).toBe('companion');
    if (result.kind !== 'companion') return;
    expect(result.safetyState).toBe('pastoral_support');
    expect(result.acknowledgement).toMatch(/telling someone you trust/i);
    expect(result.primaryPassage.reference.length).toBeGreaterThan(0);
  });
});

describe('scripture provider honesty', () => {
  it('labels local corpus passages as mock, never live', async () => {
    const [passage] = await scripture.search(['anxiety'], 1);
    expect(passage?.providerState).toBe('mock');
    expect(passage?.translation.abbreviation).toBe('WEB');
    expect(passage?.attribution).toMatch(/public domain/i);
  });

  it('returns a stable passage for a given day', async () => {
    const date = new Date('2026-07-31T12:00:00Z');
    const first = await scripture.passageOfTheDay(date);
    const second = await scripture.passageOfTheDay(date);
    expect(first.sourceId).toBe(second.sourceId);
  });
});
