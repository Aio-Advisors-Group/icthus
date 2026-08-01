/**
 * Scheduled Daily Devotional Companion run.
 *
 * Mirrors the client-side orchestration in packages/core/src/dailyCompanion.ts:
 * read only the consented inputs, retrieve Scripture, compose one bounded
 * question, and persist the whole transcript with an honest provider state.
 *
 * The Gloo call is gated on GLOO_CLIENT_ID/GLOO_CLIENT_SECRET. Without them
 * the run is stored as `degraded` with the question composed but unsent —
 * never as a delivered run.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  adminClient,
  audit,
  checkRateLimit,
  jsonResponse,
  logEvent,
  preflight,
  requireUser,
} from '../_shared/http.ts';

type Settings = {
  user_id: string;
  enabled: boolean;
  schedule: { frequency: string; time?: string };
  time_zone: string;
  inputs: { capture: boolean; journal: boolean; recent: boolean };
  gloo_consent_at: string | null;
};

type EntryRow = {
  id: string;
  body: string;
  source_kind: string;
  created_at: string;
};

const SUMMARY_EXCERPT_LIMIT = 200;

function excerpt(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= SUMMARY_EXCERPT_LIMIT
    ? collapsed
    : `${collapsed.slice(0, SUMMARY_EXCERPT_LIMIT - 1)}…`;
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

function isDue(now: Date, settings: Settings, windowMinutes: number): boolean {
  const [hour, minute] = (settings.schedule.time ?? '07:30').split(':').map(Number);
  const scheduled = (hour ?? 7) * 60 + (minute ?? 30);
  const delta = localMinutes(now, settings.time_zone) - scheduled;
  return delta >= 0 && delta < windowMinutes;
}

/**
 * Minimises what leaves the journal: only today's capture contributes words,
 * and only a bounded excerpt of it. Everything else contributes a count.
 */
function buildInputSummary(
  entries: EntryRow[],
  inputs: Settings['inputs'],
): { summary: string; usedEntryIds: string[]; themeSource: string } {
  const used: string[] = [];
  const parts: string[] = [];
  const themeParts: string[] = [];

  const captures = entries.filter((e) => e.source_kind !== 'imported_note');
  const journals = entries.filter((e) => e.source_kind === 'imported_note');

  if (inputs.capture && captures.length > 0) {
    const latest = captures[0];
    if (latest) {
      used.push(latest.id);
      themeParts.push(latest.body);
      parts.push(`Today’s capture: “${excerpt(latest.body)}”`);
    }
  }
  if (inputs.journal && journals.length > 0) {
    for (const entry of journals) {
      used.push(entry.id);
      themeParts.push(entry.body);
    }
    parts.push(
      `Devotional journal: ${journals.length} imported ${journals.length === 1 ? 'note' : 'notes'} (content not sent).`,
    );
  }
  if (inputs.recent) {
    const rest = captures.slice(1);
    if (rest.length > 0) {
      for (const entry of rest) {
        used.push(entry.id);
        themeParts.push(entry.body);
      }
      parts.push(
        `Last 24 hours: ${rest.length} other ${rest.length === 1 ? 'entry' : 'entries'} (content not sent).`,
      );
    }
  }

  return {
    summary: parts.length > 0 ? parts.join(' ') : 'No inputs were available for this run.',
    usedEntryIds: used,
    themeSource: themeParts.join(' '),
  };
}

const THEME_KEYWORDS: Record<string, string[]> = {
  weariness: ['tired', 'exhausted', 'weary', 'drained', 'burnout', 'stretched'],
  anxiety: ['anxious', 'anxiety', 'worried', 'worry', 'nervous', 'panic'],
  grief: ['grief', 'grieving', 'loss', 'died', 'death', 'heartbroken'],
  gratitude: ['grateful', 'gratitude', 'thankful', 'blessed'],
  loneliness: ['lonely', 'alone', 'isolated'],
  forgiveness: ['forgive', 'bitter', 'resentment', 'grudge'],
  discernment: ['decision', 'decide', 'choice', 'discern', 'unsure'],
  work: ['work', 'job', 'deal', 'client', 'deadline'],
  fear: ['afraid', 'fear', 'scared'],
  hope: ['hope', 'hopeful'],
};

function extractThemes(text: string): string[] {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')} `;
  const found: { theme: string; hits: number }[] = [];
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    let hits = 0;
    for (const keyword of keywords) {
      const matches = haystack.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) hits += matches.length;
    }
    if (hits > 0) found.push({ theme, hits });
  }
  found.sort((a, b) => b.hits - a.hits || a.theme.localeCompare(b.theme));
  return found.length > 0 ? found.map((f) => f.theme) : ['hope'];
}

