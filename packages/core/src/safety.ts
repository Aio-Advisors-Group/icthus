import type { SafetyState, SupportResource } from './contracts';

/**
 * Safety classification.
 *
 * This is a routing decision, not a clinical assessment. Its only job is to
 * decide whether an ordinary devotional response is the wrong thing to return.
 * It errs toward offering support, and it never records a "diagnosis" anywhere.
 */

export const SAFETY_VERSION = 'safety@1.0.0';

/**
 * Apostrophes are stripped so "don't" and "dont" collapse to one form, and
 * negated auxiliaries are matched in both contracted and expanded forms below.
 * Someone in crisis does not write carefully, and a classifier that only
 * catches one spelling of "I don't want to be alive" is worse than useless.
 */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[‘’']/g, '').replace(/\s+/g, ' ');
}

const URGENT_PATTERNS: readonly RegExp[] = [
  /\bkill(ing)? myself\b/,
  /\b(end|ending) my (own )?life\b/,
  /\btak(e|ing) my own life\b/,
  /\bsuicid(e|al)\b/,
  /\b(dont|do not) want to (be alive|live|exist)\b/,
  /\bwant to die\b/,
  /\bwish i (was|were) dead\b/,
  /\bbetter off (dead|without me)\b/,
  /\bno reason to (live|be here)\b/,
  /\bhurt(ing)? myself\b/,
  /\bharm(ing)? myself\b/,
  /\bself[- ]?harm/,
  /\bcut(ting)? myself\b/,
  // Named relations as well as pronouns: people rarely write "he hits me"
  // when they mean their husband.
  /\b(he|she|they|my (husband|wife|partner|boyfriend|girlfriend|ex|dad|father|mom|mother|parents|brother|sister|son|daughter|roommate)) (hits?|beats?|hurts?|chokes?|threatens?|threatened) me\b/,
  /\b(im|i am) (not safe|being (hurt|abused|threatened)|afraid of (him|her|them))\b/,
  /\bin danger right now\b/,
];

const PASTORAL_PATTERNS: readonly RegExp[] = [
  /\b(cant|can not|cannot) (go on|cope|keep going|take (it|this) anymore)\b/,
  /\bfalling apart\b/,
  /\bbreaking down\b/,
  /\brock bottom\b/,
  /\bno ?(one|body) (cares|would notice)\b/,
  /\bcompletely alone\b/,
  /\bhopeless\b/,
  /\bdrinking too much\b/,
  /\brelapsed\b/,
];

export type SafetyAssessment = {
  state: SafetyState;
  version: string;
  /** Which pattern class fired. Never the matched user text. */
  signal: 'none' | 'distress' | 'immediate_risk';
};

export function classifySafety(text: string): SafetyAssessment {
  const normalised = normalise(text);
  for (const pattern of URGENT_PATTERNS) {
    if (pattern.test(normalised)) {
      return { state: 'urgent_support', version: SAFETY_VERSION, signal: 'immediate_risk' };
    }
  }
  for (const pattern of PASTORAL_PATTERNS) {
    if (pattern.test(normalised)) {
      return { state: 'pastoral_support', version: SAFETY_VERSION, signal: 'distress' };
    }
  }
  return { state: 'normal', version: SAFETY_VERSION, signal: 'none' };
}

/**
 * Deliberately generic and international. Icthus does not know the user's
 * location and must not guess one, so the copy points at local services rather
 * than naming a single country's hotline as though it were universal.
 */
export const SUPPORT_RESOURCES: readonly SupportResource[] = [
  {
    label: 'Local emergency services',
    detail:
      'If you are in immediate danger, call your local emergency number now — 911 in the US and Canada, 999 in the UK, 112 across the EU, 000 in Australia.',
    region: 'Worldwide',
  },
  {
    label: 'A crisis line near you',
    detail:
      'findahelpline.com lists free, confidential crisis lines by country. In the US and Canada you can call or text 988.',
    region: 'Worldwide',
  },
  {
    label: 'One person who knows you',
    detail:
      'If you can, tell one person tonight — a friend, a family member, a pastor, a doctor. You do not have to explain it well.',
    region: 'Anywhere',
  },
];

export const SUPPORT_COPY = {
  acknowledgement: 'Thank you for putting that into words. That took something.',
  message:
    'What you wrote sounds like more than a hard day, and it matters more than anything Icthus could offer you right now. Icthus is a quiet place to reflect — it is not emergency support, and it is not a person. Please reach out to someone who can actually be with you.',
  disclaimer:
    'Icthus is not emergency, medical, or crisis support, and it cannot contact anyone on your behalf. Your entry has been saved privately and was not sent anywhere.',
} as const;

export const PASTORAL_NOTE =
  'That sounds genuinely heavy. Scripture can sit with you in it, and it is also worth telling someone you trust — a friend, a pastor, or a doctor. You do not have to carry this by yourself.';
