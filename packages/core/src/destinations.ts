/**
 * The Icthus Everywhere destination catalog.
 *
 * The catalog is deliberately larger than the set of things Icthus can
 * actually automate. A person should be able to see the place they care about
 * — WhatsApp, their lock screen, a family thread — and get a straight answer
 * about what Icthus can and cannot do there.
 *
 * That answer is the `capability` field, and it is enforced, not decorative:
 * `allowedDeliveryModes()` derives from it, so a "ready to share" destination
 * cannot be configured for automatic delivery no matter what the UI does.
 */

export const CAPABILITY_CLASSES = [
  'in_app',
  'on_device',
  'connected',
  'ready_to_share',
  'future_native',
] as const;
export type CapabilityClass = (typeof CAPABILITY_CLASSES)[number];

export const DELIVERY_MODES = ['automatic', 'prepare_and_prompt', 'manual_share'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const OUTPUT_TYPES = [
  'daily_scripture',
  'reflection',
  'prayer_prompt',
  'memory_insight',
  'journal_entry',
] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

export type OutputTypeSpec = {
  id: OutputType;
  label: string;
  description: string;
  /**
   * Routing a raw journal entry needs a second, explicit consent every time.
   * It is never part of a default selection.
   */
  requiresSeparateConsent: boolean;
  sensitive: boolean;
};

export const OUTPUT_TYPE_SPECS: readonly OutputTypeSpec[] = [
  {
    id: 'daily_scripture',
    label: 'Daily Scripture',
    description: 'A passage with its reference and translation attribution.',
    requiresSeparateConsent: false,
    sensitive: false,
  },
  {
    id: 'reflection',
    label: 'Companion reflection',
    description: 'The short reflection Icthus wrote alongside a passage.',
    requiresSeparateConsent: false,
    sensitive: false,
  },
  {
    id: 'prayer_prompt',
    label: 'Prayer prompt',
    description: 'A short prompt to pray, without your written content.',
    requiresSeparateConsent: false,
    sensitive: false,
  },
  {
    id: 'memory_insight',
    label: 'Memory insight',
    description: 'A theme Icthus noticed across your saved reflections. Requires Memory to be on.',
    requiresSeparateConsent: false,
    sensitive: false,
  },
  {
    id: 'journal_entry',
    label: 'Journal entry or excerpt',
    description:
      'Your own words, as you wrote them. This is the most sensitive thing Icthus holds.',
    requiresSeparateConsent: true,
    sensitive: true,
  },
] as const;

export type CapabilitySpec = {
  id: CapabilityClass;
  label: string;
  /** Shown on every destination card in this class. Plain language, no spin. */
  summary: string;
  allowedDeliveryModes: readonly DeliveryMode[];
  /** True when a real OAuth app / API credential is required before enabling. */
  requiresCredentials: boolean;
};

export const CAPABILITY_SPECS: Record<CapabilityClass, CapabilitySpec> = {
  in_app: {
    id: 'in_app',
    label: 'In Icthus',
    summary: 'Stays inside Icthus, on your account. Nothing leaves the app.',
    allowedDeliveryModes: ['automatic'],
    requiresCredentials: false,
  },
  on_device: {
    id: 'on_device',
    label: 'On this device',
    summary:
      'Uses a web notification from the installed app. It needs notification permission and only works while the app is installed on this device.',
    allowedDeliveryModes: ['automatic', 'prepare_and_prompt'],
    requiresCredentials: false,
  },
  connected: {
    id: 'connected',
    label: 'Connected',
    summary:
      'Icthus can post here automatically once you authorise it, and only to the channel you pick.',
    allowedDeliveryModes: ['automatic', 'prepare_and_prompt'],
    requiresCredentials: true,
  },
  ready_to_share: {
    id: 'ready_to_share',
    label: 'Ready to share',
    summary:
      'Icthus prepares a card for you to send. It cannot post here on its own and has no access to your account there.',
    allowedDeliveryModes: ['prepare_and_prompt', 'manual_share'],
    requiresCredentials: false,
  },
  future_native: {
    id: 'future_native',
    label: 'Future native extension',
    summary:
      'This needs a native iOS app extension that Icthus does not ship yet. A web app cannot provide it.',
    allowedDeliveryModes: [],
    requiresCredentials: false,
  },
};

export const DESTINATION_GROUPS = [
  'Productivity',
  'AI Assistants',
  'Messaging',
  'Social',
  'On your device',
] as const;
export type DestinationGroup = (typeof DESTINATION_GROUPS)[number];

export type DestinationSpec = {
  id: string;
  name: string;
  group: DestinationGroup;
  capability: CapabilityClass;
  /** One line describing what actually happens. Never aspirational. */
  description: string;
  /**
   * The specific limitation a person should know before enabling. Rendered
   * verbatim in the route editor.
   */
  limitation: string;
  /** Output types this destination is allowed to carry at all. */
  supportedOutputs: readonly OutputType[];
  /** Glyph from the prototype's restrained symbol set — not a brand asset. */
  glyph: string;
};

const ALL_OUTPUTS: readonly OutputType[] = OUTPUT_TYPES;
const SHAREABLE_OUTPUTS: readonly OutputType[] = [
  'daily_scripture',
  'reflection',
  'prayer_prompt',
  'memory_insight',
  'journal_entry',
];
const GLANCEABLE_OUTPUTS: readonly OutputType[] = ['daily_scripture', 'prayer_prompt'];

export const DESTINATIONS: readonly DestinationSpec[] = [
  {
    id: 'icthus_saved',
    name: 'Your Saved collection',
    group: 'Productivity',
    capability: 'in_app',
    description: 'Keep each day’s passage and prayer in Icthus, where only you can read it.',
    limitation: 'Stays on your Icthus account. Nothing is sent anywhere else.',
    supportedOutputs: ALL_OUTPUTS,
    glyph: '♡',
  },
  {
    id: 'icthus_notification',
    name: 'Icthus notification',
    group: 'On your device',
    capability: 'on_device',
    description: 'A quiet notification from the installed app at the time you choose.',
    limitation:
      'Requires notification permission and the app installed to your home screen. Notifications will not arrive if you clear site data or uninstall.',
    supportedOutputs: GLANCEABLE_OUTPUTS,
    glyph: '◔',
  },
  {
    id: 'apple_notes',
    name: 'Apple Notes',
    group: 'Productivity',
    capability: 'ready_to_share',
    description: 'Send a formatted card to Notes through the system share sheet.',
    limitation:
      'Icthus cannot sync with Apple Notes, read your notes, or write to them in the background. Importing a note into Icthus is also something you do by hand, each time.',
    supportedOutputs: SHAREABLE_OUTPUTS,
    glyph: '✎',
  },
  {
    id: 'notion',
    name: 'Notion',
    group: 'Productivity',
    capability: 'connected',
    description: 'Append reflections to a page you choose, once you authorise Icthus.',
    limitation:
      'Needs a Notion OAuth integration. Until that is configured, this route runs against a development mock and delivers nothing.',
    supportedOutputs: ALL_OUTPUTS,
    glyph: '▤',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    group: 'Productivity',
    capability: 'ready_to_share',
    description: 'Download a calendar file for a daily reflection time.',
    limitation:
      'Icthus generates a calendar file you add yourself. It has no access to your calendar and cannot create or read events.',
    supportedOutputs: GLANCEABLE_OUTPUTS,
    glyph: '▦',
  },
  {
    id: 'sermon_notes',
    name: 'Sermon Notes',
    group: 'Productivity',
    capability: 'ready_to_share',
    description: 'Prepare a card to paste into whatever you take sermon notes in.',
    limitation: 'A generic export. Icthus has no connection to any specific notes app.',
    supportedOutputs: SHAREABLE_OUTPUTS,
    glyph: '✒',
  },
  {
    id: 'church_app',
    name: 'Church App',
    group: 'Productivity',
    capability: 'ready_to_share',
    description: 'Prepare a card to share into your church’s app or group.',
    limitation:
      'Church apps do not offer a common API. Icthus prepares the text; sending it is yours to do. Icthus never contacts a church on your behalf.',
    supportedOutputs: SHAREABLE_OUTPUTS,
    glyph: '⌂',
  },
  {
    id: 'family_group',
    name: 'Family Group',
    group: 'Messaging',
    capability: 'ready_to_share',
    description: 'Prepare a card to send to a family thread.',
    limitation: 'Icthus does not know who is in your family and cannot message anyone for you.',
    supportedOutputs: SHAREABLE_OUTPUTS,
    glyph: '◔',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    group: 'AI Assistants',
    capability: 'ready_to_share',
    description: 'Copy today’s passage and question into a thread you are already in.',
    limitation:
      'Icthus generates a block for you to paste. It has no access to your ChatGPT account or threads.',
    supportedOutputs: SHAREABLE_OUTPUTS,
    glyph: '✳',
  },
  {
    id: 'claude',
    name: 'Claude',
    group: 'AI Assistants',
    capability: 'ready_to_share',
    description: 'Copy today’s passage and question into a Claude conversation.',
    limitation:
      'Icthus generates a block for you to paste. It has no access to your Claude account or conversations.',
    supportedOutputs: SHAREABLE_OUTPUTS,
    glyph: '◈',
  },
  {
    id: 'slack',
    name: 'Slack',
    group: 'Messaging',
    capability: 'connected',
    description: 'Post to one channel or DM you authorise, on your schedule.',
    limitation:
      'Needs a Slack app with OAuth credentials. Until those exist this route runs against a development mock and delivers nothing.',
    supportedOutputs: ALL_OUTPUTS,
    glyph: '▥',
  },
  {
    id: 'discord',
    name: 'Discord',
    group: 'Messaging',
    capability: 'connected',
    description: 'Post to one channel you authorise, on your schedule.',
    limitation:
      'Needs a Discord application with a bot token and scoped permissions. Until those exist this route runs against a development mock and delivers nothing.',
    supportedOutputs: ALL_OUTPUTS,
    glyph: '◐',
  },
  {
    id: 'imessage',
    name: 'iMessage',
    group: 'Messaging',
    capability: 'ready_to_share',
    description: 'Open the share sheet with a card ready to send.',
    limitation:
      'iMessage has no API for third-party apps to send messages. This is a share-sheet action you complete yourself, every time.',
    supportedOutputs: SHAREABLE_OUTPUTS,
    glyph: '✉',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    group: 'Messaging',
    capability: 'ready_to_share',
    description: 'Open WhatsApp with a card ready to send.',
    limitation:
      'Sending on your behalf would require WhatsApp Business API approval, which Icthus does not have. You send it.',
    supportedOutputs: SHAREABLE_OUTPUTS,
    glyph: '☏',
  },
  {
    id: 'messenger',
    name: 'Messenger',
    group: 'Messaging',
    capability: 'ready_to_share',
    description: 'Open the share sheet with a card ready to send.',
    limitation: 'Icthus cannot post to Messenger or access your conversations.',
    supportedOutputs: SHAREABLE_OUTPUTS,
    glyph: '➤',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    group: 'Social',
    capability: 'ready_to_share',
    description: 'Save a verse card you can add to a story yourself.',
    limitation:
      'Instagram does not permit third-party apps to post to a personal account. Icthus makes the image; posting is yours.',
    supportedOutputs: ['daily_scripture', 'prayer_prompt'],
    glyph: '◫',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    group: 'Social',
    capability: 'ready_to_share',
    description: 'Save a verse card you can use in a post yourself.',
    limitation: 'Icthus cannot post to TikTok or access your account.',
    supportedOutputs: ['daily_scripture', 'prayer_prompt'],
    glyph: '♪',
  },
  {
    id: 'lock_screen_widget',
    name: 'Lock Screen widget',
    group: 'On your device',
    capability: 'future_native',
    description: 'A glanceable passage on your lock screen.',
    limitation:
      'iOS Lock Screen widgets require a native WidgetKit extension shipped in a native app. An installed web app cannot provide one, and Icthus will not pretend otherwise. Tracked as future work.',
    supportedOutputs: GLANCEABLE_OUTPUTS,
    glyph: '▭',
  },
  {
    id: 'home_screen_widget',
    name: 'Home Screen widget',
    group: 'On your device',
    capability: 'future_native',
    description: 'A passage and prompt on your home screen.',
    limitation:
      'iOS Home Screen widgets require a native WidgetKit extension. Adding Icthus to your home screen installs the app; it does not create a widget. Tracked as future work.',
    supportedOutputs: GLANCEABLE_OUTPUTS,
    glyph: '▢',
  },
] as const;

export function findDestination(id: string): DestinationSpec | null {
  return DESTINATIONS.find((d) => d.id === id) ?? null;
}

export function destinationsByGroup(): { group: DestinationGroup; items: DestinationSpec[] }[] {
  return DESTINATION_GROUPS.map((group) => ({
    group,
    items: DESTINATIONS.filter((d) => d.group === group),
  })).filter((section) => section.items.length > 0);
}

export function allowedDeliveryModes(destinationId: string): readonly DeliveryMode[] {
  const destination = findDestination(destinationId);
  if (!destination) return [];
  return CAPABILITY_SPECS[destination.capability].allowedDeliveryModes;
}

/** A destination that can never deliver on its own cannot be scheduled. */
export function supportsScheduling(destinationId: string): boolean {
  return allowedDeliveryModes(destinationId).length > 0;
}

export function isDeliveryModeAllowed(destinationId: string, mode: DeliveryMode): boolean {
  return allowedDeliveryModes(destinationId).includes(mode);
}

export function outputTypeSpec(id: OutputType): OutputTypeSpec {
  const spec = OUTPUT_TYPE_SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`Unknown output type: ${id}`);
  return spec;
}

export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = {
  automatic: 'Send automatically',
  prepare_and_prompt: 'Prepare it and remind me',
  manual_share: 'I’ll share it myself',
};

export const CAPABILITY_BADGE: Record<CapabilityClass, string> = {
  in_app: 'In Icthus',
  on_device: 'On this device',
  connected: 'Connected',
  ready_to_share: 'Ready to share',
  future_native: 'Future native extension',
};

/**
 * Badge text for the *catalog*, where nothing has been set up yet.
 *
 * `connected` deliberately reads "Needs connecting" here rather than
 * "Connected": in a browse list, the class name alone would look like a
 * statement that the destination is already live, which is the exact
 * misreading this catalog exists to prevent.
 */
export const CAPABILITY_CATALOG_BADGE: Record<CapabilityClass, string> = {
  ...CAPABILITY_BADGE,
  connected: 'Needs connecting',
};
