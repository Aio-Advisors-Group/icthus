import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  DEFAULT_COMPANION_SETTINGS,
  DEFAULT_MEMORY_PREFERENCES,
  resolveTimeZone,
  type CompanionResult,
  type DailyCompanionRun,
  type DailyCompanionSettings,
  type DeliveryEvent,
  type DeliveryRoute,
  type MemoryPreferences,
} from '@icthus/core';
import type {
  ConsentRecord,
  Draft,
  Entry,
  EntryRecord,
  ExportBundle,
  IcthusRepository,
  Profile,
  SavedItem,
} from './types';

/**
 * Local-first storage.
 *
 * This is the offline substrate and, when Supabase is not configured, the only
 * store. Everything stays in this browser; nothing is uploaded. Drafts live in
 * their own store precisely so an unauthenticated draft can never be swept up
 * by a sync of "entries".
 */

const DB_NAME = 'icthus';
const DB_VERSION = 1;

interface IcthusDB extends DBSchema {
  entries: { key: string; value: EntryRecord; indexes: { byCreatedAt: string } };
  savedItems: { key: string; value: SavedItem; indexes: { byCreatedAt: string } };
  drafts: { key: string; value: Draft };
  routes: { key: string; value: DeliveryRoute };
  deliveryEvents: { key: string; value: DeliveryEvent; indexes: { byCreatedAt: string } };
  companionRuns: { key: string; value: DailyCompanionRun; indexes: { byStartedAt: string } };
  consents: { key: string; value: ConsentRecord };
  settings: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<IcthusDB>> | null = null;

function db(): Promise<IDBPDatabase<IcthusDB>> {
  if (!dbPromise) {
    dbPromise = openDB<IcthusDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const entries = database.createObjectStore('entries', { keyPath: 'entry.id' });
        entries.createIndex('byCreatedAt', 'entry.createdAt');

        const saved = database.createObjectStore('savedItems', { keyPath: 'id' });
        saved.createIndex('byCreatedAt', 'createdAt');

        database.createObjectStore('drafts', { keyPath: 'id' });
        database.createObjectStore('routes', { keyPath: 'id' });

        const events = database.createObjectStore('deliveryEvents', { keyPath: 'id' });
        events.createIndex('byCreatedAt', 'createdAt');

        const runs = database.createObjectStore('companionRuns', { keyPath: 'id' });
        runs.createIndex('byStartedAt', 'startedAt');

        database.createObjectStore('consents', { keyPath: 'id' });
        database.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
}

const SETTINGS_KEYS = {
  memory: 'memoryPreferences',
  companion: 'companionSettings',
  profile: 'profile',
} as const;

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const database = await db();
  const value = (await database.get('settings', key)) as T | undefined;
  return value ?? fallback;
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const database = await db();
  await database.put('settings', value, key);
}

function byNewestFirst<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export class LocalRepository implements IcthusRepository {
  readonly mode = 'local' as const;

  async listEntries(): Promise<EntryRecord[]> {
    const database = await db();
    const all = await database.getAll('entries');
    return [...all].sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt));
  }

  async getEntry(id: string): Promise<EntryRecord | null> {
    const database = await db();
    return (await database.get('entries', id)) ?? null;
  }

  async createEntry(entry: Entry, response: CompanionResult | null): Promise<EntryRecord> {
    const database = await db();
    const record: EntryRecord = { entry, response };
    await database.put('entries', record);
    return record;
  }

  async updateEntry(id: string, patch: Partial<Entry>): Promise<void> {
    const database = await db();
    const existing = await database.get('entries', id);
    if (!existing) return;
    await database.put('entries', { ...existing, entry: { ...existing.entry, ...patch } });
  }

  async deleteEntry(id: string): Promise<void> {
    const database = await db();
    const tx = database.transaction(['entries', 'savedItems'], 'readwrite');
    await tx.objectStore('entries').delete(id);
    // Deleting an entry also removes anything derived from it, which is what
    // "delete the response too" means in practice.
    const saved = await tx.objectStore('savedItems').getAll();
    await Promise.all(
      saved
        .filter((item) => item.entryId === id)
        .map((item) => tx.objectStore('savedItems').delete(item.id)),
    );
    await tx.done;
  }

  async listSavedItems(): Promise<SavedItem[]> {
    const database = await db();
    return byNewestFirst(await database.getAll('savedItems'));
  }

  async addSavedItem(item: SavedItem): Promise<void> {
    const database = await db();
    await database.put('savedItems', item);
  }

  async removeSavedItem(id: string): Promise<void> {
    const database = await db();
    await database.delete('savedItems', id);
  }

  async getMemoryPreferences(): Promise<MemoryPreferences> {
    return readSetting(SETTINGS_KEYS.memory, DEFAULT_MEMORY_PREFERENCES);
  }

  async setMemoryPreferences(preferences: MemoryPreferences): Promise<void> {
    await writeSetting(SETTINGS_KEYS.memory, preferences);
  }

  async listRoutes(): Promise<DeliveryRoute[]> {
    const database = await db();
    return byNewestFirst(await database.getAll('routes'));
  }

  async upsertRoute(route: DeliveryRoute): Promise<void> {
    const database = await db();
    await database.put('routes', route);
  }

  async deleteRoute(id: string): Promise<void> {
    const database = await db();
    const tx = database.transaction(['routes', 'deliveryEvents'], 'readwrite');
    await tx.objectStore('routes').delete(id);
    const events = await tx.objectStore('deliveryEvents').getAll();
    await Promise.all(
      events
        .filter((event) => event.routeId === id)
        .map((event) => tx.objectStore('deliveryEvents').delete(event.id)),
    );
    await tx.done;
  }

  async listDeliveryEvents(): Promise<DeliveryEvent[]> {
    const database = await db();
    return byNewestFirst(await database.getAll('deliveryEvents'));
  }

  async appendDeliveryEvent(event: DeliveryEvent): Promise<void> {
    const database = await db();
    await database.put('deliveryEvents', event);
  }

  async getCompanionSettings(): Promise<DailyCompanionSettings> {
    return readSetting(SETTINGS_KEYS.companion, {
      ...DEFAULT_COMPANION_SETTINGS,
      timeZone: resolveTimeZone(),
    });
  }

  async setCompanionSettings(settings: DailyCompanionSettings): Promise<void> {
    await writeSetting(SETTINGS_KEYS.companion, settings);
  }

  async listCompanionRuns(): Promise<DailyCompanionRun[]> {
    const database = await db();
    const runs = await database.getAll('companionRuns');
    return [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async appendCompanionRun(run: DailyCompanionRun): Promise<void> {
    const database = await db();
    await database.put('companionRuns', run);
  }

  async listConsents(): Promise<ConsentRecord[]> {
    const database = await db();
    return database.getAll('consents');
  }

  async recordConsent(consent: ConsentRecord): Promise<void> {
    const database = await db();
    await database.put('consents', consent);
  }

  async revokeConsent(type: ConsentRecord['type']): Promise<void> {
    const database = await db();
    const all = await database.getAll('consents');
    const now = new Date().toISOString();
    await Promise.all(
      all
        .filter((consent) => consent.type === type && !consent.revokedAt)
        .map((consent) => database.put('consents', { ...consent, revokedAt: now })),
    );
  }

  async getProfile(): Promise<Profile | null> {
    return readSetting<Profile | null>(SETTINGS_KEYS.profile, null);
  }

  async setProfile(profile: Profile): Promise<void> {
    await writeSetting(SETTINGS_KEYS.profile, profile);
  }

  async exportAll(): Promise<ExportBundle> {
    const [
      entries,
      savedItems,
      memoryPreferences,
      routes,
      deliveryEvents,
      companionSettings,
      companionRuns,
      consents,
    ] = await Promise.all([
      this.listEntries(),
      this.listSavedItems(),
      this.getMemoryPreferences(),
      this.listRoutes(),
      this.listDeliveryEvents(),
      this.getCompanionSettings(),
      this.listCompanionRuns(),
      this.listConsents(),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      entries,
      savedItems,
      memoryPreferences,
      routes,
      deliveryEvents,
      companionSettings,
      companionRuns,
      consents,
    };
  }

  async purgeAll(): Promise<void> {
    const database = await db();
    const stores = [
      'entries',
      'savedItems',
      'drafts',
      'routes',
      'deliveryEvents',
      'companionRuns',
      'consents',
      'settings',
    ] as const;
    const tx = database.transaction(stores, 'readwrite');
    await Promise.all(stores.map((store) => tx.objectStore(store).clear()));
    await tx.done;
  }
}

/* ------------------------------------------------------------------ */
/* Drafts                                                              */
/* ------------------------------------------------------------------ */

export const DRAFT_ID = 'current';

export async function loadDraft(): Promise<Draft | null> {
  const database = await db();
  return (await database.get('drafts', DRAFT_ID)) ?? null;
}

export async function saveDraft(draft: Omit<Draft, 'id' | 'updatedAt'>): Promise<void> {
  const database = await db();
  await database.put('drafts', { ...draft, id: DRAFT_ID, updatedAt: new Date().toISOString() });
}

export async function clearDraft(): Promise<void> {
  const database = await db();
  await database.delete('drafts', DRAFT_ID);
}
