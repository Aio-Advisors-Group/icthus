/**
 * Shared HTTP helpers for Icthus Edge Functions.
 *
 * Deno runtime. These functions hold the only credentials that matter — the
 * service-role key and provider secrets — so the rules here are strict:
 * authenticate every request, rate limit anything expensive, and never write
 * user content to a log line.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ICTHUS_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  // An explicit allowlist rather than "*": these endpoints act on a person's
  // private journal with their credentials attached.
  const allowed =
    origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin))
      ? origin
      : (ALLOWED_ORIGINS[0] ?? '');
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, idempotency-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function jsonResponse(
  body: unknown,
  init: { status?: number; origin?: string | null } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(init.origin ?? null),
    },
  });
}

export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

/** Client bound to the caller's JWT — every query still passes through RLS. */
export function userClient(request: Request): SupabaseClient | null {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
}

/**
 * Service-role client. Bypasses RLS, so every call site must have already
 * established which user it is acting for.
 */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

export type AuthedUser = { id: string; email: string | null };

export async function requireUser(request: Request): Promise<AuthedUser | null> {
  const client = userClient(request);
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Database-backed rate limiting.
 *
 * Uses audit_events as the counter so there is no extra infrastructure and no
 * Redis. Counts are per user, per action, per window.
 */
export async function checkRateLimit(
  admin: SupabaseClient,
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error } = await admin
    .from('audit_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', action)
    .gte('created_at', since);

  if (error) {
    // Fail closed on an unreadable counter rather than opening the gate.
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }
  if ((count ?? 0) >= limit) {
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Records an audit event. `metadata` must contain identifiers and counts only —
 * never reflection text, transcripts, prayers, or generated responses.
 */
export async function audit(
  admin: SupabaseClient,
  userId: string | null,
  eventType: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  await admin.from('audit_events').insert({
    user_id: userId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}

/** Structured log that cannot accidentally carry user content. */
export function logEvent(
  event: string,
  fields: Record<string, string | number | boolean> = {},
): void {
  console.log(JSON.stringify({ event, ...fields, at: new Date().toISOString() }));
}
