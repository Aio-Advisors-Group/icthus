import type {
  CaptureKind,
  CaptureMode,
  CompanionResult,
  DailyCompanionRun,
  DailyCompanionSettings,
  DeliveryEvent,
  DeliveryRoute,
  MemoryPreferences,
  Purpose,
} from '@icthus/core';

export type Entry = {
  id: string;
  kind: CaptureKind;
  mode: CaptureMode;
  purpose: Purpose;
  body: string;
  occurredAt: string;
  createdAt: string;
  /** Where the text came from, for provenance rather than analytics. */
  sourceKind: 'typed' | 'voice' | 'imported_note';
  importedFrom: string | null;
  /** Set by the user to keep a single entry out of Memory aggregation. */
  excludedFromMemory: boolean;
};

export type EntryRecord = {
  entry: Entry;
  response: CompanionResult | null;
};

export type SavedItemKind = 'scripture' | 'prayer' | 'reflection';

export type SavedItem = {
  id: string;
  kind: SavedItemKind;
  title: string;
  body: string;
  reference: string | null;
  attribution: string | null;
  sourceId: string | null;
  entryId: string | null;
  createdAt: string;
};

/** A draft held before sign-in. Never uploaded until the person confirms. */
export type Draft = {
  id: string;
  body: string;
  mode: CaptureMode;
  purpose: Purpose;
  updatedAt: string;
};

export type ConsentRecord = {
  id: string;
  type:
    | 'privacy_onboarding'
    | 'memory'
    | 'audio_retention'
    | 'notifications'
    | 'gloo_processing'
    | 'route'
    | 'raw_journal_route';
  policyVersion: string;
  grantedAt: string;
  revokedAt: string | null;
};

export type ExportBundle = {
  exportedAt: string;
  appVersion: string;
  entries: EntryRecord[];
  savedItems: SavedItem[];
  memoryPreferences: MemoryPreferences;
  routes: DeliveryRoute[];
  deliveryEvents: DeliveryEvent[];
  companionSettings: DailyCompanionSettings;
  companionRuns: DailyCompanionRun[];
  consents: ConsentRecord[];
};

export type Profile = {
  id: string;
  email: string | null;
  displayName: string | null;
  translationId: string;
  timeZone: string;
  onboardedAt: string | null;
};

export interface IcthusRepository {
  readonly mode: 'local' | 'supabase';

  listEntries(): Promise<EntryRecord[]>;
  getEntry(id: string): Promise<EntryRecord | null>;
  createEntry(entry: Entry, response: CompanionResult | null): Promise<EntryRecord>;
  updateEntry(id: string, patch: Partial<Entry>): Promise<void>;
  deleteEntry(id: string): Promise<void>;

  listSavedItems(): Promise<SavedItem[]>;
  addSavedItem(item: SavedItem): Promise<void>;
  removeSavedItem(id: string): Promise<void>;

  getMemoryPreferences(): Promise<MemoryPreferences>;
  setMemoryPreferences(preferences: MemoryPreferences): Promise<void>;

  listRoutes(): Promise<DeliveryRoute[]>;
  upsertRoute(route: DeliveryRoute): Promise<void>;
  deleteRoute(id: string): Promise<void>;

  listDeliveryEvents(): Promise<DeliveryEvent[]>;
  appendDeliveryEvent(event: DeliveryEvent): Promise<void>;

  getCompanionSettings(): Promise<DailyCompanionSettings>;
  setCompanionSettings(settings: DailyCompanionSettings): Promise<void>;
  listCompanionRuns(): Promise<DailyCompanionRun[]>;
  appendCompanionRun(run: DailyCompanionRun): Promise<void>;

  listConsents(): Promise<ConsentRecord[]>;
  recordConsent(consent: ConsentRecord): Promise<void>;
  revokeConsent(type: ConsentRecord['type']): Promise<void>;

  getProfile(): Promise<Profile | null>;
  setProfile(profile: Profile): Promise<void>;

  exportAll(): Promise<ExportBundle>;
  /** Removes every user-owned record. Used by account deletion. */
  purgeAll(): Promise<void>;
}
