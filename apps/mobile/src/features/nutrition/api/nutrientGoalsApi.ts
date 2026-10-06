// Talks to the nutrient-goals Lambda (Function URL) to load and save goals.
// Goals now carry a comparator (direction) alongside the amount. To stay
// backward-compatible, amounts and comparators travel as two parallel maps.
import { Comparator } from '@/features/nutrition/lib/goalComparators';
import { API_BASE, getWithRetry, postWithRetry } from '@/api/client';

// Goals live on the default (root) route.
const GOALS_URL = `${API_BASE}/`;

export type LoadedGoals = {
  goals: Record<string, number>;
  comparators: Record<string, Comparator>;
};

// Load saved goals + comparators, retrying to cover Aurora's cold-start wake.
// Returns null if every attempt failed (vs empty maps meaning "nothing saved").
export async function loadGoals(userId: string): Promise<LoadedGoals | null> {
  return getWithRetry<LoadedGoals>(
    `${GOALS_URL}?userId=${encodeURIComponent(userId)}`,
    (data) => ({
      goals: data.goals ?? {},
      comparators: data.comparators ?? {},
    }),
    { label: 'loadGoals' }
  );
}

// Save goals + comparators, with retries.
export async function saveGoals(
  userId: string,
  goals: Record<string, number>,
  comparators: Record<string, Comparator>
): Promise<boolean> {
  return postWithRetry(GOALS_URL, { userId, goals, comparators }, { label: 'saveGoals' });
}
