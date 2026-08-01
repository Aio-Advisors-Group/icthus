import { z } from 'zod';
import {
  CAPABILITY_SPECS,
  DELIVERY_MODES,
  OUTPUT_TYPES,
  findDestination,
  isDeliveryModeAllowed,
  outputTypeSpec,
  type DeliveryMode,
  type OutputType,
} from './destinations';
import { isValidTime, isValidTimeZone, type QuietHours, type Schedule } from './schedule';

/**
 * Delivery routes.
 *
 * A route is a standing permission to send a specific category of content to a
 * specific place on a schedule. Because that is exactly the kind of thing that
 * goes wrong quietly, validation here is strict and runs on every save — the
 * UI cannot talk the model into an unsupported combination.
 */

export const ScheduleSchema: z.ZodType<Schedule> = z.discriminatedUnion('frequency', [
  z.object({ frequency: z.literal('daily'), time: z.string().refine(isValidTime) }),
  z.object({
    frequency: z.literal('weekly'),
    time: z.string().refine(isValidTime),
    weekday: z.number().int().min(0).max(6),
  }),
  z.object({ frequency: z.literal('once'), at: z.string().min(1) }),
]);

export const QuietHoursSchema: z.ZodType<QuietHours> = z.object({
  start: z.string().refine(isValidTime),
  end: z.string().refine(isValidTime),
});

export const RouteOutputSchema = z.object({
  outputType: z.enum(OUTPUT_TYPES),
  deliveryMode: z.enum(DELIVERY_MODES),
  enabled: z.boolean(),
  /**
   * Timestamp of the second, explicit consent required before a raw journal
   * entry may leave Icthus. Null for every other output type.
   */
  rawEntryConsentAt: z.string().nullable(),
});
export type RouteOutput = z.infer<typeof RouteOutputSchema>;

export const DeliveryRouteSchema = z.object({
  id: z.string().min(1),
  destinationId: z.string().min(1),
  /** Channel, DM, or page identifier for connected destinations. */
  targetRef: z.string().nullable(),
  targetLabel: z.string().nullable(),
  enabled: z.boolean(),
  paused: z.boolean(),
  timeZone: z.string().refine(isValidTimeZone, 'Unknown timezone'),
  schedule: ScheduleSchema,
  quietHours: QuietHoursSchema.nullable(),
  outputs: z.array(RouteOutputSchema),
  consentAt: z.string().min(1),
  createdAt: z.string().min(1),
  revokedAt: z.string().nullable(),
});
export type DeliveryRoute = z.infer<typeof DeliveryRouteSchema>;

export type RouteIssue = { field: string; message: string };

export type RouteValidationContext = {
  /** Memory insights cannot be routed while Memory is off. */
  memoryEnabled: boolean;
  /** Whether the connected provider actually has working credentials. */
  connectedProviderReady: boolean;
};

/**
 * Validates a route against its destination's real capability. Returns every
 * problem at once so the editor can show them together.
 */
