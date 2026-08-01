import type { ProviderState } from '../contracts';

/**
 * The Gloo AI Studio boundary.
 *
 * Two rules shape this interface. First, a request is always bounded: it
 * carries a passage, a short input *summary*, and one question — never a
 * person's journal history. Second, the response always reports which provider
 * actually answered, so a mocked run cannot render as a delivered one.
 */

export type GlooRequest = {
  /** Exact reference, so the answer stays anchored to retrieved Scripture. */
  passageReference: string;
  passageText: string;
  translationAbbreviation: string;
  /**
   * A short, derived summary of the consented inputs. Deliberately not the
   * raw entry text — see docs/source-policy.md.
   */
  inputSummary: string;
  themes: readonly string[];
  /** The single bounded question. Composed by Icthus, not by the model. */
  question: string;
};

export type GlooCitation = {
  label: string;
  url: string | null;
};

export type GlooResponse = {
  answer: string;
  citations: readonly GlooCitation[];
  providerState: ProviderState;
  /** Model/deployment identifier when the provider reports one. */
  modelVersion: string | null;
  receivedAt: string;
  /** Populated only when providerState is `unavailable`. */
  errorCode: string | null;
};

export type ConnectionCard = {
  title: string;
  body: string;
  actionLabel: string;
  /** Null when Icthus has no approved directory to link to. */
  actionUrl: string | null;
  providerState: ProviderState;
};

export interface FaithConnectionProvider {
  readonly id: string;
  readonly state: ProviderState;
  ask(request: GlooRequest, now?: Date): Promise<GlooResponse>;
  /** The optional "next connection" surface. Degrades to neutral guidance. */
  connectionCard(): Promise<ConnectionCard>;
}

const MOCK_ANSWER_BY_THEME: Record<string, string> = {
  weariness:
    'Historic Christian teaching distinguishes rest from idleness. Rest is treated as something received rather than earned, which is why the invitation in this passage precedes any instruction. Augustine frames restlessness as a sign pointing somewhere rather than a fault to correct. A practical reading: before adding a discipline, subtract an obligation that was never asked of you.',
  anxiety:
    'The tradition consistently separates prudent concern from anxious grasping. The test offered by several writers is directional: does this preoccupation move you toward trust and action, or toward rehearsal and paralysis? The instruction in this passage is not to feel less, but to name the specific thing in prayer — specificity is the practice, not composure.',
  work: 'Christian teaching treats work as genuinely good and disordered only when it becomes the place you look for security. The question is not ambition versus family but what you are seeking first. A useful discernment test found across the tradition: does this pursuit leave you more at peace or more restless? Bring the specific decision to prayer by name.',
  grief:
    'The tradition does not rush grief. Christ weeps at a grave he is about to open, which the Fathers read as a refusal to treat sorrow as a failure of faith. Julian of Norwich holds hope and unresolved pain together without collapsing either. Presence is offered as the response, and explanation is not required of you.',
  discernment:
    'Classic discernment asks after the fruit of a direction rather than the strength of the feeling behind it. Peace that deepens as you move toward something is treated as a better signal than certainty that arrives all at once. Wisdom here is described as sufficient for the next step, not for the whole path.',
  forgiveness:
    'The tradition distinguishes forgiveness from reconciliation and from restored trust. The first is a direction of the heart you can begin without the other person; the others require them, and sometimes should not be attempted. Naming that difference is often what unlocks a situation that has felt stuck.',
  loneliness:
    'Christian writers treat solitude and isolation as different things — one chosen and fruitful, the other corrosive. The practical counsel is consistently unglamorous: re-entry into company usually happens through one specific, slightly awkward contact rather than through a restored feeling.',
  gratitude:
    'Thanksgiving in this tradition is a practice rather than a mood, which is why it is commanded to people under pressure. Brother Lawrence ties it to small things done attentively. Gratitude that leaves room for the hard parts is the kind that survives a difficult week.',
};

const DEFAULT_MOCK_ANSWER =
  'The tradition would begin where you began: with what is actually happening, brought honestly into prayer. Scripture is treated as the authoritative word on it, and reflection as a way of listening rather than concluding. The next faithful step is usually smaller and more concrete than we expect.';

/**
 * Deterministic local adapter.
 *
 * It reports `providerState: 'mock'` on every response, which the transcript
 * renders verbatim. Nothing leaves the device.
 */
export class MockGlooProvider implements FaithConnectionProvider {
  readonly id = 'gloo-mock';
  readonly state: ProviderState = 'mock';

