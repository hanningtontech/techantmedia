import {
  COUNTDOWN_UNIT_ORDER,
  type CountdownUnit,
  type LivestreamCountdownUnits,
} from "./livestreamTypes";

export type CountdownParts = Partial<Record<CountdownUnit, number>>;

function copyDate(d: Date): Date {
  return new Date(d.getTime());
}

/** Calendar-aware countdown; only computes units enabled in `showUnits`. */
export function computeCountdown(
  target: Date,
  now: Date,
  showUnits: LivestreamCountdownUnits,
): CountdownParts {
  const parts: CountdownParts = {};
  const enabled = COUNTDOWN_UNIT_ORDER.filter((u) => showUnits[u]);
  if (!enabled.length) return parts;

  if (target.getTime() <= now.getTime()) {
    for (const unit of enabled) parts[unit] = 0;
    return parts;
  }

  let cursor = copyDate(now);

  if (showUnits.years) {
    let years = target.getFullYear() - cursor.getFullYear();
    const test = copyDate(cursor);
    test.setFullYear(cursor.getFullYear() + years);
    if (test > target) years -= 1;
    parts.years = Math.max(0, years);
    cursor.setFullYear(cursor.getFullYear() + (parts.years ?? 0));
  }

  if (showUnits.months) {
    let months =
      (target.getFullYear() - cursor.getFullYear()) * 12 + (target.getMonth() - cursor.getMonth());
    const test = copyDate(cursor);
    test.setMonth(cursor.getMonth() + months);
    if (test > target) months -= 1;
    parts.months = Math.max(0, months);
    cursor.setMonth(cursor.getMonth() + (parts.months ?? 0));
  }

  if (showUnits.days) {
    let days = 0;
    const test = copyDate(cursor);
    while (true) {
      const next = copyDate(test);
      next.setDate(test.getDate() + 1);
      if (next > target) break;
      test.setDate(test.getDate() + 1);
      days += 1;
    }
    parts.days = days;
    cursor = test;
  }

  const remainingMs = Math.max(0, target.getTime() - cursor.getTime());
  let ms = remainingMs;

  if (showUnits.hours) {
    const hourMs = 60 * 60 * 1000;
    parts.hours = Math.floor(ms / hourMs);
    ms -= (parts.hours ?? 0) * hourMs;
  }

  if (showUnits.minutes) {
    const minuteMs = 60 * 1000;
    parts.minutes = Math.floor(ms / minuteMs);
    ms -= (parts.minutes ?? 0) * minuteMs;
  }

  if (showUnits.seconds) {
    parts.seconds = Math.floor(ms / 1000);
  }

  return parts;
}

export function parseTargetDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isCountdownComplete(target: Date, now: Date): boolean {
  return target.getTime() <= now.getTime();
}

export function padCountdownValue(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}
