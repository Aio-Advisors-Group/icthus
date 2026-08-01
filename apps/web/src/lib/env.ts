import { resolveFlags, type FeatureFlags } from '@icthus/core';

/**
 * Environment resolution.
 *
 * Only `VITE_`-prefixed values exist in the browser bundle, and none of them
 * are secrets: the Supabase anon key is safe to ship because RLS is what
 * actually protects the data. Provider keys live in Edge Function secrets and
 * never appear here.
 */

const env = import.meta.env as unknown as Record<string, string | undefined>;

export const FLAGS: FeatureFlags = resolveFlags(env);

export const SUPABASE_URL = env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? '';

export const BASE_URL = import.meta.env.BASE_URL || '/';

export const IS_DEV = import.meta.env.DEV;

/** Absolute URL used for magic-link redirects, respecting the Pages base path. */
export function authRedirectUrl(): string {
  if (typeof window === 'undefined') return BASE_URL;
  return new URL(
    `${BASE_URL}auth/callback`.replace(/\/{2,}/g, '/'),
    window.location.origin,
  ).toString();
}

export const APP_NAME = 'Icthus';
export const APP_TAGLINE = 'Bring what is real.';