async function retrievePassage(
  admin: SupabaseClient,
  themes: string[],
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .from('scripture_sources')
    .select('*')
    .eq('approval_status', 'approved')
    .overlaps('themes', themes)
    .limit(1);
  if (data && data.length > 0) return data[0] as Record<string, unknown>;

  const { data: fallback } = await admin
    .from('scripture_sources')
    .select('*')
    .eq('approval_status', 'approved')
    .limit(1);
  return (fallback?.[0] as Record<string, unknown>) ?? null;
}

function composeQuestion(
  passage: Record<string, unknown>,
  themes: string[],
  summary: string,
): string {
  const translation = passage.translation as { abbreviation?: string } | null;
  const primary = themes[0] ?? 'what this person is carrying';
  return [
    `A person brought this to reflection today: ${summary}`,
    `Reading ${passage.reference} (${translation?.abbreviation ?? 'WEB'}): “${passage.body}”`,
    `In historic Christian teaching, how might this passage speak to ${primary}?`,
    'Ground the answer in Scripture and named sources. Do not claim certainty about God’s will for this person, and do not offer clinical or crisis advice.',
  ].join('\n\n');
}

type GlooCompletion = {
  answer: string;
  citations: { label: string; url: string | null }[];
  providerState: 'live' | 'unavailable';
  modelVersion: string | null;
  receivedAt: string;
  errorCode: string | null;
};

let glooToken: { value: string; expiresAt: number } | null = null;

async function glooAccessToken(): Promise<string> {
  if (glooToken && glooToken.expiresAt > Date.now() + 60_000) return glooToken.value;
  const clientId = Deno.env.get('GLOO_CLIENT_ID');
  const clientSecret = Deno.env.get('GLOO_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Gloo credentials are not configured');
  const tokenUrl = Deno.env.get('GLOO_TOKEN_URL') ?? 'https://platform.ai.gloo.com/oauth2/token';
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: Deno.env.get('GLOO_SCOPES') ?? 'api/access',
    }),
  });
  if (!response.ok) throw new Error(`Gloo token request failed (${response.status})`);
  const payload = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
    throw new Error('Gloo token response did not include an access token');
  }
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
  glooToken = { value: payload.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return glooToken.value;
}

async function askGloo(
  question: string,
  passage: Record<string, unknown>,
): Promise<GlooCompletion> {
  const receivedAt = new Date().toISOString();
  try {
    const token = await glooAccessToken();
    const apiBaseUrl = Deno.env.get('GLOO_API_BASE_URL') ?? 'https://platform.ai.gloo.com/ai/v2';
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              'You are a humble Christian study companion. Stay grounded in the supplied passage. Do not claim divine instruction, diagnose, provide crisis advice, or invent sources. Give a concise, invitation-framed response.',
          },
          { role: 'user', content: question },
        ],
        auto_routing: true,
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(`Gloo completion request failed (${response.status})`);
    const payload = (await response.json()) as {
      model?: unknown;
      choices?: { message?: { content?: unknown } }[];
    };
    const answer = payload.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || answer.trim().length === 0) {
      throw new Error('Gloo completion response did not include content');
    }
    const translation = passage.translation as { abbreviation?: string } | null;
    return {
      answer: answer.trim(),
      citations: [
        {
          label: `${String(passage.reference)} (${translation?.abbreviation ?? 'WEB'})`,
          url: null,
        },
      ],
      providerState: 'live',
      modelVersion: typeof payload.model === 'string' ? payload.model : null,
      receivedAt,
      errorCode: null,
    };
  } catch {
    // Provider errors are represented in the private transcript, while logs
    // intentionally omit the person's question, passage, and generated text.
    return {
      answer: '',
      citations: [],
      providerState: 'unavailable',
      modelVersion: null,
      receivedAt,
      errorCode: 'gloo_request_failed',
    };
  }
}

