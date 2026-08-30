// Talks to the Lambda (Function URL) to load and save the user's food list.
// Same Lambda as goals — routed by content (the presence of a foods array).

const BASE_URL = 'https://gmdcz4ashy6yfypp3l7wagi2ee0ihpor.lambda-url.us-west-2.on.aws';
const FOOD_URL = `${BASE_URL}/food`;

export type FoodRow = {
  id: number;
  name: string;
  checked: boolean;
  servingSize: string;   // free text (e.g. "1 cup", "100g"); display only
  quantity: number;      // servings multiplier used when totaling nutrients
  nutrients: Record<string, number | undefined>;
};

// Small helper: pause for ms milliseconds.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Load the user's saved food list, retrying to cover Aurora's cold-start wake.
// Returns null if every attempt failed (so callers can tell "no data" apart
// from "couldn't reach the DB yet").
export async function loadFoods(userId: string, tableId: string): Promise<FoodRow[] | null> {
  const delays = [0, 3000, 5000, 8000]; // wait longer between each retry
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(
        `${FOOD_URL}?userId=${encodeURIComponent(userId)}&type=food&tableId=${encodeURIComponent(tableId)}`,
        { method: 'GET' }
      );
      if (res.ok) {
        const data = await res.json();
        return (data.foods ?? []).map((f: any) => ({
          id: Number(f.id),
          name: f.name,
          checked: f.checked,
          servingSize: f.servingSize ?? '',
          quantity: f.quantity === undefined || f.quantity === null ? 1 : Number(f.quantity),
          nutrients: f.nutrients ?? {},
        }));
      }
      // non-OK response — retry
      console.log(`loadFoods attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`loadFoods attempt ${attempt + 1} failed:`, e);
    }
  }
  return null; // all attempts failed
}

// Save (sync) the whole food list, with a couple of retries.
export async function saveFoods(userId: string, tableId: string, foods: FoodRow[]): Promise<boolean> {
  const delays = [0, 3000, 5000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(FOOD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tableId, foods }),
      });
      if (res.ok) return true;
      console.log(`saveFoods attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`saveFoods attempt ${attempt + 1} failed:`, e);
    }
  }
  return false;
}