  async ask(request: GlooRequest, now: Date = new Date()): Promise<GlooResponse> {
    const matched = request.themes.map((t) => MOCK_ANSWER_BY_THEME[t]).find(Boolean);
    return {
      answer: matched ?? DEFAULT_MOCK_ANSWER,
      citations: [
        {
          label: `${request.passageReference} (${request.translationAbbreviation})`,
          url: null,
        },
      ],
      providerState: 'mock',
      modelVersion: null,
      receivedAt: now.toISOString(),
      errorCode: null,
    };
  }

  async connectionCard(): Promise<ConnectionCard> {
    return {
      title: 'Find support in a local church community',
      body: 'Icthus does not recommend specific churches. When you are ready, a local congregation is a good place to bring what you have been reflecting on.',
      actionLabel: 'Read how Icthus thinks about this',
      actionUrl: null,
      providerState: 'mock',
    };
  }
}

export type GlooConfig = {
  /** OAuth 2.0 client credentials flow. Server-side only, never in a bundle. */
  tokenUrl: string;
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: readonly string[];
  /** Optional Gloo Completions V2 tradition parameter. */
  tradition?: 'evangelical' | 'catholic' | 'mainline';
  fetchImpl?: typeof fetch;
};

/**
 * Gloo AI Studio adapter.
 *
 * This adapter follows Gloo's documented Completions V2 OAuth contract. It is
 * deliberately server-only: client credentials must never be put in a Vite
 * environment variable or instantiated in the browser.
 */
export class GlooStudioProvider implements FaithConnectionProvider {
  readonly id = 'gloo';
  readonly state: ProviderState = 'live';
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: GlooConfig) {}

  private fetch(): typeof fetch {
    if (this.config.fetchImpl) return this.config.fetchImpl;
    if (typeof fetch !== 'undefined') return fetch;
    throw new Error('No fetch implementation is available for Gloo');
  }

  private async accessToken(now: Date): Promise<string> {
    if (this.token && this.token.expiresAt > now.getTime() + 60_000) return this.token.value;

    const credentials = btoa(`${this.config.clientId}:${this.config.clientSecret}`);
    const response = await this.fetch()(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: this.config.scopes.join(' ') || 'api/access',
      }),
    });
    if (!response.ok) throw new Error(`Gloo token request failed (${response.status})`);
    const payload = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
      throw new Error('Gloo token response did not include an access token');
    }
    const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
    this.token = { value: payload.access_token, expiresAt: now.getTime() + expiresIn * 1000 };
    return this.token.value;
  }

  async ask(request: GlooRequest, now: Date = new Date()): Promise<GlooResponse> {
    try {
      const token = await this.accessToken(now);
      const response = await this.fetch()(
        `${this.config.apiBaseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content:
                  'You are a humble Christian study companion. Stay grounded in the supplied passage. Do not claim divine instruction, diagnose, provide crisis advice, or invent sources. Give a concise, invitation-framed response.',
              },
              { role: 'user', content: request.question },
            ],
            auto_routing: true,
            ...(this.config.tradition ? { tradition: this.config.tradition } : {}),
            stream: false,
          }),
        },
      );
      if (!response.ok) throw new Error(`Gloo completion request failed (${response.status})`);
      const payload = (await response.json()) as {
        model?: unknown;
        choices?: { message?: { content?: unknown } }[];
      };
      const answer = payload.choices?.[0]?.message?.content;
      if (typeof answer !== 'string' || answer.trim().length === 0) {
        throw new Error('Gloo completion response did not include content');
      }
      return {
        answer: answer.trim(),
        citations: [
          { label: `${request.passageReference} (${request.translationAbbreviation})`, url: null },
        ],
        providerState: 'live',
        modelVersion: typeof payload.model === 'string' ? payload.model : null,
        receivedAt: now.toISOString(),
        errorCode: null,
      };
    } catch {
      return {
        answer: '',
        citations: [],
        providerState: 'unavailable',
        modelVersion: null,
        receivedAt: now.toISOString(),
        errorCode: 'gloo_request_failed',
      };
    }
  }

  async connectionCard(): Promise<ConnectionCard> {
    return {
      title: 'Find support in a local church community',
      body: 'Icthus does not recommend specific churches. When you are ready, a local congregation is a good place to bring what you have been reflecting on.',
      actionLabel: 'Read how Icthus thinks about this',
      actionUrl: null,
      providerState: 'live',
    };
  }

  describe(): string {
    return `Gloo client ${this.config.clientId} · scopes ${this.config.scopes.join(', ')}`;
  }
}
