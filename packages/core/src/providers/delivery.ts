import type { ProviderState } from '../contracts';
import type { CapabilityClass, OutputType } from '../destinations';
import { CAPABILITY_SPECS, findDestination } from '../destinations';
import type { DeliveryEventStatus } from '../routes';

/**
 * Delivery adapters.
 *
 * Each capability class gets its own adapter, and the adapter physically
 * cannot do more than its class allows. A "ready to share" destination has no
 * code path that posts anything; the best it can return is `prepared`.
 */

export type DeliveryPayload = {
  routeId: string;
  outputType: OutputType;
  title: string;
  body: string;
  /** Scripture reference and attribution, when the payload carries a passage. */
  reference: string | null;
  attribution: string | null;
  /** Prevents a retry from double-sending. */
  idempotencyKey: string;
  targetRef: string | null;
};

export type DeliveryOutcome = {
  status: DeliveryEventStatus;
  /** A code, never content. Delivery logs stay content-free. */
  reasonCode: string | null;
  providerState: ProviderState;
};

export interface DestinationProvider {
  readonly id: string;
  readonly capability: CapabilityClass;
  readonly state: ProviderState;
  deliver(payload: DeliveryPayload): Promise<DeliveryOutcome>;
}

/** Renders the text a person actually sees or sends. */
export function buildShareCard(payload: DeliveryPayload): string {
  const lines = [payload.title, '', payload.body];
  if (payload.reference) {
    lines.push('', `— ${payload.reference}`);
  }
  if (payload.attribution) {
    lines.push(payload.attribution);
  }
  lines.push('', 'Shared from Icthus');
  return lines.join('\n');
}

/** Stays inside Icthus. The only adapter that always succeeds. */
export class InAppDeliveryProvider implements DestinationProvider {
  readonly id = 'icthus_saved';
  readonly capability: CapabilityClass = 'in_app';
  readonly state: ProviderState = 'live';

  constructor(private readonly save: (payload: DeliveryPayload) => Promise<void> | void) {}

  async deliver(payload: DeliveryPayload): Promise<DeliveryOutcome> {
    await this.save(payload);
    return { status: 'delivered', reasonCode: null, providerState: 'live' };
  }
}

export type NotificationCapableWindow = {
  Notification?: {
    permission: NotificationPermission;
    new (title: string, options?: NotificationOptions): Notification;
  };
};

/**
 * Web notification from the installed PWA.
 *
 * Honest about its limits: without granted permission it reports `skipped`
 * with a reason rather than silently doing nothing.
 */
export class WebNotificationDeliveryProvider implements DestinationProvider {
  readonly id = 'icthus_notification';
  readonly capability: CapabilityClass = 'on_device';
  readonly state: ProviderState = 'live';

  constructor(private readonly host: NotificationCapableWindow) {}

  async deliver(payload: DeliveryPayload): Promise<DeliveryOutcome> {
    const NotificationCtor = this.host.Notification;
    if (!NotificationCtor) {
      return {
        status: 'skipped',
        reasonCode: 'notifications_unsupported',
        providerState: 'unavailable',
      };
    }
    if (NotificationCtor.permission !== 'granted') {
      return {
        status: 'skipped',
        reasonCode: 'notification_permission_missing',
        providerState: 'unavailable',
      };
    }
    new NotificationCtor(payload.title, { body: payload.body, tag: payload.idempotencyKey });
    return { status: 'delivered', reasonCode: null, providerState: 'live' };
  }
}

/**
 * Prepares a card and stops. There is deliberately no network call in this
 * class — the platform does not permit one, so the code does not pretend to.
 */
export class ShareCardDeliveryProvider implements DestinationProvider {
  readonly capability: CapabilityClass = 'ready_to_share';
  readonly state: ProviderState = 'live';

  constructor(
    readonly id: string,
    private readonly onPrepared: (card: string, payload: DeliveryPayload) => Promise<void> | void,
  ) {}

  async deliver(payload: DeliveryPayload): Promise<DeliveryOutcome> {
    await this.onPrepared(buildShareCard(payload), payload);
    return { status: 'prepared', reasonCode: null, providerState: 'live' };
  }
}

export type ConnectedProviderConfig = {
  /** Present only when real OAuth credentials have been configured. */
  configured: boolean;
  /** Injected server-side. Never reaches the browser bundle. */
  send?: (payload: DeliveryPayload) => Promise<{ ok: boolean; errorCode?: string }>;
};

/**
 * Slack, Discord, and Notion.
 *
 * The real send function is injected by the Edge Function that holds the
 * token. In the browser, `configured` is false and every delivery reports
 * `skipped / provider_unavailable` — which is what the route history shows.
 */
export class ConnectedDeliveryProvider implements DestinationProvider {
  readonly capability: CapabilityClass = 'connected';

  constructor(
    readonly id: string,
    private readonly config: ConnectedProviderConfig,
  ) {}

  get state(): ProviderState {
    return this.config.configured && this.config.send ? 'live' : 'mock';
  }

  async deliver(payload: DeliveryPayload): Promise<DeliveryOutcome> {
    if (!this.config.configured || !this.config.send) {
      return {
        status: 'skipped',
        reasonCode: 'provider_unavailable',
        providerState: 'mock',
      };
    }
    if (!payload.targetRef) {
      return { status: 'failed', reasonCode: 'missing_target', providerState: 'live' };
    }
    const result = await this.config.send(payload);
    if (!result.ok) {
      return {
        status: 'failed',
        reasonCode: result.errorCode ?? 'delivery_failed',
        providerState: 'live',
      };
    }
    return { status: 'delivered', reasonCode: null, providerState: 'live' };
  }
}

/** Anything that needs a native extension Icthus does not ship. */
export class UnsupportedDeliveryProvider implements DestinationProvider {
  readonly capability: CapabilityClass = 'future_native';
  readonly state: ProviderState = 'unavailable';

  constructor(readonly id: string) {}

  async deliver(): Promise<DeliveryOutcome> {
    return {
      status: 'skipped',
      reasonCode: 'requires_native_extension',
      providerState: 'unavailable',
    };
  }
}

export type DeliveryRegistryOptions = {
  saveInApp: (payload: DeliveryPayload) => Promise<void> | void;
  onPrepared: (card: string, payload: DeliveryPayload) => Promise<void> | void;
  host: NotificationCapableWindow;
  connected?: Record<string, ConnectedProviderConfig>;
};

/**
 * Builds the adapter for a destination from its declared capability. Because
 * the mapping is derived from the catalog rather than hand-maintained, a new
 * destination cannot accidentally get a more capable adapter than its class.
 */
export function createDeliveryProvider(
  destinationId: string,
  options: DeliveryRegistryOptions,
): DestinationProvider | null {
  const destination = findDestination(destinationId);
  if (!destination) return null;

  switch (destination.capability) {
    case 'in_app':
      return new InAppDeliveryProvider(options.saveInApp);
    case 'on_device':
      return new WebNotificationDeliveryProvider(options.host);
    case 'ready_to_share':
      return new ShareCardDeliveryProvider(destination.id, options.onPrepared);
    case 'connected':
      return new ConnectedDeliveryProvider(
        destination.id,
        options.connected?.[destination.id] ?? { configured: false },
      );
    case 'future_native':
      return new UnsupportedDeliveryProvider(destination.id);
    default:
      return null;
  }
}

export function capabilitySummary(destinationId: string): string {
  const destination = findDestination(destinationId);
  if (!destination) return '';
  return CAPABILITY_SPECS[destination.capability].summary;
}
