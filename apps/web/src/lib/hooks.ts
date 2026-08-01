import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  buildMemoryInsights,
  type DailyCompanionRun,
  type DailyCompanionSettings,
  type DeliveryEvent,
  type DeliveryRoute,
  type MemoryInsight,
  type MemoryPreferences,
} from '@icthus/core';
import { useApp } from './AppProvider';
import type { ConsentRecord, EntryRecord, Profile, SavedItem } from './types';

/** Query keys are namespaced by storage mode so switching stores refetches. */
function keys(mode: string) {
  return {
    entries: [mode, 'entries'] as const,
    entry: (id: string) => [mode, 'entry', id] as const,
    saved: [mode, 'saved'] as const,
    memory: [mode, 'memoryPreferences'] as const,
    routes: [mode, 'routes'] as const,
    events: [mode, 'deliveryEvents'] as const,
    companion: [mode, 'companionSettings'] as const,
    runs: [mode, 'companionRuns'] as const,
    consents: [mode, 'consents'] as const,
    profile: [mode, 'profile'] as const,
  };
}

export function useEntries(): UseQueryResult<EntryRecord[]> {
  const { repository } = useApp();
  return useQuery({
    queryKey: keys(repository.mode).entries,
    queryFn: () => repository.listEntries(),
  });
}

export function useEntry(id: string | undefined): UseQueryResult<EntryRecord | null> {
  const { repository } = useApp();
  return useQuery({
    queryKey: keys(repository.mode).entry(id ?? ''),
    queryFn: () => (id ? repository.getEntry(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  });
}

export function useSavedItems(): UseQueryResult<SavedItem[]> {
  const { repository } = useApp();
  return useQuery({
    queryKey: keys(repository.mode).saved,
    queryFn: () => repository.listSavedItems(),
  });
}

export function useMemoryPreferences(): UseQueryResult<MemoryPreferences> {
  const { repository } = useApp();
  return useQuery({
    queryKey: keys(repository.mode).memory,
    queryFn: () => repository.getMemoryPreferences(),
  });
}

export function useRoutes(): UseQueryResult<DeliveryRoute[]> {
  const { repository } = useApp();
  return useQuery({
    queryKey: keys(repository.mode).routes,
    queryFn: () => repository.listRoutes(),
  });
}

export function useDeliveryEvents(): UseQueryResult<DeliveryEvent[]> {
  const { repository } = useApp();
  return useQuery({
    queryKey: keys(repository.mode).events,
    queryFn: () => repository.listDeliveryEvents(),
  });
}

export function useCompanionSettings(): UseQueryResult<DailyCompanionSettings> {
  const { repository } = useApp();
  return useQuery({
    queryKey: keys(repository.mode).companion,
    queryFn: () => repository.getCompanionSettings(),
  });
}

export function useCompanionRuns(): UseQueryResult<DailyCompanionRun[]> {
  const { repository } = useApp();
  return useQuery({
    queryKey: keys(repository.mode).runs,
    queryFn: () => repository.listCompanionRuns(),
  });
}

export function useConsents(): UseQueryResult<ConsentRecord[]> {
  const { repository } = useApp();
  return useQuery({
    queryKey: keys(repository.mode).consents,
    queryFn: () => repository.listConsents(),
  });
}

export function useProfile(): UseQueryResult<Profile | null> {
  const { repository } = useApp();
  return useQuery({
    queryKey: keys(repository.mode).profile,
    queryFn: () => repository.getProfile(),
  });
}

/**
 * Memory insights are derived on read rather than stored, so turning Memory
 * off makes them disappear immediately with nothing left behind to clean up.
 */
export function useMemoryInsights(): {
  insights: MemoryInsight[];
  preferences: MemoryPreferences | undefined;
  isLoading: boolean;
} {
  const entries = useEntries();
  const preferences = useMemoryPreferences();

  const insights =
    preferences.data && entries.data
      ? buildMemoryInsights(
          entries.data
            .filter((record) => !record.entry.excludedFromMemory)
            .map((record) => ({
              id: record.entry.id,
              occurredAt: record.entry.occurredAt,
              body: record.entry.body,
            })),
          preferences.data,
        )
      : [];

  return {
    insights,
    preferences: preferences.data,
    isLoading: entries.isLoading || preferences.isLoading,
  };
}

/** Invalidates every Icthus query for the active storage mode. */
export function useRefreshAll(): () => Promise<void> {
  const { repository } = useApp();
  const client = useQueryClient();
  return useCallback(async () => {
    await client.invalidateQueries({ queryKey: [repository.mode] });
  }, [client, repository.mode]);
}

export function useMutateRepository<TArgs, TResult>(
  run: (repository: ReturnType<typeof useApp>['repository'], args: TArgs) => Promise<TResult>,
) {
  const { repository } = useApp();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => run(repository, args),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [repository.mode] });
    },
  });
}
