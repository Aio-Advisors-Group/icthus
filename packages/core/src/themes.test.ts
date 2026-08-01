import { describe, expect, it } from 'vitest';
import { extractThemes, nonSensitiveThemes, retrievalThemes, themeLabel } from './themes';

describe('theme extraction', () => {
  it('is deterministic', () => {
    const text = 'I am anxious about work and very tired.';
    expect(extractThemes(text)).toEqual(extractThemes(text));
  });

  it('matches whole words only', () => {
    expect(extractThemes('I made a note about it').map((t) => t.theme)).not.toContain('question');
    expect(extractThemes('the workshop was fine').map((t) => t.theme)).not.toContain('work');
  });

  it('ranks stronger signals first', () => {
    const themes = extractThemes('anxious anxious worried, and a little tired');
    expect(themes[0]?.theme).toBe('anxiety');
  });

  it('flags sensitive categories but keeps them out of the memory set', () => {
    const text = 'my diagnosis is worrying me and the medication is expensive';
    const all = extractThemes(text).map((t) => t.theme);
    expect(all).toContain('medical');
    expect(nonSensitiveThemes(text)).not.toContain('medical');
    expect(nonSensitiveThemes(text)).toContain('anxiety');
  });

  it('still retrieves Scripture for sensitive topics', () => {
    // Someone writing about a diagnosis should still be met with Scripture.
    expect(retrievalThemes('I got my diagnosis today')).toContain('medical');
  });

  it('falls back to hope rather than returning nothing', () => {
    expect(retrievalThemes('zzzz qqqq')).toEqual(['hope']);
  });

  it('renders human labels', () => {
    expect(themeLabel('anxiety')).toBe('Anxiety');
    expect(themeLabel('burden')).toBe('Carrying a lot');
    expect(themeLabel('unmapped')).toBe('Unmapped');
  });
});
