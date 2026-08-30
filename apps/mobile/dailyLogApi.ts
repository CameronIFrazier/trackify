// Talks to the Lambda "dailylog" route — writes day snapshots and reads history.

import { Comparator } from './goalComparators';
import { NutrientValues } from './nutrients';
import { DayEntry } from './dailyLog';

const BASE_URL = 'https://gmdcz4ashy6yfypp3l7wagi2ee0ihpor.lambda-url.us-west-2.on.aws';
const DAILYLOG_URL = `${BASE_URL}/dailylog`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const delays = [0, 3000, 5000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(DAILYLOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'dailylog', userId, entries, lastLoggedDate }),
      });
      if (res.ok) return true;
      console.log(`saveDailyLog attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`saveDailyLog attempt ${attempt + 1} failed:`, e);
    }
  }
  return false;
}

// Load the full Food Log history (newest first). Returns null on failure.
export async function loadDailyLog(userId: string): Promise<LoadedDay[] | null> {
  const delays = [0, 3000, 5000, 8000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(
        `${DAILYLOG_URL}?userId=${encodeURIComponent(userId)}&type=dailylog`,
        { method: 'GET' }
      );
      if (res.ok) {
        const data = await res.json();
        return data.days ?? [];
      }
      console.log(`loadDailyLog attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`loadDailyLog attempt ${attempt + 1} failed:`, e);
    }
  }
  return null;
}