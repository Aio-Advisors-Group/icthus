#!/usr/bin/env node
/**
 * Secret scan.
 *
 * Runs in CI before anything is published. It looks for credential shapes that
 * must never enter this repository — most importantly a Supabase service-role
 * JWT, which would hand an attacker every user's journal.
 *
 * Exits non-zero on any finding.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  '.tsbuild',
]);

const SKIP_FILES = new Set(['package-lock.json', 'secret-scan.mjs']);

const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.sql',
  '.yml',
  '.yaml',
  '.md',
  '.toml',
  '.html',
  '.css',
  '.sh',
  '.env',
  '.example',
  '',
]);

const RULES = [
  {
    id: 'supabase-service-role-jwt',
    // A JWT whose payload declares the service_role. Base64 of
    // "service_role" appears in the middle segment.
    pattern:
      /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*(c2VydmljZV9yb2xl|InNlcnZpY2Vfcm9sZSI)[A-Za-z0-9_-]*\./,
    message: 'Supabase service-role JWT',
  },
  {
    id: 'generic-jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
    message: 'JWT-shaped credential',
  },
  { id: 'openai-key', pattern: /\bsk-[A-Za-z0-9]{32,}\b/, message: 'OpenAI-style API key' },
  { id: 'anthropic-key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/, message: 'Anthropic API key' },
  { id: 'slack-token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/, message: 'Slack token' },
  {
    id: 'discord-bot-token',
    pattern: /\b[MNO][A-Za-z\d_-]{23,}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,}\b/,
    message: 'Discord bot token',
  },
  { id: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, message: 'GitHub token' },
  { id: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/, message: 'AWS access key id' },
  {
    id: 'private-key-block',
    pattern: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
    message: 'Private key block',
  },
  {
    id: 'assigned-secret',
    // KEY=value or KEY: 'value' where the key looks secret and the value is
    // long enough to be real. Empty assignments (the .env.example shape) pass.
    pattern:
      /\b(?:SERVICE_ROLE_KEY|CLIENT_SECRET|BOT_TOKEN|API_KEY|ACCESS_TOKEN|PRIVATE_KEY)\b\s*[:=]\s*['"]?[A-Za-z0-9_\-./+]{16,}['"]?/,
    message: 'Hard-coded secret assignment',
  },
];

/** Lines carrying this marker are known-safe references, not credentials. */
const ALLOW_MARKER = 'secret-scan:allow';

const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full);
      continue;
    }
    if (SKIP_FILES.has(entry)) continue;
    if (!SCAN_EXTENSIONS.has(extname(entry))) continue;
    if (stats.size > 2 * 1024 * 1024) continue;

    const contents = readFileSync(full, 'utf8');
    const lines = contents.split('\n');
    lines.forEach((line, index) => {
      if (line.includes(ALLOW_MARKER)) return;
      for (const rule of RULES) {
        if (rule.pattern.test(line)) {
          findings.push({
            file: relative(root, full),
            line: index + 1,
            rule: rule.id,
            message: rule.message,
          });
        }
      }
    });
  }
}

walk(root);

if (findings.length > 0) {
  console.error('Secret scan failed:\n');
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line} — ${finding.message} [${finding.rule}]`);
  }
  console.error(
    '\nRemove the value, rotate the credential, and store it in Supabase or GitHub Actions secrets.',
  );
  process.exit(1);
}

console.log('Secret scan clean.');
