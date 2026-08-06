// Talks to the nutrient-goals Lambda (Function URL) to load and save goals.

const GOALS_URL = 'https://gmdcz4ashy6yfypp3l7wagi2ee0ihpor.lambda-url.us-west-2.on.aws/';

// For now we use a fixed dev user id (auth is bypassed). Later this becomes
// the signed-in user's Cognito id.
const DEV_USER_ID = 'dev-user';

// Load this user's saved goals. Returns {} if none saved yet.
export async function loadGoals(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${GOALS_URL}?userId=${encodeURIComponent(DEV_USER_ID)}`, {
      method: 'GET',
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.goals ?? {};
  } catch (e) {
    console.log('loadGoals error:', e);
    return {};
  }
}

// Save this user's goals. Returns true on success.
export async function saveGoals(goals: Record<string, number>): Promise<boolean> {
  try {
    const res = await fetch(GOALS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: DEV_USER_ID, goals }),
    });
    return res.ok;
  } catch (e) {
    console.log('saveGoals error:', e);
    return false;
  }
}