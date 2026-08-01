import { describe, expect, it } from 'vitest';
import { classifySafety } from './safety';

describe('safety classification', () => {
  it('catches immediate risk in contracted and expanded forms alike', () => {
    const phrasings = [
      "I don't want to be alive anymore",
      'I do not want to be alive anymore',
      'i dont want to live',
      'I want to die',
      'I have been thinking about killing myself',
      'I wish I was dead',
      'there is no reason to live',
      'I have been cutting myself again',
      'my husband hits me',
      'I am not safe at home',
    ];
    for (const text of phrasings) {
      expect(classifySafety(text).state, text).toBe('urgent_support');
    }
  });

  it('routes lower distress to pastoral support rather than crisis', () => {
    const phrasings = [
      'everything is falling apart',
      'I feel hopeless about all of it',
      "I can't keep going like this",
      'I have been drinking too much',
      'I relapsed last week',
    ];
    for (const text of phrasings) {
      expect(classifySafety(text).state, text).toBe('pastoral_support');
    }
  });

  it('leaves ordinary hard days alone', () => {
    const phrasings = [
      'Work was rough today and I am tired',
      'I am anxious about a presentation tomorrow',
      'I am grieving my grandmother',
      'I had an argument with my wife',
      'I read about a death in the news',
    ];
    for (const text of phrasings) {
      expect(classifySafety(text).state, text).toBe('normal');
    }
  });

  it('never records the matched text, only a signal class', () => {
    const assessment = classifySafety('I want to die');
    expect(assessment.signal).toBe('immediate_risk');
    expect(JSON.stringify(assessment)).not.toContain('die');
  });
});