Deno.serve(async (request: Request) => {
  const cors = preflight(request);
  if (cors) return cors;

  const origin = request.headers.get('origin');
  const secret = Deno.env.get('ICTHUS_SCHEDULER_SECRET');
  const scheduled = Boolean(secret && request.headers.get('x-scheduler-secret') === secret);
  const caller = scheduled ? null : await requireUser(request);
  if (!scheduled && !caller) {
    return jsonResponse({ error: 'unauthorised' }, { status: 401, origin });
  }

  const admin = adminClient();
  if (caller) {
    const rate = await checkRateLimit(admin, caller.id, 'companion.manual_run', 10, 3600);
    if (!rate.allowed) {
      return jsonResponse(
        { error: 'rate_limited', retryAfterSeconds: rate.retryAfterSeconds },
        { status: 429, origin },
      );
    }
  }
  const now = new Date();
  const windowMinutes = Number(Deno.env.get('ICTHUS_DISPATCH_WINDOW_MINUTES') ?? '15');
  const glooConfigured =
    Boolean(Deno.env.get('GLOO_CLIENT_ID')) && Boolean(Deno.env.get('GLOO_CLIENT_SECRET'));

  let settingsQuery = admin.from('daily_companion_settings').select('*');
  settingsQuery = caller
    ? settingsQuery.eq('user_id', caller.id)
    : settingsQuery.eq('enabled', true);
  const { data: allSettings, error } = await settingsQuery;

  if (error) {
    logEvent('companion.query_failed', { code: error.code ?? 'unknown' });
    return jsonResponse({ error: 'query_failed' }, { status: 500, origin });
  }

  let runs = 0;

  for (const settings of (allSettings ?? []) as Settings[]) {
    if (scheduled && !isDue(now, settings, windowMinutes)) continue;

    const selection = (['capture', 'journal', 'recent'] as const).filter(
      (kind) => settings.inputs[kind],
    );

    const startedAt = new Date().toISOString();

    if (selection.length === 0) {
      await admin.from('daily_companion_runs').insert({
        user_id: settings.user_id,
        status: 'blocked',
        trigger: scheduled ? 'scheduled' : 'manual',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        input_selection: [],
        input_summary: 'No inputs are selected, so there was nothing for Icthus to read.',
        used_entry_ids: [],
        scripture_provider_state: 'mock',
        gloo_provider_state: 'not_consented',
        degraded_reason: 'No inputs are selected, so there was nothing for Icthus to read.',
      });
      runs += 1;
      continue;
    }

    const since = new Date(now.getTime() - 86_400_000).toISOString();
    const { data: entries } = await admin
      .from('entries')
      .select('id, body, source_kind, created_at')
      .eq('user_id', settings.user_id)
      .is('deleted_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);

    const { summary, usedEntryIds, themeSource } = buildInputSummary(
      (entries ?? []) as EntryRow[],
      settings.inputs,
    );
    const themes = extractThemes(themeSource);
    const passage = await retrievePassage(admin, themes);

    if (!passage) {
      await admin.from('daily_companion_runs').insert({
        user_id: settings.user_id,
        status: 'degraded',
        trigger: scheduled ? 'scheduled' : 'manual',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        input_selection: selection,
        input_summary: summary,
        used_entry_ids: usedEntryIds,
        scripture_provider_state: 'unavailable',
        gloo_provider_state: 'not_consented',
        degraded_reason:
          'Scripture could not be retrieved, so no question was sent. Your input has been kept.',
      });
      runs += 1;
      continue;
    }

    const question = composeQuestion(passage, themes, summary);
    const passageJson = {
      sourceId: passage.id,
      reference: passage.reference,
      canonical: passage.canonical,
      text: passage.body,
      context: passage.context,
      translation: passage.translation,
      attribution: passage.attribution,
      provider: passage.provider,
      providerState: 'mock',
      canonicalUrl: passage.canonical_url,
    };

    // Two gates before anything leaves: the person's purpose-specific consent,
    // and real provider credentials. Either missing means a degraded run.
    let glooResponse: GlooCompletion | null = null;
    if (settings.gloo_consent_at && glooConfigured) {
      glooResponse = await askGloo(question, passage);
    }
    const degradedReason = !settings.gloo_consent_at
      ? 'You have not allowed Icthus to send anything to Gloo, so the question below was composed but not sent.'
      : !glooConfigured
        ? 'Gloo is not configured on the server, so the question below was composed but not sent.'
        : glooResponse?.providerState !== 'live'
          ? 'Gloo could not complete this run. Your input has been kept and nothing will be retried automatically.'
          : null;

    await admin.from('daily_companion_runs').insert({
      user_id: settings.user_id,
      status: degradedReason ? 'degraded' : 'succeeded',
      trigger: scheduled ? 'scheduled' : 'manual',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      input_selection: selection,
      input_summary: summary,
      used_entry_ids: usedEntryIds,
      passage: passageJson,
      question,
      gloo_response: glooResponse,
      scripture_provider_state: 'mock',
      gloo_provider_state: !settings.gloo_consent_at
        ? 'not_consented'
        : (glooResponse?.providerState ?? 'unavailable'),
      degraded_reason: degradedReason,
    });

    await audit(admin, settings.user_id, 'companion.run', 'daily_companion_run', null, {
      inputs: selection.length,
      themes: themes.length,
      glooConfigured,
    });
    if (caller) {
      await audit(admin, caller.id, 'companion.manual_run', 'daily_companion_run', null, {});
    }
    runs += 1;
  }

  logEvent('companion.completed', { runs });
  return jsonResponse({ runs }, { origin });
});
