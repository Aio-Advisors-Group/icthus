/**
 * Issues a short-lived signed upload URL for an audio or image asset.
 *
 * The client never holds a storage key. It asks for a URL, this function
 * validates ownership and the file's declared type and size, and returns a URL
 * scoped to a path the storage policies already constrain to that user.
 */

import {
  adminClient,
  audit,
  checkRateLimit,
  jsonResponse,
  logEvent,
  preflight,
  requireUser,
  userClient,
} from '../_shared/http.ts';

const LIMITS = {
  audio: {
    bucket: 'icthus-audio',
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'],
  },
  image: {
    bucket: 'icthus-images',
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'],
  },
} as const;

type AssetKind = keyof typeof LIMITS;

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  const origin = request.headers.get('origin');
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405, origin });
  }

  const user = await requireUser(request);
  if (!user) return jsonResponse({ error: 'unauthorised' }, { status: 401, origin });

  const admin = adminClient();
  const rate = await checkRateLimit(admin, user.id, 'asset.upload_url', 30, 3600);
  if (!rate.allowed) {
    return jsonResponse(
      { error: 'rate_limited', retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, origin },
    );
  }

  let body: { kind?: string; entryId?: string; mimeType?: string; byteSize?: number };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_body' }, { status: 400, origin });
  }

  const kind = body.kind as AssetKind | undefined;
  if (!kind || !(kind in LIMITS)) {
    return jsonResponse({ error: 'invalid_kind' }, { status: 400, origin });
  }
  const limits = LIMITS[kind];

  if (!body.mimeType || !limits.mimeTypes.includes(body.mimeType as never)) {
    return jsonResponse(
      { error: 'unsupported_type', allowed: limits.mimeTypes },
      { status: 400, origin },
    );
  }
  if (typeof body.byteSize !== 'number' || body.byteSize <= 0 || body.byteSize > limits.maxBytes) {
    return jsonResponse(
      { error: 'file_too_large', maxBytes: limits.maxBytes },
      { status: 400, origin },
    );
  }
  if (!body.entryId) {
    return jsonResponse({ error: 'entry_required' }, { status: 400, origin });
  }

  // Ownership is re-checked through the caller's own RLS-bound client, so a
  // forged entryId cannot attach an asset to someone else's entry.
  const asUser = userClient(request);
  const { data: entry, error: entryError } = await asUser!
    .from('entries')
    .select('id')
    .eq('id', body.entryId)
    .maybeSingle();
  if (entryError || !entry) {
    return jsonResponse({ error: 'entry_not_found' }, { status: 404, origin });
  }

  const assetId = crypto.randomUUID();
  const extension = body.mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') ?? 'bin';
  const path = `${user.id}/${body.entryId}/${assetId}.${extension}`;

  const { data: signed, error: signError } = await admin.storage
    .from(limits.bucket)
    .createSignedUploadUrl(path);

  if (signError || !signed) {
    logEvent('asset.sign_failed', { kind, bucket: limits.bucket });
    return jsonResponse({ error: 'sign_failed' }, { status: 500, origin });
  }

  const { error: insertError } = await admin.from('entry_assets').insert({
    id: assetId,
    entry_id: body.entryId,
    user_id: user.id,
    kind,
    storage_path: path,
    mime_type: body.mimeType,
    byte_size: body.byteSize,
    transcription_status: kind === 'audio' ? 'pending' : 'manual_required',
  });
  if (insertError) {
    return jsonResponse({ error: 'asset_record_failed' }, { status: 500, origin });
  }

  await audit(admin, user.id, 'asset.upload_url', 'entry_asset', assetId, {
    kind,
    byteSize: body.byteSize,
  });

  return jsonResponse({ assetId, path, token: signed.token, bucket: limits.bucket }, { origin });
});
