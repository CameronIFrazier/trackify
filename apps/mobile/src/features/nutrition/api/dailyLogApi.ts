// Talks to the Lambda "dailylog" route — writes day snapshots and reads history.
import { Comparator } from '@/features/nutrition/lib/goalComparators';
import { NutrientValues } from '@/features/nutrition/lib/nutrients';
import { DayEntry } from '@/features/nutrition/lib/dailyLog';
import { API_BASE, getWithRetry, postWithRetry } from '@/api/client';

const DAILYLOG_URL = `${API_BASE}/dailylog`;

export type LoadedDay = {
  date: string;
  status: 'logged' | 'not_logged';
  totals: NutrientValues;
  goals: Record<string, number>;
  comparators: Record<string, Comparator>;
};

// Write day-snapshot entries and advance the last-logged marker.
export async function saveDailyLog(
  userId: string,
  entries: DayEntry[],
  lastLoggedDate: string
): Promise<boolean> {
  return postWithRetry(
    DAILYLOG_URL,
    { type: 'dailylog', userId, entries, lastLoggedDate },
    { label: 'saveDailyLog' }
  );
}

// Load the full Food Log history (newest first). Returns null on failure.
export async function loadDailyLog(userId: string): Promise<LoadedDay[] | null> {
  return getWithRetry<LoadedDay[]>(
    `${DAILYLOG_URL}?userId=${encodeURIComponent(userId)}&type=dailylog`,
    (data) => data.days ?? [],
    { label: 'loadDailyLog' }
  );
}
