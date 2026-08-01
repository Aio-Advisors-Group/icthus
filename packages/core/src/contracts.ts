import { z } from 'zod';

/**
 * The Icthus response contract.
 *
 * Every companion result is validated against these schemas before it reaches
 * a screen. The contract exists so that Scripture — not model prose — is the
 * load-bearing part of the response, and so that every displayed claim can be
 * traced back to a source record.
 */

export const PurposeSchema = z.enum(['pray', 'understand', 'discern', 'reflect']);
export type Purpose = z.infer<typeof PurposeSchema>;

export const PURPOSE_LABELS: Record<Purpose, string> = {
  pray: 'Pray',
  understand: 'Understand',
  discern: 'Discern',
  reflect: 'Reflect',
};

export const CaptureKindSchema = z.enum([
  'reflection',
  'prayer',
  'question',
  'experience',
  'imported_note',
  'voice',
]);
export type CaptureKind = z.infer<typeof CaptureKindSchema>;

export const CaptureModeSchema = z.enum(['write', 'speak', 'note']);
export type CaptureMode = z.infer<typeof CaptureModeSchema>;

/**
 * `normal` renders the devotional contract. `pastoral_support` adds a gentle
 * suggestion to involve a person. `urgent_support` suppresses devotional
 * generation entirely and returns the support contract instead.
 */
export const SafetyStateSchema = z.enum(['normal', 'pastoral_support', 'urgent_support']);
export type SafetyState = z.infer<typeof SafetyStateSchema>;

/**
 * Whether a provider response came from a real credentialed call, the local
 * deterministic adapter, or a failed attempt. This value is surfaced in the UI
 * verbatim — a mocked provider must never render as "Connected".
 */
export const ProviderStateSchema = z.enum(['live', 'mock', 'unavailable']);
export type ProviderState = z.infer<typeof ProviderStateSchema>;

export const PROVIDER_STATE_LABELS: Record<ProviderState, string> = {
  live: 'Connected',
  mock: 'Local sample content',
  unavailable: 'Unavailable',
};

export const ScriptureReferenceSchema = z.object({
  book: z.string().min(1),
  chapter: z.number().int().positive(),
  verseStart: z.number().int().positive(),
  verseEnd: z.number().int().positive().nullable(),
});
export type ScriptureReference = z.infer<typeof ScriptureReferenceSchema>;

export const TranslationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  abbreviation: z.string().min(1),
  rights: z.string().min(1),
});
export type Translation = z.infer<typeof TranslationSchema>;

export const ScripturePassageSchema = z.object({
  sourceId: z.string().min(1),
  /** Human-readable citation, e.g. "Matthew 11:28-30". */
  reference: z.string().min(1),
  canonical: ScriptureReferenceSchema,
  text: z.string().min(1),
  /** Verses immediately around the passage, for the study view. */
  context: z.string().nullable(),
  translation: TranslationSchema,
  attribution: z.string().min(1),
  provider: z.string().min(1),
  providerState: ProviderStateSchema,
  canonicalUrl: z.string().url().nullable(),
});
export type ScripturePassage = z.infer<typeof ScripturePassageSchema>;

export const SourceKindSchema = z.enum([
  'scripture_context',
  'historic_witness',
  'scholarship',
  'tradition_specific',
]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SupportingSourceSchema = z.object({
  sourceId: z.string().min(1),
  kind: SourceKindSchema,
  title: z.string().min(1),
  author: z.string().min(1),
  /** Section, book, chapter, or paragraph locator within the work. */
  locator: z.string().min(1),
  edition: z.string().min(1),
  excerpt: z.string().min(1),
  /** Present only when the source speaks for one tradition; labelled in the UI. */
  tradition: z.string().nullable(),
  canonicalUrl: z.string().url().nullable(),
  rights: z.string().min(1),
});
export type SupportingSource = z.infer<typeof SupportingSourceSchema>;

export const CitationSchema = z.object({
  sourceId: z.string().min(1),
  displayReference: z.string().min(1),
  /** Which part of the response this citation backs. */
  supports: z.enum(['primary_passage', 'reflection', 'supporting_source']),
});
export type Citation = z.infer<typeof CitationSchema>;

export const MemoryInsightSchema = z.object({
  id: z.string().min(1),
  theme: z.string().min(1),
  entryCount: z.number().int().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  entryIds: z.array(z.string().min(1)).min(1),
  confidence: z.enum(['moderate', 'high']),
  extractorVersion: z.string().min(1),
});
export type MemoryInsight = z.infer<typeof MemoryInsightSchema>;

export const GenerationMetaSchema = z.object({
  adapter: z.string().min(1),
  promptVersion: z.string().min(1),
  modelVersion: z.string().nullable(),
  scriptureProviderState: ProviderStateSchema,
  companionProviderState: ProviderStateSchema,
});
export type GenerationMeta = z.infer<typeof GenerationMetaSchema>;

/** Word bounds for the reflection body, from the engineering package. */
export const REFLECTION_MIN_WORDS = 80;
export const REFLECTION_MAX_WORDS = 220;
export const MAX_SUPPORTING_SOURCES = 3;

export function countWords(value: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/u).length;
}

