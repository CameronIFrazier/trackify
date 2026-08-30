// The day-rollover snapshot engine (client-side, on app open).
//
// Model (Option B): the Food Log holds only COMPLETED days. "Today" is never
// logged — it stays live on the main screen and only enters the log once it has
// fully rolled over. On each open we log every completed day since the last one
// we logged: a real snapshot for the most recent active day, and "not_logged"
// gap markers for any days the user skipped entirely.

import { Comparator } from './goalComparators';
import { NutrientValues } from './nutrients';
import { saveDailyLog } from './dailyLogApi';

export type DayStatus = 'logged' | 'not_logged';

export type DayEntry = {
  date: string;                              // 'YYYY-MM-DD' in the user's tz
  status: DayStatus;
  totals: NutrientValues;
  goals: Record<string, number>;
  comparators: Record<string, Comparator>;
};

// Today's date as 'YYYY-MM-DD' in the given IANA timezone.
export function todayInTimezone(timezone: string): string {
  try {
    // en-CA gives YYYY-MM-DD formatting.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Add n days to a 'YYYY-MM-DD' string (UTC math, safe for date-only).
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Compare two 'YYYY-MM-DD' strings.
function isBefore(a: string, b: string): boolean {
  return a < b; // lexicographic works for zero-padded ISO dates
}

type SnapshotInput = {
  timezone: string;
  lastLoggedDate?: string;                   // last completed day already logged
  checkedTotals: NutrientValues;             // yesterday's checked totals (from current plate)
  goals: Record<string, number>;
  comparators: Record<string, Comparator>;
};

// Decide whether a rollover happened and, if so, build the entries to log.
// Returns { rolledOver, entries, newLastLogged } — entries is empty if nothing
// to log. The caller persists via runDailySnapshot below.
export function computeSnapshot(input: SnapshotInput): {
  rolledOver: boolean;
  entries: DayEntry[];
  newLastLogged: string;
} {
  const today = todayInTimezone(input.timezone);

  // First ever open (no marker): nothing to log yet — today becomes the anchor.
  if (!input.lastLoggedDate) {
    return { rolledOver: false, entries: [], newLastLogged: today };
  }

  // If we've already logged up through yesterday, and today hasn't advanced past
  // the last logged day + nothing to close out, no rollover.
  // We log every completed day strictly before "today" that isn't yet logged.
  const entries: DayEntry[] = [];
  let cursor = addDays(input.lastLoggedDate, 1); // first day not yet logged

  if (!isBefore(cursor, today)) {
    // cursor >= today → the last logged day was yesterday (or later); nothing
    // has completed since. No rollover.
    return { rolledOver: false, entries: [], newLastLogged: input.lastLoggedDate };
  }

  // The FIRST completed day since last open is the one whose food is still on
  // the plate — snapshot it with the real checked totals. Any further days up to
  // (but not including) today were skipped entirely → mark them not_logged.
  const firstDay = cursor;
  entries.push({
    date: firstDay,
    status: 'logged',
    totals: input.checkedTotals,
    goals: input.goals,
    comparators: input.comparators,
  });
  cursor = addDays(cursor, 1);

  while (isBefore(cursor, today)) {
    entries.push({
      date: cursor,
      status: 'not_logged',
      totals: {},
      goals: {},
      comparators: {},
    });
    cursor = addDays(cursor, 1);
  }

  // New marker = the last completed day (day before today).
  const newLastLogged = addDays(today, -1);
  return { rolledOver: true, entries, newLastLogged };
}

// Run the snapshot on app open: compute, persist to the DB, and tell the caller
// whether the plate should be cleared (a rollover happened).
export async function runDailySnapshot(
  userId: string,
  input: SnapshotInput
): Promise<{ rolledOver: boolean; newLastLogged: string }> {
  const { rolledOver, entries, newLastLogged } = computeSnapshot(input);

  if (!rolledOver && entries.length === 0 && input.lastLoggedDate) {
    // Nothing to log and marker already set — no-op.
    return { rolledOver: false, newLastLogged: input.lastLoggedDate };
  }

  // Persist: write any completed-day entries and advance the marker.
  // (On first-ever open, entries is empty but we still set the anchor marker.)
  await saveDailyLog(userId, entries, newLastLogged);

  return { rolledOver, newLastLogged };
}