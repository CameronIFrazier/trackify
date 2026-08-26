// Load and save the user's profile via the Lambda (Function URL).
import { UserProfile } from './goals';

const BASE_URL = 'https://gmdcz4ashy6yfypp3l7wagi2ee0ihpor.lambda-url.us-west-2.on.aws';
const PROFILE_URL = `${BASE_URL}/profile`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Load a user's profile. Returns the profile, null if none saved,
// or undefined if the request failed after retries (cold start).
export async function loadProfile(userId: string): Promise<UserProfile | null | undefined> {
  const delays = [0, 3000, 5000, 8000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(
        `${PROFILE_URL}?userId=${encodeURIComponent(userId)}&type=profile`,
        { method: 'GET' }
      );
      if (res.ok) {
        const data = await res.json();
        return data.profile ?? null; // null = no profile saved yet
      }
      console.log(`loadProfile attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`loadProfile attempt ${attempt + 1} failed:`, e);
    }
  }
  return undefined; // all attempts failed
}

// Save a user's profile.
export async function saveProfile(userId: string, profile: UserProfile): Promise<boolean> {
  const delays = [0, 3000, 5000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(PROFILE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, profile }),
      });
      if (res.ok) return true;
      console.log(`saveProfile attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`saveProfile attempt ${attempt + 1} failed:`, e);
    }
  }
  return false;
}