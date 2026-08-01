/**
 * Delivery dispatcher.
 *
 * Runs on a schedule (pg_cron → this function) and processes due routes.
 *
 * The rules it enforces, in order, before anything is sent:
 *   1. the route must be enabled, unpaused, and not revoked
 *   2. the destination must be server-deliverable at all (connected only)
 *   3. the provider must actually have credentials
 *   4. a raw journal output must carry its own separate consent
 *   5. a memory insight requires Memory to be on
 *
 * Failing any of these records a `skipped` event with a reason code. It never
 * records the content of what would have been sent.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { adminClient, audit, jsonResponse, logEvent, preflight } from '../_shared/http.ts';
import {
  capabilityOf,
  connectedProviderConfigured,
  isServerDeliverable,
} from '../_shared/capabilities.ts';

type RouteOutput = {
  outputType: string;
  deliveryMode: string;
  enabled: boolean;
  rawEntryConsentAt: string | null;
};

type RouteRow = {
  id: string;
  user_id: string;
  destination_id: string;
  target_ref: string | null;
  enabled: boolean;
  paused: boolean;
  revoked_at: string | null;
  time_zone: string;
  schedule: { frequency: string; time?: string };
  quiet_hours: { start: string; end: string } | null;
  outputs: RouteOutput[];
};

function minutesOfDay(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function localMinutes(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const lookup: Record<string, string> = {};
  for (const part of parts) lookup[part.type] = part.value;
  return (Number(lookup.hour) % 24) * 60 + Number(lookup.minute);
}

function withinQuietHours(now: Date, timeZone: string, quiet: RouteRow['quiet_hours']): boolean {
  if (!quiet) return false;
  const current = localMinutes(now, timeZone);
  const from = minutesOfDay(quiet.start);
  const to = minutesOfDay(quiet.end);
  if (from === to) return false;
  return from < to ? current >= from && current < to : current >= from || current < to;
}

/** True when the route's scheduled minute falls inside this dispatch window. */
function isDue(now: Date, route: RouteRow, windowMinutes: number): boolean {
  if (route.schedule.frequency !== 'daily' && route.schedule.frequency !== 'weekly') return false;
  const scheduled = minutesOfDay(route.schedule.time ?? '07:30');
  const current = localMinutes(now, route.time_zone);
  const delta = current - scheduled;
  return delta >= 0 && delta < windowMinutes;
}

async function recordEvent(
  admin: SupabaseClient,
  route: RouteRow,
  outputType: string,
  status: string,
  reasonCode: string | null,
  scheduledFor: string,
): Promise<void> {
  // The idempotency key is deterministic per route/output/day, so a re-run of
  // the dispatcher in the same window cannot double-send.
  const day = scheduledFor.slice(0, 13);
  await admin.from('delivery_events').upsert(
    {
      user_id: route.user_id,
      route_id: route.id,
      output_type: outputType,
      status,
      scheduled_for: scheduledFor,
      delivered_at: status === 'delivered' ? new Date().toISOString() : null,
      reason_code: reasonCode,
      idempotency_key: `${route.id}:${outputType}:${day}`,
    },
    { onConflict: 'route_id,idempotency_key', ignoreDuplicates: true },
  );
}

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  const origin = request.headers.get('origin');

  // Scheduled invocation only. A stray public POST must not run the queue.
  const secret = Deno.env.get('ICTHUS_SCHEDULER_SECRET');
  if (!secret || request.headers.get('x-scheduler-secret') !== secret) {
    return jsonResponse({ error: 'unauthorised' }, { status: 401, origin });
  }

  const admin = adminClient();
  const now = new Date();
  const windowMinutes = Number(Deno.env.get('ICTHUS_DISPATCH_WINDOW_MINUTES') ?? '15');

  const { data: routes, error } = await admin
    .from('delivery_routes')
    .select('*')
    .eq('enabled', true)
    .eq('paused', false)
    .is('revoked_at', null);

  if (error) {
    logEvent('dispatch.query_failed', { code: error.code ?? 'unknown' });
    return jsonResponse({ error: 'query_failed' }, { status: 500, origin });
  }

  let processed = 0;
  let delivered = 0;
  let skipped = 0;

  for (const route of (routes ?? []) as RouteRow[]) {
    if (!isDue(now, route, windowMinutes)) continue;
    processed += 1;
    const scheduledFor = now.toISOString();

    const capability = capabilityOf(route.destination_id);
    const enabledOutputs = (route.outputs ?? []).filter((output) => output.enabled);

    for (const output of enabledOutputs) {
      if (withinQuietHours(now, route.time_zone, route.quiet_hours)) {
        await recordEvent(admin, route, output.outputType, 'skipped', 'quiet_hours', scheduledFor);
        skipped += 1;
        continue;
      }

      // A destination Icthus cannot post to is never "attempted" server-side.
      if (!capability || !isServerDeliverable(route.destination_id)) {
        await recordEvent(
          admin,
          route,
          output.outputType,
          capability === 'future_native' ? 'skipped' : 'prepared',
          capability === 'future_native' ? 'requires_native_extension' : 'client_share_required',
          scheduledFor,
        );
        skipped += 1;
        continue;
      }

      if (!connectedProviderConfigured(route.destination_id)) {
        await recordEvent(
          admin,
          route,
          output.outputType,
          'skipped',
          'provider_unavailable',
          scheduledFor,
        );
        skipped += 1;
        continue;
      }

      if (output.outputType === 'journal_entry' && !output.rawEntryConsentAt) {
        await recordEvent(
          admin,
          route,
          output.outputType,
          'skipped',
          'consent_revoked',
          scheduledFor,
        );
        skipped += 1;
        continue;
      }

      if (output.outputType === 'memory_insight') {
        const { data: preferences } = await admin
          .from('memory_preferences')
          .select('enabled')
          .eq('user_id', route.user_id)
          .maybeSingle();
        if (!preferences?.enabled) {
          await recordEvent(
            admin,
            route,
            output.outputType,
            'skipped',
            'memory_disabled',
            scheduledFor,
          );
          skipped += 1;
          continue;
        }
      }

      if (!route.target_ref) {
        await recordEvent(
          admin,
          route,
          output.outputType,
          'failed',
          'missing_target',
          scheduledFor,
        );
        continue;
      }

      // Reaching here means a real credentialed send would happen. The actual
      // provider call is added alongside its OAuth app — see
      // docs/PROVIDER_SETUP.md. Until then the honest outcome is `skipped`.
      await recordEvent(
        admin,
        route,
        output.outputType,
        'skipped',
        'provider_unavailable',
        scheduledFor,
      );
      skipped += 1;
    }

    await audit(admin, route.user_id, 'delivery.dispatch', 'delivery_route', route.id, {
      outputs: enabledOutputs.length,
    });
  }

  logEvent('dispatch.completed', { processed, delivered, skipped });
  return jsonResponse({ processed, delivered, skipped }, { origin });
});
