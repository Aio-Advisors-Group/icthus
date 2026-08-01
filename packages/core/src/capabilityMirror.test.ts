import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './destinations';

/**
 * Edge Functions run in Deno and cannot import this package, so
 * `supabase/functions/_shared/capabilities.ts` keeps its own copy of the
 * destination-to-capability mapping. That duplication is only safe if it is
 * enforced — a destination that is "ready to share" in the app and "connected"
 * on the server would be exactly the dishonesty this catalog exists to prevent.
 *
 * This test parses the Deno file and asserts the two agree.
 */

// Vitest runs from the repository root, so the mirror is addressed from there
// rather than from import.meta.url (which is not a file: URL under jsdom).
const mirrorPath = resolve(process.cwd(), 'supabase/functions/_shared/capabilities.ts');

function parseMirror(): Record<string, string> {
  const source = readFileSync(mirrorPath, 'utf8');
  const block =
    /DESTINATION_CAPABILITIES:\s*Record<string,\s*CapabilityClass>\s*=\s*\{([\s\S]*?)\n\};/.exec(
      source,
    );
  if (!block || !block[1]) throw new Error('Could not find DESTINATION_CAPABILITIES in the mirror');

  const entries: Record<string, string> = {};
  for (const line of block[1].split('\n')) {
    const match = /^\s*([a-z_]+):\s*'([a-z_]+)',\s*$/.exec(line);
    if (match && match[1] && match[2]) entries[match[1]] = match[2];
  }
  return entries;
}

describe('edge function capability mirror', () => {
  it('covers exactly the destinations in the core catalog', () => {
    const mirror = parseMirror();
    const expected = DESTINATIONS.map((d) => d.id).sort();
    expect(Object.keys(mirror).sort()).toEqual(expected);
  });

  it('assigns every destination the same capability class as the catalog', () => {
    const mirror = parseMirror();
    for (const destination of DESTINATIONS) {
      expect(mirror[destination.id], `${destination.id} capability drifted`).toBe(
        destination.capability,
      );
    }
  });
});
