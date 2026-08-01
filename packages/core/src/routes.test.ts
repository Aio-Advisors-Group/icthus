import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_SPECS,
  DESTINATIONS,
  allowedDeliveryModes,
  findDestination,
  isDeliveryModeAllowed,
  supportsScheduling,
} from './destinations';
import { defaultOutputsFor, isRouteDeliverable, validateRoute, type DeliveryRoute } from './routes';

const context = { memoryEnabled: true, connectedProviderReady: true };

function route(overrides: Partial<DeliveryRoute> = {}): DeliveryRoute {
  return {
    id: 'route-1',
    destinationId: 'slack',
    targetRef: 'C0123456',
    targetLabel: '#devotions',
    enabled: true,
    paused: false,
    timeZone: 'America/Los_Angeles',
    schedule: { frequency: 'daily', time: '07:30' },
    quietHours: { start: '22:00', end: '07:00' },
    outputs: [
      {
        outputType: 'daily_scripture',
        deliveryMode: 'automatic',
        enabled: true,
        rawEntryConsentAt: null,
      },
    ],
    consentAt: '2026-07-31T00:00:00.000Z',
    createdAt: '2026-07-31T00:00:00.000Z',
    revokedAt: null,
    ...overrides,
  };
}

describe('destination capability classification', () => {
  it('never lets a ready-to-share destination be configured to send automatically', () => {
    const shareable = DESTINATIONS.filter((d) => d.capability === 'ready_to_share');
    expect(shareable.length).toBeGreaterThan(0);
    for (const destination of shareable) {
      expect(isDeliveryModeAllowed(destination.id, 'automatic'), destination.name).toBe(false);
    }
  });

  it('classifies the platforms that have no posting API as ready to share', () => {
    for (const id of [
      'imessage',
      'whatsapp',
      'instagram',
      'tiktok',
      'messenger',
      'chatgpt',
      'claude',
    ]) {
      expect(findDestination(id)?.capability, id).toBe('ready_to_share');
    }
  });

  it('classifies iOS widgets as future native work, not an on-device feature', () => {
    for (const id of ['lock_screen_widget', 'home_screen_widget']) {
      expect(findDestination(id)?.capability, id).toBe('future_native');
      expect(supportsScheduling(id), id).toBe(false);
      expect(allowedDeliveryModes(id)).toEqual([]);
    }
  });

  it('does not claim Apple Notes can sync', () => {
    const appleNotes = findDestination('apple_notes');
    expect(appleNotes?.capability).toBe('ready_to_share');
    expect(appleNotes?.limitation).toMatch(/cannot sync/i);
  });

  it('marks only Slack, Discord and Notion as credential-gated connected routes', () => {
    const connected = DESTINATIONS.filter((d) => d.capability === 'connected').map((d) => d.id);
    expect(connected.sort()).toEqual(['discord', 'notion', 'slack']);
    for (const id of connected) {
      expect(CAPABILITY_SPECS.connected.requiresCredentials).toBe(true);
      expect(findDestination(id)?.limitation).toMatch(/mock|configured/i);
    }
  });
});

describe('route validation', () => {
  it('accepts a well-formed connected route', () => {
    expect(validateRoute(route(), context).ok).toBe(true);
  });

  it('refuses to enable a route whose provider has no credentials', () => {
    const result = validateRoute(route(), { ...context, connectedProviderReady: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.field === 'enabled')).toBe(true);
    }
  });

  it('refuses automatic delivery on a ready-to-share destination', () => {
    const result = validateRoute(
      route({
        destinationId: 'whatsapp',
        targetRef: null,
        targetLabel: null,
        outputs: [
          {
            outputType: 'daily_scripture',
            deliveryMode: 'automatic',
            enabled: true,
            rawEntryConsentAt: null,
          },
        ],
      }),
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => /Ready to share/i.test(i.message))).toBe(true);
    }
  });

  it('refuses to enable a route to a future native destination', () => {
    const result = validateRoute(
      route({
        destinationId: 'lock_screen_widget',
        targetRef: null,
        targetLabel: null,
        outputs: [
          {
            outputType: 'daily_scripture',
            deliveryMode: 'prepare_and_prompt',
            enabled: true,
            rawEntryConsentAt: null,
          },
        ],
      }),
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => /native app extension/i.test(i.message))).toBe(true);
    }
  });

  it('requires a second consent before routing a raw journal entry', () => {
    const withoutConsent = validateRoute(
      route({
        outputs: [
          {
            outputType: 'journal_entry',
            deliveryMode: 'automatic',
            enabled: true,
            rawEntryConsentAt: null,
          },
        ],
      }),
      context,
    );
    expect(withoutConsent.ok).toBe(false);

    const withConsent = validateRoute(
      route({
        outputs: [
          {
            outputType: 'journal_entry',
            deliveryMode: 'automatic',
            enabled: true,
            rawEntryConsentAt: '2026-07-31T10:00:00.000Z',
          },
        ],
      }),
      context,
    );
    expect(withConsent.ok).toBe(true);
  });

  it('blocks memory insight routing while Memory is off', () => {
    const result = validateRoute(
      route({
        outputs: [
          {
            outputType: 'memory_insight',
            deliveryMode: 'automatic',
            enabled: true,
            rawEntryConsentAt: null,
          },
        ],
      }),
      { ...context, memoryEnabled: false },
    );
    expect(result.ok).toBe(false);
  });

  it('requires a target channel for a connected route', () => {
    const result = validateRoute(route({ targetRef: null }), context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.field === 'targetRef')).toBe(true);
  });

  it('rejects an unknown timezone', () => {
    const result = validateRoute(route({ timeZone: 'Mars/Olympus' }), context);
    expect(result.ok).toBe(false);
  });

  it('turns nothing on by default', () => {
    for (const destination of DESTINATIONS) {
      const outputs = defaultOutputsFor(destination.id);
      expect(
        outputs.every((o) => !o.enabled),
        destination.name,
      ).toBe(true);
      expect(outputs.every((o) => o.rawEntryConsentAt === null)).toBe(true);
    }
  });
});

describe('route deliverability', () => {
  it('stops delivering the moment a route is paused or revoked', () => {
    expect(isRouteDeliverable(route())).toBe(true);
    expect(isRouteDeliverable(route({ paused: true }))).toBe(false);
    expect(isRouteDeliverable(route({ enabled: false }))).toBe(false);
    expect(isRouteDeliverable(route({ revokedAt: '2026-07-31T11:00:00.000Z' }))).toBe(false);
  });
});
