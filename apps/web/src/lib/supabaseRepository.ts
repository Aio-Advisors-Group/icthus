import type { SupabaseClient } from '@supabase/supabase-js';
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
  Entry,
  EntryRecord,
  ExportBundle,
  IcthusRepository,
  Profile,
  SavedItem,
} from './types';

/**
 * Supabase-backed storage.
 *
 * Every query here is scoped by RLS rather than by a client-supplied filter —
 * `auth.uid() = user_id` is enforced in the database, so a bug in this file
 * cannot leak another person's reflections. `user_id` is still written on
 * insert because the policies check it.
 */

type Row = Record<string, unknown>;

function assertNoError(error: { message: string } | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function toEntry(row: Row): Entry {
  return {
    id: String(row.id),
    kind: row.kind as Entry['kind'],
    mode: row.mode as Entry['mode'],
    purpose: row.purpose as Entry['purpose'],
    body: String(row.body ?? ''),
    occurredAt: String(row.occurred_at),
    createdAt: String(row.created_at),
    sourceKind: row.source_kind as Entry['sourceKind'],
    importedFrom: (row.imported_from as string | null) ?? null,
    excludedFromMemory: Boolean(row.excluded_from_memory),
  };
}

function fromEntry(entry: Entry, userId: string): Row {
  return {
    id: entry.id,
    user_id: userId,
    kind: entry.kind,
    mode: entry.mode,
    purpose: entry.purpose,
    body: entry.body,
    occurred_at: entry.occurredAt,
    created_at: entry.createdAt,
    source_kind: entry.sourceKind,
    imported_from: entry.importedFrom,
    excluded_from_memory: entry.excludedFromMemory,
  };
}

function toSavedItem(row: Row): SavedItem {
  return {
    id: String(row.id),
    kind: row.kind as SavedItem['kind'],
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    reference: (row.reference as string | null) ?? null,
    attribution: (row.attribution as string | null) ?? null,
    sourceId: (row.source_id as string | null) ?? null,
    entryId: (row.entry_id as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

function toRoute(row: Row): DeliveryRoute {
  return {
    id: String(row.id),
    destinationId: String(row.destination_id),
    targetRef: (row.target_ref as string | null) ?? null,
    targetLabel: (row.target_label as string | null) ?? null,
    enabled: Boolean(row.enabled),
    paused: Boolean(row.paused),
    timeZone: String(row.time_zone),
    schedule: row.schedule as DeliveryRoute['schedule'],
    quietHours: (row.quiet_hours as DeliveryRoute['quietHours']) ?? null,
    outputs: (row.outputs as DeliveryRoute['outputs']) ?? [],
    consentAt: String(row.consent_at),
    createdAt: String(row.created_at),
    revokedAt: (row.revoked_at as string | null) ?? null,
  };
}

function toDeliveryEvent(row: Row): DeliveryEvent {
  return {
    id: String(row.id),
    routeId: String(row.route_id),
    outputType: row.output_type as DeliveryEvent['outputType'],
    status: row.status as DeliveryEvent['status'],
    scheduledFor: String(row.scheduled_for),
    deliveredAt: (row.delivered_at as string | null) ?? null,
    reasonCode: (row.reason_code as string | null) ?? null,
    idempotencyKey: String(row.idempotency_key),
    createdAt: String(row.created_at),
  };
}

function toRun(row: Row): DailyCompanionRun {
  return {
    id: String(row.id),
    status: row.status as DailyCompanionRun['status'],
    trigger: row.trigger as DailyCompanionRun['trigger'],
    startedAt: String(row.started_at),
    completedAt: String(row.completed_at),
    inputSelection: (row.input_selection as DailyCompanionRun['inputSelection']) ?? [],
    inputSummary: String(row.input_summary ?? ''),
    usedEntryIds: (row.used_entry_ids as string[]) ?? [],
    passage: (row.passage as DailyCompanionRun['passage']) ?? null,
    question: (row.question as string | null) ?? null,
    glooResponse: (row.gloo_response as DailyCompanionRun['glooResponse']) ?? null,
    scriptureProviderState:
      row.scripture_provider_state as DailyCompanionRun['scriptureProviderState'],
    glooProviderState: row.gloo_provider_state as DailyCompanionRun['glooProviderState'],
    degradedReason: (row.degraded_reason as string | null) ?? null,
  };
}

export class SupabaseRepository implements IcthusRepository {
  readonly mode = 'supabase' as const;

  constructor(
    private readonly sb: SupabaseClient,
    private readonly userId: string,
  ) {}

  async listEntries(): Promise<EntryRecord[]> {
    const { data, error } = await this.sb
      .from('entries')
      .select('*, companion_responses(payload)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    assertNoError(error, 'listEntries');
    return (data ?? []).map((row: Row) => {
      const responses = (row.companion_responses as { payload: CompanionResult }[] | null) ?? [];
      return { entry: toEntry(row), response: responses[0]?.payload ?? null };
    });
  }

  async getEntry(id: string): Promise<EntryRecord | null> {
    const { data, error } = await this.sb
      .from('entries')
      .select('*, companion_responses(payload)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    assertNoError(error, 'getEntry');
    if (!data) return null;
    const responses = (data.companion_responses as { payload: CompanionResult }[] | null) ?? [];
    return { entry: toEntry(data), response: responses[0]?.payload ?? null };
  }

  async createEntry(entry: Entry, response: CompanionResult | null): Promise<EntryRecord> {
    const { error } = await this.sb.from('entries').insert(fromEntry(entry, this.userId));
    assertNoError(error, 'createEntry');

    if (response) {
      const { error: responseError } = await this.sb.from('companion_responses').insert({
        entry_id: entry.id,
        user_id: this.userId,
        payload: response,
        safety_state: response.safetyState,
        prompt_version: response.meta.promptVersion,
        model_version: response.meta.modelVersion,
        scripture_provider_state: response.meta.scriptureProviderState,
        companion_provider_state: response.meta.companionProviderState,
      });
      assertNoError(responseError, 'createEntry.response');
    }
    return { entry, response };
  }

  async updateEntry(id: string, patch: Partial<Entry>): Promise<void> {
    const row: Row = {};
    if (patch.body !== undefined) row.body = patch.body;
    if (patch.purpose !== undefined) row.purpose = patch.purpose;
    if (patch.excludedFromMemory !== undefined) {
      row.excluded_from_memory = patch.excludedFromMemory;
    }
    if (Object.keys(row).length === 0) return;
    const { error } = await this.sb.from('entries').update(row).eq('id', id);
    assertNoError(error, 'updateEntry');
  }

  async deleteEntry(id: string): Promise<void> {
    // Soft-delete first so the async purge job has something to work from; the
    // row is invisible to every read path immediately.
    const { error } = await this.sb
      .from('entries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    assertNoError(error, 'deleteEntry');
  }

  async listSavedItems(): Promise<SavedItem[]> {
    const { data, error } = await this.sb
      .from('saved_items')
      .select('*')
      .order('created_at', { ascending: false });
    assertNoError(error, 'listSavedItems');
    return (data ?? []).map(toSavedItem);
  }

  async addSavedItem(item: SavedItem): Promise<void> {
    const { error } = await this.sb.from('saved_items').insert({
      id: item.id,
      user_id: this.userId,
      kind: item.kind,
      title: item.title,
      body: item.body,
      reference: item.reference,
      attribution: item.attribution,
      source_id: item.sourceId,
      entry_id: item.entryId,
      created_at: item.createdAt,
    });
    assertNoError(error, 'addSavedItem');
  }

  async removeSavedItem(id: string): Promise<void> {
    const { error } = await this.sb.from('saved_items').delete().eq('id', id);
    assertNoError(error, 'removeSavedItem');
  }

  async getMemoryPreferences(): Promise<MemoryPreferences> {
    const { data, error } = await this.sb
      .from('memory_preferences')
      .select('*')
      .eq('user_id', this.userId)
      .maybeSingle();
    assertNoError(error, 'getMemoryPreferences');
    if (!data) return DEFAULT_MEMORY_PREFERENCES;
    return {
      enabled: Boolean(data.enabled),
      windowDays: data.window_days as MemoryPreferences['windowDays'],
      hiddenThemes: (data.hidden_themes as string[]) ?? [],
      excludedEntryIds: (data.excluded_entry_ids as string[]) ?? [],
    };
  }

  async setMemoryPreferences(preferences: MemoryPreferences): Promise<void> {
    const { error } = await this.sb.from('memory_preferences').upsert({
      user_id: this.userId,
      enabled: preferences.enabled,
      window_days: preferences.windowDays,
      hidden_themes: preferences.hiddenThemes,
      excluded_entry_ids: preferences.excludedEntryIds,
      updated_at: new Date().toISOString(),
    });
    assertNoError(error, 'setMemoryPreferences');

    // Turning Memory off deletes its derived data immediately rather than
    // leaving it dormant. Original entries are untouched.
    if (!preferences.enabled) {
      await this.sb.from('memory_insights').delete().eq('user_id', this.userId);
      await this.sb.from('memory_themes').delete().eq('user_id', this.userId);
    }
  }

  async listRoutes(): Promise<DeliveryRoute[]> {
    const { data, error } = await this.sb
      .from('delivery_routes')
      .select('*')
      .order('created_at', { ascending: false });
    assertNoError(error, 'listRoutes');
    return (data ?? []).map(toRoute);
  }

  async upsertRoute(route: DeliveryRoute): Promise<void> {
    const { error } = await this.sb.from('delivery_routes').upsert({
      id: route.id,
      user_id: this.userId,
      destination_id: route.destinationId,
      target_ref: route.targetRef,
      target_label: route.targetLabel,
      enabled: route.enabled,
      paused: route.paused,
      time_zone: route.timeZone,
      schedule: route.schedule,
      quiet_hours: route.quietHours,
      outputs: route.outputs,
      consent_at: route.consentAt,
      created_at: route.createdAt,
      revoked_at: route.revokedAt,
      updated_at: new Date().toISOString(),
    });
    assertNoError(error, 'upsertRoute');
  }

  async deleteRoute(id: string): Promise<void> {
    const { error } = await this.sb.from('delivery_routes').delete().eq('id', id);
    assertNoError(error, 'deleteRoute');
  }

  async listDeliveryEvents(): Promise<DeliveryEvent[]> {
    const { data, error } = await this.sb
      .from('delivery_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    assertNoError(error, 'listDeliveryEvents');
    return (data ?? []).map(toDeliveryEvent);
  }

  async appendDeliveryEvent(event: DeliveryEvent): Promise<void> {
    const { error } = await this.sb.from('delivery_events').insert({
      id: event.id,
      user_id: this.userId,
      route_id: event.routeId,
      output_type: event.outputType,
      status: event.status,
      scheduled_for: event.scheduledFor,
      delivered_at: event.deliveredAt,
      reason_code: event.reasonCode,
      idempotency_key: event.idempotencyKey,
      created_at: event.createdAt,
    });
    assertNoError(error, 'appendDeliveryEvent');
  }

  async getCompanionSettings(): Promise<DailyCompanionSettings> {
    const { data, error } = await this.sb
      .from('daily_companion_settings')
      .select('*')
      .eq('user_id', this.userId)
      .maybeSingle();
    assertNoError(error, 'getCompanionSettings');
    if (!data) return { ...DEFAULT_COMPANION_SETTINGS, timeZone: resolveTimeZone() };
    return {
      enabled: Boolean(data.enabled),
      schedule: data.schedule as DailyCompanionSettings['schedule'],
      timeZone: String(data.time_zone),
      inputs: data.inputs as DailyCompanionSettings['inputs'],
      glooConsentAt: (data.gloo_consent_at as string | null) ?? null,
      updatedAt: String(data.updated_at),
    };
  }

  async setCompanionSettings(settings: DailyCompanionSettings): Promise<void> {
    const { error } = await this.sb.from('daily_companion_settings').upsert({
      user_id: this.userId,
      enabled: settings.enabled,
      schedule: settings.schedule,
      time_zone: settings.timeZone,
      inputs: settings.inputs,
      gloo_consent_at: settings.glooConsentAt,
      updated_at: new Date().toISOString(),
    });
    assertNoError(error, 'setCompanionSettings');
  }

  async listCompanionRuns(): Promise<DailyCompanionRun[]> {
    const { data, error } = await this.sb
      .from('daily_companion_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);
    assertNoError(error, 'listCompanionRuns');
    return (data ?? []).map(toRun);
  }

  async appendCompanionRun(run: DailyCompanionRun): Promise<void> {
    const { error } = await this.sb.from('daily_companion_runs').insert({
      id: run.id,
      user_id: this.userId,
      status: run.status,
      trigger: run.trigger,
      started_at: run.startedAt,
      completed_at: run.completedAt,
      input_selection: run.inputSelection,
      input_summary: run.inputSummary,
      used_entry_ids: run.usedEntryIds,
      passage: run.passage,
      question: run.question,
      gloo_response: run.glooResponse,
      scripture_provider_state: run.scriptureProviderState,
      gloo_provider_state: run.glooProviderState,
      degraded_reason: run.degradedReason,
    });
    assertNoError(error, 'appendCompanionRun');
  }

  async listConsents(): Promise<ConsentRecord[]> {
    const { data, error } = await this.sb.from('consents').select('*');
    assertNoError(error, 'listConsents');
    return (data ?? []).map((row: Row) => ({
      id: String(row.id),
      type: row.type as ConsentRecord['type'],
      policyVersion: String(row.policy_version),
      grantedAt: String(row.granted_at),
      revokedAt: (row.revoked_at as string | null) ?? null,
    }));
  }

  async recordConsent(consent: ConsentRecord): Promise<void> {
    const { error } = await this.sb.from('consents').insert({
      id: consent.id,
      user_id: this.userId,
      type: consent.type,
      policy_version: consent.policyVersion,
      granted_at: consent.grantedAt,
      revoked_at: consent.revokedAt,
    });
    assertNoError(error, 'recordConsent');
  }

  async revokeConsent(type: ConsentRecord['type']): Promise<void> {
    const { error } = await this.sb
      .from('consents')
      .update({ revoked_at: new Date().toISOString() })
      .eq('type', type)
      .is('revoked_at', null);
    assertNoError(error, 'revokeConsent');
  }

  async getProfile(): Promise<Profile | null> {
    const { data, error } = await this.sb
      .from('profiles')
      .select('*')
      .eq('id', this.userId)
      .maybeSingle();
    assertNoError(error, 'getProfile');
    if (!data) return null;
    return {
      id: String(data.id),
      email: (data.email as string | null) ?? null,
      displayName: (data.display_name as string | null) ?? null,
      translationId: String(data.translation_id ?? 'web'),
      timeZone: String(data.time_zone ?? resolveTimeZone()),
      onboardedAt: (data.onboarded_at as string | null) ?? null,
    };
  }

  async setProfile(profile: Profile): Promise<void> {
    const { error } = await this.sb.from('profiles').upsert({
      id: this.userId,
      email: profile.email,
      display_name: profile.displayName,
      translation_id: profile.translationId,
      time_zone: profile.timeZone,
      onboarded_at: profile.onboardedAt,
    });
    assertNoError(error, 'setProfile');
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
    // Account deletion is an Edge Function operation: it needs to remove the
    // auth user and storage objects, which the anon key cannot do. This client
    // path clears what RLS permits and the function completes the rest.
    for (const table of [
      'delivery_events',
      'delivery_routes',
      'memory_insights',
      'memory_themes',
      'memory_preferences',
      'daily_companion_runs',
      'daily_companion_settings',
      'saved_items',
      'companion_responses',
      'entry_assets',
      'entries',
      'integration_connections',
      'consents',
    ]) {
      await this.sb.from(table).delete().eq('user_id', this.userId);
    }
  }
}
