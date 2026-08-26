// Talks to the nutrient-goals Lambda (Function URL) to load and save goals.
// Goals now carry a comparator (direction) alongside the amount. To stay
// backward-compatible, amounts and comparators travel as two parallel maps.

import { Comparator } from './goalComparators';

const GOALS_URL = 'https://gmdcz4ashy6yfypp3l7wagi2ee0ihpor.lambda-url.us-west-2.on.aws/';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type LoadedGoals = {
  goals: Record<string, number>;
  comparators: Record<string, Comparator>;
};

// Load saved goals + comparators, retrying to cover Aurora's cold-start wake.
// Returns null if every attempt failed (vs empty maps meaning "nothing saved").
export async function loadGoals(userId: string): Promise<LoadedGoals | null> {
  const delays = [0, 3000, 5000, 8000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(`${GOALS_URL}?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
      });
      if (res.ok) {
        const data = await res.json();
        return {
          goals: data.goals ?? {},
          comparators: data.comparators ?? {},
        };
      }
      console.log(`loadGoals attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`loadGoals attempt ${attempt + 1} failed:`, e);
    }
  }
  return null;
}

// Save goals + comparators, with retries.
export async function saveGoals(
  userId: string,
  goals: Record<string, number>,
  comparators: Record<string, Comparator>
): Promise<boolean> {
  const delays = [0, 3000, 5000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(GOALS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, goals, comparators }),
      });
      if (res.ok) return true;
      console.log(`saveGoals attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`saveGoals attempt ${attempt + 1} failed:`, e);
    }
  }
  return false;
}