export const CompanionDevotionalSchema = z.object({
  kind: z.literal('companion'),
  id: z.string().min(1),
  entryId: z.string().min(1),
  purpose: PurposeSchema,
  safetyState: z.enum(['normal', 'pastoral_support']),
  /** Compassionate, concise, and explicitly non-diagnostic. */
  acknowledgement: z.string().min(1).max(400),
  /** One short sentence naming the theme the user stated — not a verdict. */
  theme: z.string().min(1).max(160),
  primaryPassage: ScripturePassageSchema,
  /** Framed as an invitation ("may", "might"), never as certainty. */
  whyThisPassage: z.string().min(1),
  reflection: z
    .string()
    .refine((v) => countWords(v) >= REFLECTION_MIN_WORDS, {
      message: `Reflection must be at least ${REFLECTION_MIN_WORDS} words`,
    })
    .refine((v) => countWords(v) <= REFLECTION_MAX_WORDS, {
      message: `Reflection must be at most ${REFLECTION_MAX_WORDS} words`,
    }),
  supportingSources: z.array(SupportingSourceSchema).max(MAX_SUPPORTING_SOURCES),
  prayerPrompt: z.string().min(1),
  nextStep: z.string().min(1).nullable(),
  memoryInsight: MemoryInsightSchema.nullable(),
  citations: z.array(CitationSchema).min(1),
  meta: GenerationMetaSchema,
  createdAt: z.string().min(1),
});
export type CompanionDevotional = z.infer<typeof CompanionDevotionalSchema>;

export const SupportResourceSchema = z.object({
  label: z.string().min(1),
  detail: z.string().min(1),
  region: z.string().min(1),
});
export type SupportResource = z.infer<typeof SupportResourceSchema>;

/**
 * Returned instead of devotional content when the safety classifier flags
 * immediate danger. It offers presence and local emergency guidance. It does
 * not diagnose, counsel, or continue an ordinary devotional flow.
 */
export const CompanionSupportSchema = z.object({
  kind: z.literal('support'),
  id: z.string().min(1),
  entryId: z.string().min(1),
  safetyState: z.literal('urgent_support'),
  acknowledgement: z.string().min(1),
  message: z.string().min(1),
  resources: z.array(SupportResourceSchema).min(1),
  /** Optional and short: presence, not instruction. */
  passage: ScripturePassageSchema.nullable(),
  disclaimer: z.string().min(1),
  meta: GenerationMetaSchema,
  createdAt: z.string().min(1),
});
export type CompanionSupport = z.infer<typeof CompanionSupportSchema>;

export const CompanionResultSchema = z.discriminatedUnion('kind', [
  CompanionDevotionalSchema,
  CompanionSupportSchema,
]);
export type CompanionResult = z.infer<typeof CompanionResultSchema>;

export type ContractIssue = { path: string; message: string };

export type ContractValidation =
  { ok: true; value: CompanionResult } | { ok: false; issues: ContractIssue[] };

/**
 * Validates a candidate response against the contract *and* against the set of
 * source records the retrieval step actually supplied. The second half is the
 * point: it is what stops a generated response from citing a passage or work
 * that was never retrieved.
 */
