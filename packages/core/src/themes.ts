/**
 * Deterministic theme extraction.
 *
 * This runs before any model call and is the only theme source the Memory
 * engine trusts. It is intentionally shallow: it recognises words the user
 * actually wrote. It does not infer mood, diagnose, or model personality.
 *
 * Embeddings can be layered on later behind the same interface — see
 * docs/adr/0003-deterministic-theme-extraction.md.
 */

export const EXTRACTOR_VERSION = 'themes@1.0.0';

/**
 * Categories that are never eligible for Memory aggregation or for an insight
 * card, even when the user clearly wrote about them. Recognising them matters
 * for retrieval; surfacing them back as a "pattern we noticed" does not belong
 * in a product like this.
 */
export const SENSITIVE_THEMES: ReadonlySet<string> = new Set([
  'medical',
  'sexuality',
  'finances',
  'location',
  'third_party',
  'crisis',
]);

type ThemeRule = {
  theme: string;
  /** Whole-word matches only, so "note" never matches "notice". */
  keywords: readonly string[];
};

const THEME_RULES: readonly ThemeRule[] = [
  {
    theme: 'anxiety',
    keywords: [
      'anxious',
      'anxiety',
      'worried',
      'worry',
      'worrying',
      'nervous',
      'panic',
      'panicking',
      'dread',
      'restless',
    ],
  },
  { theme: 'fear', keywords: ['afraid', 'fear', 'fearful', 'scared', 'terrified', 'frightened'] },
  {
    theme: 'weariness',
    keywords: [
      'tired',
      'exhausted',
      'exhausting',
      'weary',
      'drained',
      'burnout',
      'burned',
      'depleted',
      'stretched',
    ],
  },
  {
    theme: 'burden',
    keywords: ['burden', 'burdened', 'heavy', 'carrying', 'weight', 'overwhelmed', 'overwhelming'],
  },
  {
    theme: 'grief',
    keywords: [
      'grief',
      'grieving',
      'mourning',
      'loss',
      'died',
      'death',
      'funeral',
      'heartbroken',
      'devastated',
    ],
  },
  {
    theme: 'loneliness',
    keywords: ['lonely', 'loneliness', 'alone', 'isolated', 'isolation', 'unseen', 'invisible'],
  },
  {
    theme: 'gratitude',
    keywords: ['grateful', 'gratitude', 'thankful', 'thanks', 'blessed', 'appreciate'],
  },
  { theme: 'joy', keywords: ['joy', 'joyful', 'delighted', 'celebrate', 'celebrating', 'happy'] },
  { theme: 'hope', keywords: ['hope', 'hopeful', 'hoping'] },
  { theme: 'despair', keywords: ['hopeless', 'despair', 'pointless', 'meaningless', 'numb'] },
  {
    theme: 'forgiveness',
    keywords: [
      'forgive',
      'forgiveness',
      'forgiving',
      'resentment',
      'resentful',
      'bitter',
      'bitterness',
      'grudge',
    ],
  },
  {
    theme: 'conflict',
    keywords: ['argument', 'argued', 'fight', 'fought', 'conflict', 'tension', 'fell out'],
  },
  {
    theme: 'relationships',
    keywords: [
      'marriage',
      'spouse',
      'husband',
      'wife',
      'friend',
      'friendship',
      'family',
      'parents',
      'kids',
      'children',
    ],
  },
  { theme: 'patience', keywords: ['patience', 'patient', 'impatient', 'waiting', 'slow'] },
  {
    theme: 'discernment',
    keywords: [
      'decision',
      'decide',
      'deciding',
      'choice',
      'choose',
      'discern',
      'discerning',
      'crossroads',
      'unsure',
    ],
  },
  {
    theme: 'question',
    keywords: ['question', 'wondering', 'confused', 'confusing', 'doubt', 'doubting', 'why'],
  },
  { theme: 'purpose', keywords: ['purpose', 'calling', 'vocation', 'meaning', 'direction'] },
  {
    theme: 'work',
    keywords: [
      'work',
      'job',
      'career',
      'deal',
      'client',
      'deadline',
      'promotion',
      'meeting',
      'boss',
    ],
  },
  { theme: 'temptation', keywords: ['tempted', 'temptation', 'relapse', 'craving', 'slipped'] },
  {
    theme: 'shame',
    keywords: ['ashamed', 'shame', 'guilty', 'guilt', 'embarrassed', 'failure', 'failed'],
  },
  { theme: 'peace', keywords: ['peace', 'peaceful', 'calm', 'settled', 'still'] },
  { theme: 'endurance', keywords: ['keep going', 'persevere', 'endure', 'holding on'] },
  // Recognised for retrieval and safety routing, excluded from Memory.
  {
    theme: 'medical',
    keywords: [
      'diagnosis',
      'diagnosed',
      'cancer',
      'surgery',
      'hospital',
      'medication',
      'therapy',
      'therapist',
      'illness',
    ],
  },
  {
    theme: 'finances',
    keywords: ['debt', 'bankruptcy', 'mortgage', 'rent', 'bills', 'salary', 'broke', 'foreclosure'],
  },
  { theme: 'sexuality', keywords: ['sex', 'sexual', 'porn', 'pornography', 'affair', 'lust'] },
];

