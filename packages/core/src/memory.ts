import type { MemoryInsight } from './contracts';
import { EXTRACTOR_VERSION, SENSITIVE_THEMES, nonSensitiveThemes, themeLabel } from './themes';

/**
 * The Memory engine.
 *
 * Off until the person turns it on. It looks only at entries they saved, only
 * for non-sensitive recurring themes, and only reports what it can evidence
 * with a count, a window, and the entry IDs behind it.
 *
 * It never says "I know you."
 */

export const MEMORY_MIN_ENTRIES = 3;
export const MEMORY_WINDOWS_DAYS = [7, 30, 90] as const;
export type MemoryWindowDays = (typeof MEMORY_WINDOWS_DAYS)[number];

export type MemoryPreferences = {
  /** Off by default. Nothing is aggregated until this is true. */
  enabled: boolean;
  windowDays: MemoryWindowDays;
  /** Themes the user chose to hide. Never resurfaced. */
  hiddenThemes: readonly string[];
  /** Entries the user excluded from Memory specifically. */
  excludedEntryIds: readonly string[];
};

export const DEFAULT_MEMORY_PREFERENCES: MemoryPreferences = {
  enabled: false,
  windowDays: 30,
  hiddenThemes: [],
  excludedEntryIds: [],
};

export type MemoryCandidateEntry = {
  id: string;
  /** ISO timestamp. */
  occurredAt: string;
  body: string;
};

function daysBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / 86_400_000;
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Produces insight candidates that pass every gate:
 *  - Memory is enabled
 *  - the entry is inside the chosen window and not excluded
 *  - the theme is not sensitive and not hidden
 *  - at least MEMORY_MIN_ENTRIES distinct entries contain it
 *
 * Returns them strongest-first. An empty array is a normal, common result.
 */
export function buildMemoryInsights(
  entries: readonly MemoryCandidateEntry[],
  preferences: MemoryPreferences,
  now: Date = new Date(),
): MemoryInsight[] {
  if (!preferences.enabled) return [];

  const excluded = new Set(preferences.excludedEntryIds);
  const hidden = new Set(preferences.hiddenThemes);

  const inWindow = entries.filter((entry) => {
    if (excluded.has(entry.id)) return false;
    const occurred = new Date(entry.occurredAt);
    if (Number.isNaN(occurred.getTime())) return false;
    const age = daysBetween(now, occurred);
    return age >= 0 && age <= preferences.windowDays;
  });

  const byTheme = new Map<string, { entryIds: string[]; dates: Date[] }>();

  for (const entry of inWindow) {
    // Distinct themes per entry: writing "anxious" five times in one entry is
    // still one entry, not five occurrences.
    const themes = new Set(nonSensitiveThemes(entry.body));
    for (const theme of themes) {
      if (hidden.has(theme) || SENSITIVE_THEMES.has(theme)) continue;
      const bucket = byTheme.get(theme) ?? { entryIds: [], dates: [] };
      bucket.entryIds.push(entry.id);
      bucket.dates.push(new Date(entry.occurredAt));
      byTheme.set(theme, bucket);
    }
  }

  const insights: MemoryInsight[] = [];

  for (const [theme, bucket] of byTheme) {
    if (bucket.entryIds.length < MEMORY_MIN_ENTRIES) continue;
    const sorted = [...bucket.dates].sort((a, b) => a.getTime() - b.getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) continue;
    insights.push({
      id: `insight:${theme}:${preferences.windowDays}`,
      theme,
      entryCount: bucket.entryIds.length,
      periodStart: formatDay(first),
      periodEnd: formatDay(last),
      entryIds: [...bucket.entryIds],
      confidence: bucket.entryIds.length >= 5 ? 'high' : 'moderate',
      extractorVersion: EXTRACTOR_VERSION,
    });
  }

  return insights.sort((a, b) => {
    if (b.entryCount !== a.entryCount) return b.entryCount - a.entryCount;
    return a.theme.localeCompare(b.theme);
  });
}

/**
 * The sentence shown on the insight card. It states an observation about the
 * person's own saved writing and nothing more — no interpretation, no claim
 * about what it means.
 */
export function describeInsight(insight: MemoryInsight): string {
  const noun = insight.entryCount === 1 ? 'reflection' : 'reflections';
  return `${themeLabel(insight.theme)} has appeared in ${insight.entryCount} saved ${noun}.`;
}

export function describeInsightEvidence(insight: MemoryInsight): string {
  return `From your saved reflections · ${insight.periodStart} to ${insight.periodEnd}`;
}
