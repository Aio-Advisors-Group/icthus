/**
 * Destination capability rules, for the Deno runtime.
 *
 * This is a deliberate, minimal mirror of `packages/core/src/destinations.ts`.
 * Edge Functions run in Deno and cannot import the bundler-resolved workspace
 * package, so rather than pretend otherwise, the subset the delivery job
 * actually needs is duplicated here — and
 * `packages/core/src/capabilityMirror.test.ts` fails the build if the two ever
 * disagree.
 *
 * See docs/adr/0004-edge-function-capability-mirror.md.
 */

export type CapabilityClass =
  'in_app' | 'on_device' | 'connected' | 'ready_to_share' | 'future_native';

/** destination id -> capability class. Must match the core catalog exactly. */
export const DESTINATION_CAPABILITIES: Record<string, CapabilityClass> = {
  icthus_saved: 'in_app',
  icthus_notification: 'on_device',
  apple_notes: 'ready_to_share',
  notion: 'connected',
  calendar: 'ready_to_share',
  sermon_notes: 'ready_to_share',
  church_app: 'ready_to_share',
  family_group: 'ready_to_share',
  chatgpt: 'ready_to_share',
  claude: 'ready_to_share',
  slack: 'connected',
  discord: 'connected',
  imessage: 'ready_to_share',
  whatsapp: 'ready_to_share',
  messenger: 'ready_to_share',
  instagram: 'ready_to_share',
  tiktok: 'ready_to_share',
  lock_screen_widget: 'future_native',
  home_screen_widget: 'future_native',
};

/**
 * Only these classes may ever be delivered by the server. A route pointing
 * anywhere else is skipped with a reason code rather than attempted.
 */
export const SERVER_DELIVERABLE: ReadonlySet<CapabilityClass> = new Set(['connected']);

export function capabilityOf(destinationId: string): CapabilityClass | null {
  return DESTINATION_CAPABILITIES[destinationId] ?? null;
}

export function isServerDeliverable(destinationId: string): boolean {
  const capability = capabilityOf(destinationId);
  return capability !== null && SERVER_DELIVERABLE.has(capability);
}

/** Which provider secret a connected destination requires. */
export const CONNECTED_SECRET_NAMES: Record<string, string> = {
  slack: 'SLACK_BOT_TOKEN',
  discord: 'DISCORD_BOT_TOKEN',
  notion: 'NOTION_TOKEN',
};

export function connectedProviderConfigured(destinationId: string): boolean {
  const name = CONNECTED_SECRET_NAMES[destinationId];
  if (!name) return false;
  const value = Deno.env.get(name);
  return typeof value === 'string' && value.length > 0;
}
