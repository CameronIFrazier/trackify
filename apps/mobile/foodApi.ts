// Talks to the Lambda (Function URL) to load and save the user's food list.
// Same Lambda as goals — routed by the "/food" path segment.

const BASE_URL = 'https://gmdcz4ashy6yfypp3l7wagi2ee0ihpor.lambda-url.us-west-2.on.aws';
const FOOD_URL = `${BASE_URL}/food`;
const DEV_USER_ID = 'dev-user';

export type FoodRow = {
  id: number;
  name: string;
  checked: boolean;
  nutrients: Record<string, number | undefined>;
};

// Load the user's saved food list.
export async function loadFoods(): Promise<FoodRow[]> {
  try {
    const res = await fetch(`${FOOD_URL}?userId=${encodeURIComponent(DEV_USER_ID)}&type=food`, {
      method: 'GET',
    });
    if (!res.ok) return [];
    const data = await res.json();
    // ids come back as strings from the DB; convert to numbers for the app.
    return (data.foods ?? []).map((f: any) => ({
      id: Number(f.id),
      name: f.name,
      checked: f.checked,
      nutrients: f.nutrients ?? {},
    }));
  } catch (e) {
    console.log('loadFoods error:', e);
    return [];
  }
}

// Save (sync) the whole food list.
export async function saveFoods(foods: FoodRow[]): Promise<boolean> {
  try {
    const res = await fetch(FOOD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: DEV_USER_ID, foods }),
    });
    return res.ok;
  } catch (e) {
    console.log('saveFoods error:', e);
    return false;
  }
}