export function validateCompanionResult(
  candidate: unknown,
  knownSourceIds: ReadonlySet<string>,
): ContractValidation {
  const parsed = CompanionResultSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    };
  }

  const value = parsed.data;
  const issues: ContractIssue[] = [];

  if (value.kind === 'support') {
    if (value.passage && !knownSourceIds.has(value.passage.sourceId)) {
      issues.push({
        path: 'passage.sourceId',
        message: `Passage ${value.passage.sourceId} was not in the retrieved source set`,
      });
    }
    return issues.length === 0 ? { ok: true, value } : { ok: false, issues };
  }

  if (!knownSourceIds.has(value.primaryPassage.sourceId)) {
    issues.push({
      path: 'primaryPassage.sourceId',
      message: `Passage ${value.primaryPassage.sourceId} was not in the retrieved source set`,
    });
  }

  value.supportingSources.forEach((source, index) => {
    if (!knownSourceIds.has(source.sourceId)) {
      issues.push({
        path: `supportingSources.${index}.sourceId`,
        message: `Source ${source.sourceId} was not in the retrieved source set`,
      });
    }
  });

  value.citations.forEach((citation, index) => {
    if (!knownSourceIds.has(citation.sourceId)) {
      issues.push({
        path: `citations.${index}.sourceId`,
        message: `Citation ${citation.sourceId} does not resolve to a source record`,
      });
    }
  });

  const primaryCited = value.citations.some(
    (c) => c.supports === 'primary_passage' && c.sourceId === value.primaryPassage.sourceId,
  );
  if (!primaryCited) {
    issues.push({
      path: 'citations',
      message: 'The primary passage must carry its own citation',
    });
  }

  value.supportingSources.forEach((source, index) => {
    const cited = value.citations.some((c) => c.sourceId === source.sourceId);
    if (!cited) {
      issues.push({
        path: `supportingSources.${index}`,
        message: `Supporting source ${source.sourceId} is displayed without a citation`,
      });
    }
  });

  // Guardrail: the rationale is an invitation, never a claim about God's
  // private will for this person.
  const authorityClaims = [
    /\bgod is telling you\b/i,
    /\bgod wants you to\b/i,
    /\bgod's plan for you is\b/i,
    /\bthe lord is telling you\b/i,
    /\byou are being called to\b/i,
  ];
  for (const pattern of authorityClaims) {
    if (pattern.test(value.whyThisPassage) || pattern.test(value.reflection)) {
      issues.push({
        path: 'whyThisPassage',
        message: 'Response asserts personal divine instruction, which the guardrails forbid',
      });
      break;
    }
  }

  return issues.length === 0 ? { ok: true, value } : { ok: false, issues };
}

export function formatReference(reference: ScriptureReference): string {
  const { book, chapter, verseStart, verseEnd } = reference;
  if (verseEnd && verseEnd !== verseStart) {
    return `${book} ${chapter}:${verseStart}-${verseEnd}`;
  }
  return `${book} ${chapter}:${verseStart}`;
}

/**
 * Parses a URL-safe reference slug such as `matthew-11-28` or
 * `philippians-4-6-7` back into a reference. Returns null rather than throwing
 * so routes can render a not-found state.
 */
export function parseReferenceSlug(slug: string): ScriptureReference | null {
  const match = /^([a-z0-9]+(?:-[a-z]+)*?)-(\d+)-(\d+)(?:-(\d+))?$/i.exec(slug.trim());
  if (!match) return null;
  const [, bookSlug, chapter, verseStart, verseEnd] = match;
  if (!bookSlug || !chapter || !verseStart) return null;
  const book = bookSlug
    .split('-')
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
  return {
    book,
    chapter: Number(chapter),
    verseStart: Number(verseStart),
    verseEnd: verseEnd ? Number(verseEnd) : null,
  };
}

export function toReferenceSlug(reference: ScriptureReference): string {
  const book = reference.book.toLowerCase().replace(/\s+/g, '-');
  const tail =
    reference.verseEnd && reference.verseEnd !== reference.verseStart
      ? `-${reference.verseEnd}`
      : '';
  return `${book}-${reference.chapter}-${reference.verseStart}${tail}`;
}
