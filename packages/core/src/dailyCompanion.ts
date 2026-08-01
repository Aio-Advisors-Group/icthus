import type { ProviderState, ScripturePassage } from './contracts';
import type { FaithConnectionProvider, GlooRequest, GlooResponse } from './providers/gloo';
import type { ScriptureProvider } from './providers/scripture';
import { nextRunAt, type Schedule } from './schedule';
import { retrievalThemes, themeLabel } from './themes';

/**
 * The Daily Devotional Companion.
 *
 * A scheduled run that reads only the inputs a person explicitly allowed,
 * retrieves Scripture, asks one bounded question, and keeps a private,
 * inspectable transcript of exactly what happened.
 *
 * Two invariants drive the design:
 *  - The input selection is a data-processing consent, snapshotted onto each
 *    run. Changing it affects the next run and never retroactively exposes an
 *    entry that was excluded when the run happened.
 *  - Nothing is sent to Gloo without purpose-specific consent, and a run
 *    against a mocked or unavailable provider is labelled as such.
 */

export const COMPANION_INPUT_KINDS = ['capture', 'journal', 'recent'] as const;
export type CompanionInputKind = (typeof COMPANION_INPUT_KINDS)[number];

export const COMPANION_INPUT_SPECS: readonly {
  id: CompanionInputKind;
  label: string;
  description: string;
}[] = [
  {
    id: 'capture',
    label: 'Today’s capture',
    description: 'What you write, speak, or note today.',
  },
  {
    id: 'journal',
    label: 'Devotional journal',
    description: 'Notes you imported yourself, such as an Apple Note.',
  },
  {
    id: 'recent',
    label: 'Last 24 hours',
    description: 'Anything else you shared with Icthus in the last day.',
  },
] as const;

export type DailyCompanionSettings = {
  enabled: boolean;
  schedule: Schedule;
  timeZone: string;
  inputs: Record<CompanionInputKind, boolean>;
  /**
   * Purpose-specific consent to send a bounded summary to Gloo. Separate from
   * the input selection on purpose: allowing Icthus to read something is not
   * the same as allowing it to be sent anywhere.
   */
  glooConsentAt: string | null;
  updatedAt: string;
};

export const DEFAULT_COMPANION_SETTINGS: DailyCompanionSettings = {
  enabled: false,
  schedule: { frequency: 'daily', time: '07:30' },
  timeZone: 'UTC',
  inputs: { capture: true, journal: false, recent: false },
  glooConsentAt: null,
  updatedAt: new Date(0).toISOString(),
};

export type CompanionInputEntry = {
  id: string;
  kind: CompanionInputKind;
  occurredAt: string;
  body: string;
};

export type RunStatus = 'succeeded' | 'degraded' | 'blocked';

export type DailyCompanionRun = {
  id: string;
  status: RunStatus;
  trigger: 'manual' | 'scheduled';
  startedAt: string;
  completedAt: string;
  /** Consent snapshot at the moment the run executed. */
  inputSelection: readonly CompanionInputKind[];
  /** Exactly what was derived from those inputs — shown to the user verbatim. */
  inputSummary: string;
  usedEntryIds: readonly string[];
  passage: ScripturePassage | null;
  question: string | null;
  glooResponse: GlooResponse | null;
  scriptureProviderState: ProviderState;
  glooProviderState: ProviderState | 'not_consented';
  /** Present when the run could not complete normally. */
  degradedReason: string | null;
};

const SUMMARY_EXCERPT_LIMIT = 200;

function excerpt(text: string, limit = SUMMARY_EXCERPT_LIMIT): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= limit) return collapsed;
  return `${collapsed.slice(0, limit - 1)}…`;
}

/**
 * Derives the input summary.
 *
 * Only today's capture contributes actual words, and only a bounded excerpt of
 * it. Imported notes and recent entries contribute counts. This is what makes
 * "not more content than needed" concrete rather than aspirational.
 */
export function buildInputSummary(
  entries: readonly CompanionInputEntry[],
  selection: readonly CompanionInputKind[],
): { summary: string; usedEntryIds: string[] } {
  const allowed = new Set(selection);
  const used: string[] = [];
  const parts: string[] = [];

  const captures = entries.filter((e) => e.kind === 'capture' && allowed.has('capture'));
  if (captures.length > 0) {
    const latest = captures[captures.length - 1];
    if (latest) {
      used.push(latest.id);
      parts.push(`Today’s capture: “${excerpt(latest.body)}”`);
    }
  }

  const journals = entries.filter((e) => e.kind === 'journal' && allowed.has('journal'));
  if (journals.length > 0) {
    for (const entry of journals) used.push(entry.id);
    const noun = journals.length === 1 ? 'note' : 'notes';
    parts.push(`Devotional journal: ${journals.length} imported ${noun} (content not sent).`);
  }

  const recent = entries.filter((e) => e.kind === 'recent' && allowed.has('recent'));
  if (recent.length > 0) {
    for (const entry of recent) used.push(entry.id);
    const noun = recent.length === 1 ? 'entry' : 'entries';
    parts.push(`Last 24 hours: ${recent.length} other ${noun} (content not sent).`);
  }

  if (parts.length === 0) {
    return { summary: 'No inputs were available for this run.', usedEntryIds: [] };
  }
  return { summary: parts.join(' '), usedEntryIds: used };
}

