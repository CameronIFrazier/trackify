// Deletes all of the user's data from Aurora (every table), with retries
// to cover Aurora's cold-start wake. Same Lambda, routed by type=delete_account.

const BASE_URL = 'https://gmdcz4ashy6yfypp3l7wagi2ee0ihpor.lambda-url.us-west-2.on.aws';
const DELETE_URL = `${BASE_URL}/delete_account`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Returns true only if the server confirms the data was deleted.
export async function deleteAccountData(userId: string): Promise<boolean> {
  const delays = [0, 3000, 5000, 8000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(DELETE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: 'delete_account' }),
      });
      if (res.ok) return true;
      console.log(`deleteAccountData attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`deleteAccountData attempt ${attempt + 1} failed:`, e);
    }
  }
  return false;
}