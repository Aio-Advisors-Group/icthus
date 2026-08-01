/**
 * Account deletion.
 *
 * The client can delete its own rows through RLS, but it cannot delete the
 * auth user or the storage objects — those need the service role. This
 * function completes the job so "delete my account" actually means it.
 */

import {
  adminClient,
  audit,
  jsonResponse,
  logEvent,
  preflight,
  requireUser,
} from '../_shared/http.ts';

const USER_TABLES = [
  'delivery_events',
  'delivery_routes',
  'memory_insights',
  'memory_themes',
  'memory_preferences',
  'daily_companion_runs',
  'daily_companion_settings',
  'saved_items',
  'citations',
  'companion_responses',
  'entry_assets',
  'entries',
  'integration_connections',
  'consents',
  'profiles',
] as const;

const BUCKETS = ['icthus-audio', 'icthus-images', 'icthus-exports'] as const;

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  const origin = request.headers.get('origin');
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405, origin });
  }

  const user = await requireUser(request);
  if (!user) return jsonResponse({ error: 'unauthorised' }, { status: 401, origin });

  let body: { confirm?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // A typed confirmation, so a stray POST cannot erase someone's journal.
  if (body.confirm !== 'DELETE') {
    return jsonResponse(
      { error: 'confirmation_required', detail: 'Send {"confirm":"DELETE"} to proceed.' },
      { status: 400, origin },
    );
  }

  const admin = adminClient();

  // Audit first: once the auth user is gone, the user_id foreign key nulls out
  // and there is nothing left to attach the record to.
  await audit(admin, user.id, 'account.delete.requested', 'user', user.id);

  for (const bucket of BUCKETS) {
    const { data, error } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    if (error || !data) continue;
    const paths = data.map((item) => `${user.id}/${item.name}`);
    if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
  }

  for (const table of USER_TABLES) {
    const column = table === 'profiles' ? 'id' : 'user_id';
    const { error } = await admin.from(table).delete().eq(column, user.id);
    if (error) {
      logEvent('account.delete.table_failed', { table, code: error.code ?? 'unknown' });
      return jsonResponse(
        {
          error: 'partial_failure',
          table,
          detail:
            'Some data could not be removed. Nothing was left half-deleted silently — retry or contact support.',
        },
        { status: 500, origin },
      );
    }
  }

  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    logEvent('account.delete.auth_failed', { code: authError.status ?? 0 });
    return jsonResponse(
      {
        error: 'auth_delete_failed',
        detail: 'Your data was removed but the sign-in record remains. Please retry.',
      },
      { status: 500, origin },
    );
  }

  logEvent('account.delete.completed');
  return jsonResponse({ deleted: true }, { origin });
});
