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
  appId: string;
  /** Translation the user selected, e.g. a YouVersion version id. */
  versionId: string;
  fetchImpl?: typeof fetch;
};

/**
 * YouVersion Platform adapter.
 *
 * Intentionally unimplemented against a guessed endpoint. Writing a plausible
 * request shape here would produce code that looks integrated and fails in
 * production — worse than an honest gap. The contract tests in
 * `scripture.contract.test.ts` run against whichever provider is configured,
 * so this class only needs its real endpoints filled in once the YouVersion
 * app is approved. See docs/PROVIDER_SETUP.md.
 */
export class YouVersionScriptureProvider implements ScriptureProvider {
  readonly id = 'youversion';
  readonly state: ProviderState = 'unavailable';

  constructor(private readonly config: YouVersionConfig) {}

  private notConfigured(): never {
    throw new Error(
      'YouVersion Platform adapter is not configured. Register the app at ' +
        'https://platform.youversion.com/platform/get-started, then supply the ' +
        'documented endpoints and credentials via Edge Function secrets.',
    );
  }

  async search(): Promise<ScripturePassage[]> {
    return this.notConfigured();
  }

  async getBySourceId(): Promise<ScripturePassage | null> {
    return this.notConfigured();
  }

  async getByReferenceSlug(): Promise<ScripturePassage | null> {
    return this.notConfigured();
  }

  async passageOfTheDay(): Promise<ScripturePassage> {
    return this.notConfigured();
  }

  describe(): string {
    return `YouVersion app ${this.config.appId} · version ${this.config.versionId}`;
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
