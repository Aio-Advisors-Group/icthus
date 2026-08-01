import type { ProviderState, ScripturePassage } from '../contracts';
import {
  SCRIPTURE_CORPUS,
  findPassageByReferenceSlug,
  findPassageBySourceId,
  rankPassages,
  type CorpusPassage,
} from '../corpus';

/**
 * The Scripture boundary.
 *
 * The rest of the app only ever talks to this interface. Swapping the local
 * public-domain corpus for the YouVersion Platform API is a constructor
 * change, not a refactor — and either way the passage carries its own
 * `providerState` so the UI can tell the truth about where it came from.
 */
export interface ScriptureProvider {
  readonly id: string;
  readonly state: ProviderState;
  /** Best passages for a set of extracted themes, strongest first. */
  search(themes: readonly string[], limit?: number): Promise<ScripturePassage[]>;
  getBySourceId(sourceId: string): Promise<ScripturePassage | null>;
  /** Resolves a URL slug such as `matthew-11-28`. */
  getByReferenceSlug(slug: string): Promise<ScripturePassage | null>;
  /** A stable passage for a given calendar day, for scheduled runs. */
  passageOfTheDay(date: Date): Promise<ScripturePassage>;
}

function toPassage(entry: CorpusPassage, provider: string, state: ProviderState): ScripturePassage {
  return {
    sourceId: entry.sourceId,
    reference: entry.reference,
    canonical: entry.canonical,
    text: entry.text,
    context: entry.context,
    translation: entry.translation,
    attribution: entry.attribution,
    provider,
    providerState: state,
    canonicalUrl: entry.canonicalUrl,
  };
}

/**
 * Deterministic local provider backed by the public-domain corpus.
 *
 * This is a real, shippable fallback rather than a stub: it is what the app
 * uses offline, and what it degrades to when YouVersion is unreachable.
 */
export class LocalScriptureProvider implements ScriptureProvider {
  readonly id = 'local-web-corpus';
  readonly state: ProviderState = 'mock';

  async search(themes: readonly string[], limit = 3): Promise<ScripturePassage[]> {
    const ranked = rankPassages(themes);
    const chosen = ranked.length > 0 ? ranked : SCRIPTURE_CORPUS.slice(0, limit);
    return chosen.slice(0, limit).map((entry) => toPassage(entry, this.id, this.state));
  }

  async getBySourceId(sourceId: string): Promise<ScripturePassage | null> {
    const entry = findPassageBySourceId(sourceId);
    return entry ? toPassage(entry, this.id, this.state) : null;
  }

  async getByReferenceSlug(slug: string): Promise<ScripturePassage | null> {
    const entry = findPassageByReferenceSlug(slug);
    return entry ? toPassage(entry, this.id, this.state) : null;
  }

  async passageOfTheDay(date: Date): Promise<ScripturePassage> {
    // Day-of-epoch indexing keeps the passage stable for a whole calendar day
    // and identical across devices in the same timezone.
    const dayIndex = Math.floor(date.getTime() / 86_400_000);
    const entry = SCRIPTURE_CORPUS[dayIndex % SCRIPTURE_CORPUS.length] ?? SCRIPTURE_CORPUS[0];
    if (!entry) throw new Error('Scripture corpus is empty');
    return toPassage(entry, this.id, this.state);
  }
}

export type YouVersionConfig = {
  /** Injected server-side only. The browser never holds this. */
  apiBaseUrl: string;
  /** App Key sent as X-YVP-App-Key, supplied by the YouVersion Platform. */
  appKey: string;
  /** Translation the user selected, e.g. a YouVersion version id. */
  versionId: string;
  fetchImpl?: typeof fetch;
};

type YouVersionBible = {
  id: number;
  abbreviation?: string;
  title?: string;
  copyright?: string;
  youversion_deep_link?: string;
};

type YouVersionPassage = { id?: string; content?: string; reference?: string };

const USFM_BOOK_IDS: Record<string, string> = {
  Matthew: 'MAT',
  Psalm: 'PSA',
  Philippians: 'PHP',
  Lamentations: 'LAM',
  Isaiah: 'ISA',
  '1 Thessalonians': '1TH',
  James: 'JAS',
  '1 Corinthians': '1CO',
  Proverbs: 'PRO',
  John: 'JHN',
  Ecclesiastes: 'ECC',
};

function usfmPassage(entry: CorpusPassage): string {
  const book = USFM_BOOK_IDS[entry.canonical.book];
  if (!book) throw new Error(`No USFM book mapping for ${entry.canonical.book}`);
  const first = `${book}.${entry.canonical.chapter}.${entry.canonical.verseStart}`;
  return entry.canonical.verseEnd
    ? `${first}-${book}.${entry.canonical.chapter}.${entry.canonical.verseEnd}`
    : first;
}

/**
 * YouVersion Platform adapter.
 *
 * Uses YouVersion's documented REST API: X-YVP-App-Key authentication,
 * /v1/bibles/{id} for translation metadata, and
 * /v1/bibles/{id}/passages/{USFM passage} for runtime text. Licensed text is
 * never committed to the repository or persisted by this adapter.
 */
