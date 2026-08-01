/**
 * Feature flags.
 *
 * Every external provider is behind one. A flag that is off means the adapter
 * reports `mock` or `unavailable`, and the UI says so — it never means the UI
 * quietly pretends.
 */

export type FeatureFlags = {
  /** Real YouVersion Platform API instead of the local public-domain corpus. */
  youversion: boolean;
  /** Real Gloo AI Studio API instead of the deterministic local adapter. */
  gloo: boolean;
  /** Server-side LLM companion generation instead of the deterministic adapter. */
  companionLlm: boolean;
  /** Real speech-to-text instead of the manual transcript editor. */
  transcription: boolean;
  /** Image capture and OCR. Off for the contest MVP. */
  ocr: boolean;
  /** Slack/Discord/Notion server-side delivery. */
  connectedDelivery: boolean;
  /** Supabase-backed persistence. Off falls back to local-only mode. */
  supabase: boolean;
};

export const DEFAULT_FLAGS: FeatureFlags = {
  youversion: false,
  gloo: false,
  companionLlm: false,
  transcription: false,
  ocr: false,
  connectedDelivery: false,
  supabase: false,
};

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

function readFlag(source: Record<string, string | undefined>, key: string): boolean {
  const raw = source[key];
  return raw !== undefined && TRUTHY.has(raw.trim().toLowerCase());
}

/**
 * Resolves flags from an environment-shaped record. Anything not explicitly
 * enabled stays off — a missing variable never turns a provider on.
 */
export function resolveFlags(env: Record<string, string | undefined>): FeatureFlags {
  return {
    youversion: readFlag(env, 'VITE_FEATURE_YOUVERSION'),
    gloo: readFlag(env, 'VITE_FEATURE_GLOO'),
    companionLlm: readFlag(env, 'VITE_FEATURE_COMPANION_LLM'),
    transcription: readFlag(env, 'VITE_FEATURE_TRANSCRIPTION'),
    ocr: readFlag(env, 'VITE_FEATURE_OCR'),
    connectedDelivery: readFlag(env, 'VITE_FEATURE_CONNECTED_DELIVERY'),
    supabase:
      typeof env.VITE_SUPABASE_URL === 'string' &&
      env.VITE_SUPABASE_URL.length > 0 &&
      typeof env.VITE_SUPABASE_ANON_KEY === 'string' &&
      env.VITE_SUPABASE_ANON_KEY.length > 0,
  };
}

export type IntegrationHealth = {
  id: string;
  label: string;
  /** What the adapter is actually doing right now. */
  state: 'live' | 'mock' | 'unavailable' | 'disabled';
  detail: string;
  /** What a human has to go do to move this to `live`. */
  blockedBy: string | null;
  docsUrl: string | null;
};

export function describeIntegrations(flags: FeatureFlags): IntegrationHealth[] {
  return [
    {
      id: 'youversion',
      label: 'YouVersion Platform',
      state: flags.youversion ? 'live' : 'mock',
      detail: flags.youversion
        ? 'Passages come from the YouVersion Platform API with its approved translations.'
        : 'Passages come from the built-in World English Bible corpus, which is public domain.',
      blockedBy: flags.youversion
        ? null
        : 'A registered YouVersion Platform app, approved content scopes, and an API key.',
      docsUrl: 'https://platform.youversion.com/platform/get-started',
    },
    {
      id: 'gloo',
      label: 'Gloo AI Studio',
      state: flags.gloo ? 'live' : 'mock',
      detail: flags.gloo
        ? 'The Daily Devotional Companion sends its bounded question to Gloo AI Studio.'
        : 'The Daily Devotional Companion runs against a local adapter. No request leaves this device.',
      blockedBy: flags.gloo
        ? null
        : 'Gloo AI Studio OAuth 2.0 client credentials and an approved capability scope.',
      docsUrl: 'https://studio.ai.gloo.com/',
    },
    {
      id: 'companion',
      label: 'Companion generation',
      state: flags.companionLlm ? 'live' : 'mock',
      detail: flags.companionLlm
        ? 'Responses are generated server-side and validated against retrieved sources.'
        : 'Responses are composed deterministically from the local corpus. Same input, same output.',
      blockedBy: flags.companionLlm
        ? null
        : 'A server-side model key in Supabase Edge Function secrets.',
      docsUrl: null,
    },
    {
      id: 'transcription',
      label: 'Voice transcription',
      state: flags.transcription ? 'live' : 'mock',
      detail: flags.transcription
        ? 'Recordings are transcribed server-side and returned for your review.'
        : 'Recording works and stays on this device. You type or paste the transcript yourself.',
      blockedBy: flags.transcription ? null : 'A transcription provider key.',
      docsUrl: null,
    },
    {
      id: 'connected_delivery',
      label: 'Slack, Discord & Notion delivery',
      state: flags.connectedDelivery ? 'live' : 'mock',
      detail: flags.connectedDelivery
        ? 'Connected routes deliver through the server-side queue.'
        : 'Connected routes can be configured and tested, but nothing is actually sent.',
      blockedBy: flags.connectedDelivery
        ? null
        : 'OAuth apps and tokens for each provider, stored as Edge Function secrets.',
      docsUrl: null,
    },
    {
      id: 'ocr',
      label: 'Photo & OCR capture',
      state: flags.ocr ? 'live' : 'disabled',
      detail: flags.ocr
        ? 'You can photograph written material and edit the extracted text.'
        : 'Turned off for this release. Write, Speak, and Note cover the core flow.',
      blockedBy: flags.ocr ? null : 'An OCR provider key, plus the image retention policy review.',
      docsUrl: null,
    },
    {
      id: 'supabase',
      label: 'Supabase backend',
      state: flags.supabase ? 'live' : 'unavailable',
      detail: flags.supabase
        ? 'Sign-in, private entries, and saved items persist to your Supabase project.'
        : 'Running local-only. Entries stay in this browser and are never uploaded.',
      blockedBy: flags.supabase ? null : 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      docsUrl: null,
    },
  ];
}
