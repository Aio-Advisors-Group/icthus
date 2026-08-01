import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  DeterministicCompanionProvider,
  LocalScriptureProvider,
  ManualTranscriptionProvider,
  MockGlooProvider,
  type CompanionProvider,
  type FaithConnectionProvider,
  type ScriptureProvider,
  type TranscriptionProvider,
} from '@icthus/core';
import { FLAGS } from './env';
import { LocalRepository } from './localRepository';
import { SupabaseRepository } from './supabaseRepository';
import { isSupabaseConfigured, supabase } from './supabase';
import type { IcthusRepository } from './types';

/**
 * Composition root.
 *
 * Provider selection happens here and nowhere else, so a screen can never
 * reach around an adapter to call a vendor directly. Which adapter is active
 * is exposed on the context, because the UI has to be able to say so.
 */

export type AppContextValue = {
  repository: IcthusRepository;
  scripture: ScriptureProvider;
  companion: CompanionProvider;
  gloo: FaithConnectionProvider;
  transcription: TranscriptionProvider;
  session: Session | null;
  authReady: boolean;
  supabaseConfigured: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

const localRepository = new LocalRepository();
const scriptureProvider = new LocalScriptureProvider();
const companionProvider = new DeterministicCompanionProvider(scriptureProvider);
const glooProvider = new MockGlooProvider();
const transcriptionProvider = new ManualTranscriptionProvider();

export function AppProvider({ children }: { children: ReactNode }): ReactNode {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured());

  useEffect(() => {
    const client = supabase();
    if (!client) {
      setAuthReady(true);
      return;
    }
    let active = true;
    client.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setAuthReady(true);
      })
      .catch(() => {
        if (active) setAuthReady(true);
      });

    const { data: subscription } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const client = supabase();
    // Signed out, or Supabase not configured: everything stays on this device.
    const repository: IcthusRepository =
      client && session?.user ? new SupabaseRepository(client, session.user.id) : localRepository;

    return {
      repository,
      scripture: scriptureProvider,
      companion: companionProvider,
      gloo: glooProvider,
      transcription: transcriptionProvider,
      session,
      authReady,
      supabaseConfigured: isSupabaseConfigured(),
    };
  }, [session, authReady]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}

export function useFlags() {
  return FLAGS;
}