export type ExtractedTheme = {
  theme: string;
  /** How many distinct keyword hits produced this theme. */
  hits: number;
  confidence: 'low' | 'moderate' | 'high';
  sensitive: boolean;
};

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function confidenceFor(hits: number): ExtractedTheme['confidence'] {
  if (hits >= 3) return 'high';
  if (hits === 2) return 'moderate';
  return 'low';
}

/**
 * Extracts themes from free text. Returns them ordered by strength, then
 * alphabetically, so callers get a stable result for identical input.
 */
export function extractThemes(text: string): ExtractedTheme[] {
  const haystack = ` ${text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')} `;
  const results: ExtractedTheme[] = [];

  for (const rule of THEME_RULES) {
    let hits = 0;
    for (const keyword of rule.keywords) {
      const pattern = new RegExp(`\\b${escapeForRegex(keyword)}\\b`, 'gu');
      const matches = haystack.match(pattern);
      if (matches) hits += matches.length;
    }
    if (hits > 0) {
      results.push({
        theme: rule.theme,
        hits,
        confidence: confidenceFor(hits),
        sensitive: SENSITIVE_THEMES.has(rule.theme),
      });
    }
  }

  return results.sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits;
    return a.theme.localeCompare(b.theme);
  });
}

/** Theme names only, with sensitive categories removed. For Memory. */
export function nonSensitiveThemes(text: string): string[] {
  return extractThemes(text)
    .filter((t) => !t.sensitive)
    .map((t) => t.theme);
}

/**
 * Themes for retrieval, including sensitive ones — a person writing about a
 * diagnosis should still be met with Scripture about fear. Retrieval and
 * Memory have different rules on purpose.
 */
export function retrievalThemes(text: string): string[] {
  const extracted = extractThemes(text).map((t) => t.theme);
  return extracted.length > 0 ? extracted : ['hope'];
}

const THEME_LABELS: Record<string, string> = {
  anxiety: 'Anxiety',
  fear: 'Fear',
  weariness: 'Weariness',
  burden: 'Carrying a lot',
  grief: 'Grief',
  loneliness: 'Loneliness',
  gratitude: 'Gratitude',
  joy: 'Joy',
  hope: 'Hope',
  despair: 'Discouragement',
  forgiveness: 'Forgiveness',
  conflict: 'Conflict',
  relationships: 'Relationships',
  patience: 'Patience',
  discernment: 'Discernment',
  question: 'Questions',
  purpose: 'Purpose',
  work: 'Work',
  temptation: 'Temptation',
  shame: 'Shame',
  peace: 'Peace',
  endurance: 'Endurance',
};

export function themeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme.charAt(0).toUpperCase() + theme.slice(1);
}