/**
 * Composes the single bounded question. Icthus writes this, not the model, and
 * it is shown to the user in the transcript before the answer.
 */
export function composeQuestion(
  passage: ScripturePassage,
  themes: readonly string[],
  summary: string,
): string {
  const primary = themes[0] ? themeLabel(themes[0]).toLowerCase() : 'what this person is carrying';
  return [
    `A person brought this to reflection today: ${summary}`,
    `Reading ${passage.reference} (${passage.translation.abbreviation}): “${passage.text}”`,
    `In historic Christian teaching, how might this passage speak to ${primary}?`,
    'Ground the answer in Scripture and named sources. Do not claim certainty about God’s will for this person, and do not offer clinical or crisis advice.',
  ].join('\n\n');
}

export type RunDependencies = {
  scripture: ScriptureProvider;
  gloo: FaithConnectionProvider;
};

export type RunOptions = {
  settings: DailyCompanionSettings;
  entries: readonly CompanionInputEntry[];
  trigger: 'manual' | 'scheduled';
  now?: Date;
};

/**
 * Executes one run. Never throws for provider problems — a failed provider
 * yields a `degraded` run that still preserves the person's input, which is
 * the behaviour the acceptance criteria require.
 */
export async function executeCompanionRun(
  deps: RunDependencies,
  options: RunOptions,
): Promise<DailyCompanionRun> {
  const now = options.now ?? new Date();
  const startedAt = now.toISOString();
  const { settings } = options;

  const selection = COMPANION_INPUT_KINDS.filter((kind) => settings.inputs[kind]);
  const { summary, usedEntryIds } = buildInputSummary(options.entries, selection);

  const base = {
    id: `run:${now.getTime()}`,
    trigger: options.trigger,
    startedAt,
    inputSelection: selection,
    inputSummary: summary,
    usedEntryIds,
  };

  if (selection.length === 0) {
    return {
      ...base,
      status: 'blocked',
      completedAt: new Date().toISOString(),
      passage: null,
      question: null,
      glooResponse: null,
      scriptureProviderState: deps.scripture.state,
      glooProviderState: 'not_consented',
      degradedReason: 'No inputs are selected, so there was nothing for Icthus to read.',
    };
  }

  const themeSource = options.entries
    .filter((entry) => selection.includes(entry.kind))
    .map((entry) => entry.body)
    .join(' ');
  const themes = retrievalThemes(themeSource);

  let passage: ScripturePassage | null = null;
  try {
    const [found] = await deps.scripture.search(themes, 1);
    passage = found ?? (await deps.scripture.passageOfTheDay(now));
  } catch {
    passage = null;
  }

  if (!passage) {
    return {
      ...base,
      status: 'degraded',
      completedAt: new Date().toISOString(),
      passage: null,
      question: null,
      glooResponse: null,
      scriptureProviderState: 'unavailable',
      glooProviderState: 'not_consented',
      degradedReason:
        'Scripture could not be retrieved, so no question was sent. Your input has been kept.',
    };
  }

  const question = composeQuestion(passage, themes, summary);

  // Purpose-specific consent gate. Without it, the run stops here and says so.
  if (!settings.glooConsentAt) {
    return {
      ...base,
      status: 'degraded',
      completedAt: new Date().toISOString(),
      passage,
      question,
      glooResponse: null,
      scriptureProviderState: passage.providerState,
      glooProviderState: 'not_consented',
      degradedReason:
        'You have not allowed Icthus to send anything to Gloo, so the question below was composed but not sent.',
    };
  }

  const request: GlooRequest = {
    passageReference: passage.reference,
    passageText: passage.text,
    translationAbbreviation: passage.translation.abbreviation,
    inputSummary: summary,
    themes,
    question,
  };

  let glooResponse: GlooResponse | null = null;
  try {
    glooResponse = await deps.gloo.ask(request, now);
  } catch {
    glooResponse = null;
  }

  if (!glooResponse || glooResponse.providerState === 'unavailable') {
    return {
      ...base,
      status: 'degraded',
      completedAt: new Date().toISOString(),
      passage,
      question,
      glooResponse,
      scriptureProviderState: passage.providerState,
      glooProviderState: 'unavailable',
      degradedReason:
        'Gloo did not respond. Your input and the passage are saved — you can run this again.',
    };
  }

  return {
    ...base,
    status: 'succeeded',
    completedAt: new Date().toISOString(),
    passage,
    question,
    glooResponse,
    scriptureProviderState: passage.providerState,
    glooProviderState: glooResponse.providerState,
    degradedReason: null,
  };
}

export function nextCompanionRun(settings: DailyCompanionSettings, now = new Date()): Date | null {
  if (!settings.enabled) return null;
  return nextRunAt({ schedule: settings.schedule, timeZone: settings.timeZone, now });
}

/**
 * The label shown next to a provider in the companion settings.
 * `mock` deliberately does not render as "Connected".
 */
export function providerBadge(state: ProviderState | 'not_consented'): {
  label: string;
  tone: 'ok' | 'neutral' | 'warn';
} {
  switch (state) {
    case 'live':
      return { label: 'Connected', tone: 'ok' };
    case 'mock':
      return { label: 'Local sample content', tone: 'neutral' };
    case 'not_consented':
      return { label: 'Not permitted yet', tone: 'neutral' };
    case 'unavailable':
    default:
      return { label: 'Not connected', tone: 'warn' };
  }
}
