import type { ProviderState } from '../contracts';

/**
 * Voice transcription boundary.
 *
 * The MVP ships the honest version: recording works locally, playback works,
 * and the transcript is yours to write or paste. When a transcription key
 * exists, the same interface returns a machine transcript into the same
 * editable field — the review step never goes away.
 */

export type TranscriptionRequest = {
  assetId: string;
  mimeType: string;
  durationSeconds: number;
};

export type TranscriptionResult = {
  status: 'ready' | 'manual_required' | 'failed';
  transcript: string;
  providerState: ProviderState;
  /** True when the text still needs a human before it becomes an entry. */
  requiresReview: boolean;
  errorCode: string | null;
};

export interface TranscriptionProvider {
  readonly id: string;
  readonly state: ProviderState;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

/**
 * No transcription provider configured.
 *
 * Returns `manual_required` rather than a fabricated transcript, so the UI can
 * ask the person to type what they said instead of showing invented words.
 */
export class ManualTranscriptionProvider implements TranscriptionProvider {
  readonly id = 'manual';
  readonly state: ProviderState = 'mock';

  async transcribe(): Promise<TranscriptionResult> {
    return {
      status: 'manual_required',
      transcript: '',
      providerState: 'mock',
      requiresReview: true,
      errorCode: null,
    };
  }
}

export type HostedTranscriptionConfig = {
  endpoint: string;
  /** Supplied by an Edge Function; never present in the browser bundle. */
  authorizationHeader?: string;
  fetchImpl?: typeof fetch;
};

/**
 * Server-side transcription adapter. Left unimplemented against a specific
 * vendor until one is chosen — see docs/PROVIDER_SETUP.md.
 */
export class HostedTranscriptionProvider implements TranscriptionProvider {
  readonly id = 'hosted';
  readonly state: ProviderState = 'unavailable';

  constructor(private readonly config: HostedTranscriptionConfig) {}

  async transcribe(): Promise<TranscriptionResult> {
    return {
      status: 'failed',
      transcript: '',
      providerState: 'unavailable',
      requiresReview: true,
      errorCode: 'transcription_not_configured',
    };
  }

  describe(): string {
    return `Hosted transcription at ${this.config.endpoint}`;
  }
}

export const AUDIO_RETENTION_POLICIES = ['delete_after_transcript', 'keep_until_deleted'] as const;
export type AudioRetentionPolicy = (typeof AUDIO_RETENTION_POLICIES)[number];

export const AUDIO_RETENTION_LABELS: Record<AudioRetentionPolicy, string> = {
  delete_after_transcript: 'Delete the recording once I have the transcript',
  keep_until_deleted: 'Keep the recording until I delete it',
};

/** The privacy-preserving option is the default. */
export const DEFAULT_AUDIO_RETENTION: AudioRetentionPolicy = 'delete_after_transcript';
