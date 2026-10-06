// Talks to the Lambda (Function URL) to load and save the user's food list.
// Same Lambda as goals — routed by content (the presence of a foods array).
import { API_BASE, getWithRetry, postWithRetry } from '@/api/client';

const FOOD_URL = `${API_BASE}/food`;

export type FoodRow = {
  id: number;
  name: string;
  checked: boolean;
  servingSize: string;   // free text (e.g. "1 cup", "100g"); display only
  quantity: number;      // servings multiplier used when totaling nutrients
  nutrients: Record<string, number | undefined>;
};

// Load the user's saved food list, retrying to cover Aurora's cold-start wake.
// Returns null if every attempt failed (so callers can tell "no data" apart
// from "couldn't reach the DB yet").
export async function loadFoods(userId: string, tableId: string): Promise<FoodRow[] | null> {
  return getWithRetry<FoodRow[]>(
    `${FOOD_URL}?userId=${encodeURIComponent(userId)}&type=food&tableId=${encodeURIComponent(tableId)}`,
    (data) =>
      (data.foods ?? []).map((f: any) => ({
        id: Number(f.id),
        name: f.name,
        checked: f.checked,
        servingSize: f.servingSize ?? '',
        quantity: f.quantity === undefined || f.quantity === null ? 1 : Number(f.quantity),
        nutrients: f.nutrients ?? {},
      })),
    { label: 'loadFoods' }
  );
}

// Save (sync) the whole food list, with a couple of retries.
export async function saveFoods(userId: string, tableId: string, foods: FoodRow[]): Promise<boolean> {
  return postWithRetry(FOOD_URL, { userId, tableId, foods }, { label: 'saveFoods' });
}