export function validateRoute(
  candidate: unknown,
  context: RouteValidationContext,
): { ok: true; value: DeliveryRoute } | { ok: false; issues: RouteIssue[] } {
  const parsed = DeliveryRouteSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    };
  }

  const route = parsed.data;
  const issues: RouteIssue[] = [];
  const destination = findDestination(route.destinationId);

  if (!destination) {
    return {
      ok: false,
      issues: [{ field: 'destinationId', message: `Unknown destination: ${route.destinationId}` }],
    };
  }

  const capability = CAPABILITY_SPECS[destination.capability];

  if (destination.capability === 'future_native' && route.enabled) {
    issues.push({
      field: 'enabled',
      message: `${destination.name} needs a native app extension that Icthus does not ship. It cannot be enabled.`,
    });
  }

  if (capability.requiresCredentials && route.enabled && !context.connectedProviderReady) {
    issues.push({
      field: 'enabled',
      message: `${destination.name} has no working connection yet, so this route cannot be enabled.`,
    });
  }

  if (capability.requiresCredentials && route.enabled && !route.targetRef) {
    issues.push({
      field: 'targetRef',
      message: `Choose which ${destination.name} channel Icthus may post to.`,
    });
  }

  const enabledOutputs = route.outputs.filter((output) => output.enabled);
  if (route.enabled && enabledOutputs.length === 0) {
    issues.push({ field: 'outputs', message: 'Choose at least one kind of content to send.' });
  }

  const seen = new Set<OutputType>();
  for (const output of route.outputs) {
    if (seen.has(output.outputType)) {
      issues.push({
        field: `outputs.${output.outputType}`,
        message: 'Duplicate output type on the same route.',
      });
    }
    seen.add(output.outputType);

    if (!destination.supportedOutputs.includes(output.outputType)) {
      if (output.enabled) {
        issues.push({
          field: `outputs.${output.outputType}`,
          message: `${destination.name} does not support ${outputTypeSpec(output.outputType).label}.`,
        });
      }
      continue;
    }

    if (output.enabled && !isDeliveryModeAllowed(route.destinationId, output.deliveryMode)) {
      issues.push({
        field: `outputs.${output.outputType}.deliveryMode`,
        message: `${destination.name} is "${capability.label}" — it cannot ${
          output.deliveryMode === 'automatic' ? 'send automatically' : 'use that delivery mode'
        }.`,
      });
    }

    const spec = outputTypeSpec(output.outputType);
    if (output.enabled && spec.requiresSeparateConsent && !output.rawEntryConsentAt) {
      issues.push({
        field: `outputs.${output.outputType}`,
        message: 'Sending your own journal text needs a separate confirmation.',
      });
    }

    if (output.enabled && output.outputType === 'memory_insight' && !context.memoryEnabled) {
      issues.push({
        field: 'outputs.memory_insight',
        message: 'Turn Memory on before routing memory insights.',
      });
    }
  }

  return issues.length === 0 ? { ok: true, value: route } : { ok: false, issues };
}

/** A route only delivers when every gate is open. */
export function isRouteDeliverable(route: DeliveryRoute): boolean {
  if (!route.enabled || route.paused || route.revokedAt) return false;
  return route.outputs.some((output) => output.enabled);
}

export function defaultOutputsFor(destinationId: string): RouteOutput[] {
  const destination = findDestination(destinationId);
  if (!destination) return [];
  const modes = CAPABILITY_SPECS[destination.capability].allowedDeliveryModes;
  const preferred: DeliveryMode = modes.includes('automatic')
    ? 'automatic'
    : (modes[0] ?? 'manual_share');

  return destination.supportedOutputs.map((outputType) => ({
    outputType,
    deliveryMode: preferred,
    // Nothing is on by default, and the journal never can be.
    enabled: false,
    rawEntryConsentAt: null,
  }));
}

export const DELIVERY_EVENT_STATUSES = [
  'queued',
  'delivered',
  'failed',
  'skipped',
  'revoked',
  'prepared',
] as const;
export type DeliveryEventStatus = (typeof DELIVERY_EVENT_STATUSES)[number];

export type DeliveryEvent = {
  id: string;
  routeId: string;
  outputType: OutputType;
  status: DeliveryEventStatus;
  scheduledFor: string;
  deliveredAt: string | null;
  /** A code, never the content. Delivery logs stay content-free. */
  reasonCode: string | null;
  idempotencyKey: string;
  createdAt: string;
};

export const DELIVERY_EVENT_LABELS: Record<DeliveryEventStatus, string> = {
  queued: 'Queued',
  delivered: 'Delivered',
  failed: 'Failed',
  skipped: 'Skipped',
  revoked: 'Revoked',
  prepared: 'Ready for you to send',
};

export const DELIVERY_REASON_LABELS: Record<string, string> = {
  quiet_hours: 'Held back during your quiet hours',
  consent_revoked: 'You revoked consent for this route',
  provider_unavailable: 'The connection is not configured yet',
  memory_disabled: 'Memory is off, so there was no insight to send',
  no_content: 'There was nothing new to send',
  safety_hold: 'Held back because the entry was flagged as sensitive',
  route_paused: 'The route is paused',
};