export class YouVersionScriptureProvider implements ScriptureProvider {
  readonly id = 'youversion';
  readonly state: ProviderState = 'live';
  private bible: YouVersionBible | null = null;

  constructor(private readonly config: YouVersionConfig) {}

  private fetch(): typeof fetch {
    if (this.config.fetchImpl) return this.config.fetchImpl;
    if (typeof fetch !== 'undefined') return fetch;
    throw new Error('No fetch implementation is available for YouVersion');
  }

  private async request<T>(path: string): Promise<T> {
    const response = await this.fetch()(`${this.config.apiBaseUrl.replace(/\/$/, '')}${path}`, {
      headers: { 'X-YVP-App-Key': this.config.appKey },
    });
    if (!response.ok) throw new Error(`YouVersion request failed (${response.status})`);
    return (await response.json()) as T;
  }

  private async bibleMetadata(): Promise<YouVersionBible> {
    if (this.bible) return this.bible;
    this.bible = await this.request<YouVersionBible>(
      `/v1/bibles/${encodeURIComponent(this.config.versionId)}`,
    );
    return this.bible;
  }

  private async hydrate(entry: CorpusPassage): Promise<ScripturePassage> {
    const [metadata, remote] = await Promise.all([
      this.bibleMetadata(),
      this.request<YouVersionPassage>(
        `/v1/bibles/${encodeURIComponent(this.config.versionId)}/passages/${encodeURIComponent(usfmPassage(entry))}?format=text&include_headings=false&include_notes=false`,
      ),
    ]);
    if (typeof remote.content !== 'string' || remote.content.trim().length === 0) {
      throw new Error('YouVersion passage response did not include text');
    }
    const title = metadata.title ?? `YouVersion Bible ${this.config.versionId}`;
    const abbreviation = metadata.abbreviation ?? String(this.config.versionId);
    return {
      ...toPassage(entry, this.id, this.state),
      reference: remote.reference ?? entry.reference,
      text: remote.content.trim(),
      translation: {
        id: String(metadata.id ?? this.config.versionId),
        name: title,
        abbreviation,
        rights: metadata.copyright ?? 'Licensed through YouVersion Platform.',
      },
      attribution: metadata.copyright ? `${title} · ${metadata.copyright}` : title,
      canonicalUrl: metadata.youversion_deep_link ?? null,
    };
  }

  async search(themes: readonly string[], limit = 3): Promise<ScripturePassage[]> {
    const ranked = rankPassages(themes);
    const selected = (ranked.length > 0 ? ranked : SCRIPTURE_CORPUS).slice(0, limit);
    return Promise.all(selected.map((entry) => this.hydrate(entry)));
  }

  async getBySourceId(sourceId: string): Promise<ScripturePassage | null> {
    const entry = findPassageBySourceId(sourceId);
    return entry ? this.hydrate(entry) : null;
  }

  async getByReferenceSlug(slug: string): Promise<ScripturePassage | null> {
    const entry = findPassageByReferenceSlug(slug);
    return entry ? this.hydrate(entry) : null;
  }

  async passageOfTheDay(date: Date): Promise<ScripturePassage> {
    const dayIndex = Math.floor(date.getTime() / 86_400_000);
    const entry = SCRIPTURE_CORPUS[dayIndex % SCRIPTURE_CORPUS.length] ?? SCRIPTURE_CORPUS[0];
    if (!entry) throw new Error('Scripture corpus is empty');
    return this.hydrate(entry);
  }

  describe(): string {
    return `YouVersion Bible version ${this.config.versionId}`;
  }
}

/**
 * Wraps a primary provider and falls back to the local corpus on failure, so a
 * provider outage degrades the passage source instead of destroying the
 * person's capture.
 */
export class FallbackScriptureProvider implements ScriptureProvider {
  readonly id: string;
  readonly state: ProviderState;
  private readonly fallback = new LocalScriptureProvider();

  constructor(private readonly primary: ScriptureProvider) {
    this.id = `${primary.id}+local`;
    this.state = primary.state;
  }

  private async attempt<T>(run: () => Promise<T>, recover: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch {
      return recover();
    }
  }

  search(themes: readonly string[], limit = 3): Promise<ScripturePassage[]> {
    return this.attempt(
      () => this.primary.search(themes, limit),
      () => this.fallback.search(themes, limit),
    );
  }

  getBySourceId(sourceId: string): Promise<ScripturePassage | null> {
    return this.attempt(
      () => this.primary.getBySourceId(sourceId),
      () => this.fallback.getBySourceId(sourceId),
    );
  }

  getByReferenceSlug(slug: string): Promise<ScripturePassage | null> {
    return this.attempt(
      () => this.primary.getByReferenceSlug(slug),
      () => this.fallback.getByReferenceSlug(slug),
    );
  }

  passageOfTheDay(date: Date): Promise<ScripturePassage> {
    return this.attempt(
      () => this.primary.passageOfTheDay(date),
      () => this.fallback.passageOfTheDay(date),
    );
  }
}
