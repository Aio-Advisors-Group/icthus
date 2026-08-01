import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, authRedirectUrl } from './env';

/**
 * Supabase client.
 *
 * The anon key is a public identifier, not a secret — Row Level Security is
 * what protects the data, and every user-owned table has it. The service-role
 * key must never appear in this app.
 */

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  const sb = supabase();
  if (!sb) return { error: 'Sign-in is not configured in this build.' };
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authRedirectUrl() },
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut();
}
