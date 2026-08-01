#!/usr/bin/env node
/**
 * Generates supabase/seed.sql from the canonical corpus in packages/core.
 *
 * The corpus is defined once, in TypeScript, and the database seed is derived
 * from it. Hand-maintaining both would guarantee drift, and drift in a source
 * corpus means citations that no longer resolve.
 *
 * Run: node scripts/generate-seed.mjs
 */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = mkdtempSync(join(tmpdir(), 'icthus-seed-'));

try {
  const bundlePath = join(outDir, 'corpus.mjs');
  await build({
    entryPoints: [resolve(root, 'packages/core/src/corpus.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: bundlePath,
    logLevel: 'silent',
  });

  const { SCRIPTURE_CORPUS, SUPPORTING_SOURCE_CORPUS } = await import(
    pathToFileURL(bundlePath).href
  );

  /** Single-quote escaping for SQL string literals. */
  const q = (value) =>
    value === null || value === undefined ? 'null' : `'${String(value).replace(/'/g, "''")}'`;
  const json = (value) => `${q(JSON.stringify(value))}::jsonb`;
  const arr = (values) =>
    values.length === 0 ? "'{}'::text[]" : `array[${values.map((v) => q(v)).join(', ')}]::text[]`;

  const lines = [
    '-- GENERATED FILE — do not edit by hand.',
    '-- Source: packages/core/src/corpus.ts',
    '-- Regenerate: node scripts/generate-seed.mjs',
    '--',
    '-- Everything seeded here is public domain. Copyrighted Bible text and',
    '-- licensed translations must never be added to this file; they come from',
    '-- the YouVersion adapter at runtime under that provider’s terms.',
    '',
    'insert into public.scripture_sources',
    '  (id, reference, canonical, body, context, translation, attribution, provider, canonical_url, themes, approval_status, version)',
    'values',
  ];

  const scriptureRows = SCRIPTURE_CORPUS.map(
    (p) =>
      `  (${q(p.sourceId)}, ${q(p.reference)}, ${json(p.canonical)}, ${q(p.text)}, ${q(p.context)}, ` +
      `${json(p.translation)}, ${q(p.attribution)}, 'local-web-corpus', ${q(p.canonicalUrl)}, ` +
      `${arr([...p.themes])}, 'approved', 1)`,
  );
  lines.push(scriptureRows.join(',\n'));
  lines.push('on conflict (id) do update set');
  lines.push('  reference = excluded.reference,');
  lines.push('  canonical = excluded.canonical,');
  lines.push('  body = excluded.body,');
  lines.push('  context = excluded.context,');
  lines.push('  translation = excluded.translation,');
  lines.push('  attribution = excluded.attribution,');
  lines.push('  canonical_url = excluded.canonical_url,');
  lines.push('  themes = excluded.themes,');
  lines.push('  version = public.scripture_sources.version + 1;');
  lines.push('');

  lines.push('insert into public.supporting_sources');
  lines.push(
    '  (id, kind, title, author, locator, edition, excerpt, tradition, canonical_url, rights, approval_status)',
  );
  lines.push('values');
  const supportRows = SUPPORTING_SOURCE_CORPUS.map(
    (s) =>
      `  (${q(s.sourceId)}, ${q(s.kind)}, ${q(s.title)}, ${q(s.author)}, ${q(s.locator)}, ` +
      `${q(s.edition)}, ${q(s.excerpt)}, ${q(s.tradition)}, ${q(s.canonicalUrl)}, ${q(s.rights)}, 'approved')`,
  );
  lines.push(supportRows.join(',\n'));
  lines.push('on conflict (id) do update set');
  lines.push('  title = excluded.title,');
  lines.push('  author = excluded.author,');
  lines.push('  locator = excluded.locator,');
  lines.push('  edition = excluded.edition,');
  lines.push('  excerpt = excluded.excerpt,');
  lines.push('  tradition = excluded.tradition,');
  lines.push('  canonical_url = excluded.canonical_url,');
  lines.push('  rights = excluded.rights;');
  lines.push('');

  const flags = [
    ['youversion', 'Use the YouVersion Platform API instead of the local public-domain corpus.'],
    ['gloo', 'Use the Gloo AI Studio API for the Daily Devotional Companion.'],
    ['companion_llm', 'Generate companion responses server-side instead of deterministically.'],
    ['transcription', 'Server-side speech-to-text for voice reflections.'],
    ['ocr', 'Photo capture and OCR extraction.'],
    ['connected_delivery', 'Server-side delivery to Slack, Discord and Notion.'],
  ];
  lines.push('insert into public.feature_flags (id, enabled, description)');
  lines.push('values');
  lines.push(
    flags.map(([id, description]) => `  (${q(id)}, false, ${q(description)})`).join(',\n'),
  );
  lines.push('on conflict (id) do update set description = excluded.description;');
  lines.push('');

  const seedPath = resolve(root, 'supabase/seed.sql');
  writeFileSync(seedPath, lines.join('\n'));
  console.log(
    `Wrote supabase/seed.sql — ${SCRIPTURE_CORPUS.length} passages, ${SUPPORTING_SOURCE_CORPUS.length} supporting sources, ${flags.length} flags`,
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
