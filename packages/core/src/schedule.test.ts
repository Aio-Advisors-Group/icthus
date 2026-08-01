import { describe, expect, it } from 'vitest';
import { formatTimeLabel, isWithinQuietHours, nextRunAt, zonedParts } from './schedule';

describe('next run calculation', () => {
  it('finds the next occurrence of a daily wall-clock time', () => {
    const now = new Date('2026-07-31T20:00:00Z'); // 13:00 in Los Angeles
    const next = nextRunAt({
      schedule: { frequency: 'daily', time: '07:30' },
      timeZone: 'America/Los_Angeles',
      now,
    });
    expect(next).not.toBeNull();
    if (!next) return;
    const local = zonedParts(next, 'America/Los_Angeles');
    expect(local.hour).toBe(7);
    expect(local.minute).toBe(30);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it('keeps the wall-clock time stable across a DST transition', () => {
    // US DST ends 2026-11-01. A 07:30 local alarm stays 07:30 local either side.
    const before = nextRunAt({
      schedule: { frequency: 'daily', time: '07:30' },
      timeZone: 'America/Los_Angeles',
      now: new Date('2026-10-31T20:00:00Z'),
    });
    const after = nextRunAt({
      schedule: { frequency: 'daily', time: '07:30' },
      timeZone: 'America/Los_Angeles',
      now: new Date('2026-11-02T20:00:00Z'),
    });
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    if (!before || !after) return;
    expect(zonedParts(before, 'America/Los_Angeles').hour).toBe(7);
    expect(zonedParts(after, 'America/Los_Angeles').hour).toBe(7);
  });

  it('lands on the requested weekday for a weekly schedule', () => {
    const next = nextRunAt({
      schedule: { frequency: 'weekly', time: '18:00', weekday: 0 },
      timeZone: 'America/New_York',
      now: new Date('2026-07-31T12:00:00Z'),
    });
    expect(next).not.toBeNull();
    if (!next) return;
    expect(zonedParts(next, 'America/New_York').weekday).toBe(0);
  });

  it('returns null for a one-time schedule that has already passed', () => {
    expect(
      nextRunAt({
        schedule: { frequency: 'once', at: '2026-07-01T00:00:00Z' },
        timeZone: 'UTC',
        now: new Date('2026-07-31T00:00:00Z'),
      }),
    ).toBeNull();
  });

  it('rejects an unknown timezone rather than guessing', () => {
    expect(
      nextRunAt({
        schedule: { frequency: 'daily', time: '07:30' },
        timeZone: 'Not/AZone',
        now: new Date(),
      }),
    ).toBeNull();
  });
});

describe('quiet hours', () => {
  it('handles a window that wraps midnight', () => {
    const quiet = { start: '22:00', end: '07:00' };
    const zone = 'UTC';
    expect(isWithinQuietHours(new Date('2026-07-31T23:30:00Z'), zone, quiet)).toBe(true);
    expect(isWithinQuietHours(new Date('2026-07-31T03:00:00Z'), zone, quiet)).toBe(true);
    expect(isWithinQuietHours(new Date('2026-07-31T12:00:00Z'), zone, quiet)).toBe(false);
  });

  it('defers a run that would land inside quiet hours instead of dropping it', () => {
    const next = nextRunAt({
      schedule: { frequency: 'daily', time: '23:00' },
      timeZone: 'UTC',
      quietHours: { start: '22:00', end: '07:00' },
      now: new Date('2026-07-31T12:00:00Z'),
    });
    expect(next).not.toBeNull();
    if (!next) return;
    expect(zonedParts(next, 'UTC').hour).toBe(7);
    expect(isWithinQuietHours(next, 'UTC', { start: '22:00', end: '07:00' })).toBe(false);
  });
});

describe('time formatting', () => {
  it('renders a 12-hour label', () => {
    expect(formatTimeLabel('07:30')).toBe('7:30 AM');
    expect(formatTimeLabel('00:05')).toBe('12:05 AM');
    expect(formatTimeLabel('12:00')).toBe('12:00 PM');
    expect(formatTimeLabel('19:45')).toBe('7:45 PM');
  });
});
