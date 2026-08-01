/**
 * Timezone-aware scheduling without a date library.
 *
 * Routes store a wall-clock time and an IANA timezone, not a UTC instant, so
 * "7:30 in the morning" stays 7:30 in the morning across a DST boundary.
 */

export type Frequency = 'daily' | 'weekly' | 'once';

export type Schedule =
  | { frequency: 'daily'; time: string }
  | { frequency: 'weekly'; time: string; weekday: number }
  | { frequency: 'once'; at: string };

export type QuietHours = {
  /** Wall-clock "HH:MM" in the route's timezone. */
  start: string;
  end: string;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function parseTime(value: string): { hour: number; minute: number } | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Milliseconds to add to a UTC instant to get the given zone's wall clock. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const part of parts) lookup[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour) % 24,
    Number(lookup.minute),
    Number(lookup.second),
  );
  return asUtc - instant.getTime();
}

/**
 * Converts a wall-clock time in `timeZone` to the corresponding UTC instant.
 * Runs the offset lookup twice so a time that straddles a DST transition still
 * resolves correctly.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstPass = naive - zoneOffsetMs(new Date(naive), timeZone);
  const secondPass = naive - zoneOffsetMs(new Date(firstPass), timeZone);
  return new Date(secondPass);
}

/** The wall-clock date parts for an instant in a given zone. */
export function zonedParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const lookup: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) lookup[part.type] = part.value;
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour) % 24,
    minute: Number(lookup.minute),
    weekday: Math.max(0, weekdays.indexOf(lookup.weekday ?? 'Sun')),
  };
}

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/**
 * Quiet hours may wrap midnight (22:00 → 07:00), so the comparison is a range
 * test in either direction rather than a simple between.
 */
export function isWithinQuietHours(
  instant: Date,
  timeZone: string,
  quietHours: QuietHours | null,
): boolean {
  if (!quietHours) return false;
  const start = parseTime(quietHours.start);
  const end = parseTime(quietHours.end);
  if (!start || !end) return false;

  const local = zonedParts(instant, timeZone);
  const now = minutesOfDay(local.hour, local.minute);
  const from = minutesOfDay(start.hour, start.minute);
  const to = minutesOfDay(end.hour, end.minute);

  if (from === to) return false;
  if (from < to) return now >= from && now < to;
  return now >= from || now < to;
}

/** Moves an instant forward to the moment quiet hours end. */
function afterQuietHours(instant: Date, timeZone: string, quietHours: QuietHours): Date {
  const end = parseTime(quietHours.end);
  if (!end) return instant;
  const local = zonedParts(instant, timeZone);
  let candidate = zonedTimeToUtc(
    local.year,
    local.month,
    local.day,
    end.hour,
    end.minute,
    timeZone,
  );
  if (candidate.getTime() <= instant.getTime()) {
    const nextDay = new Date(instant.getTime() + 86_400_000);
    const nextLocal = zonedParts(nextDay, timeZone);
    candidate = zonedTimeToUtc(
      nextLocal.year,
      nextLocal.month,
      nextLocal.day,
      end.hour,
      end.minute,
      timeZone,
    );
  }
  return candidate;
}

export type NextRunOptions = {
  schedule: Schedule;
  timeZone: string;
  quietHours?: QuietHours | null;
  now?: Date;
};

/**
 * Computes the next delivery instant, or null when a one-time schedule has
 * already passed. A run that would land inside quiet hours is deferred to the
 * moment they end rather than dropped.
 */
export function nextRunAt(options: NextRunOptions): Date | null {
  const { schedule, timeZone } = options;
  const quietHours = options.quietHours ?? null;
  const now = options.now ?? new Date();
  if (!isValidTimeZone(timeZone)) return null;

  let candidate: Date | null = null;

  if (schedule.frequency === 'once') {
    const at = new Date(schedule.at);
    if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) return null;
    candidate = at;
  } else {
    const time = parseTime(schedule.time);
    if (!time) return null;
    const wantedWeekday = schedule.frequency === 'weekly' ? schedule.weekday : null;

    // Scan forward day by day. Eight days covers a weekly schedule plus a DST
    // shift without needing calendar arithmetic.
    for (let dayOffset = 0; dayOffset <= 8; dayOffset += 1) {
      const probe = new Date(now.getTime() + dayOffset * 86_400_000);
      const local = zonedParts(probe, timeZone);
      const attempt = zonedTimeToUtc(
        local.year,
        local.month,
        local.day,
        time.hour,
        time.minute,
        timeZone,
      );
      if (attempt.getTime() <= now.getTime()) continue;
      if (wantedWeekday !== null) {
        const attemptLocal = zonedParts(attempt, timeZone);
        if (attemptLocal.weekday !== wantedWeekday) continue;
      }
      candidate = attempt;
      break;
    }
  }

  if (!candidate) return null;
  if (quietHours && isWithinQuietHours(candidate, timeZone, quietHours)) {
    return afterQuietHours(candidate, timeZone, quietHours);
  }
  return candidate;
}

export function describeSchedule(schedule: Schedule, timeZone: string): string {
  const zoneLabel = timeZone.split('/').pop()?.replace(/_/g, ' ') ?? timeZone;
  if (schedule.frequency === 'once') {
    const at = new Date(schedule.at);
    if (Number.isNaN(at.getTime())) return 'Invalid date';
    return `Once, on ${at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
  }
  const time = formatTimeLabel(schedule.time);
  if (schedule.frequency === 'daily') return `Every day at ${time} · ${zoneLabel}`;
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `Every ${weekdays[schedule.weekday] ?? 'week'} at ${time} · ${zoneLabel}`;
}

export function formatTimeLabel(time: string): string {
  const parsed = parseTime(time);
  if (!parsed) return time;
  const suffix = parsed.hour < 12 ? 'AM' : 'PM';
  const hour12 = parsed.hour % 12 === 0 ? 12 : parsed.hour % 12;
  return `${hour12}:${String(parsed.minute).padStart(2, '0')} ${suffix}`;
}

export function resolveTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
