// Load and save the user's profile via the Lambda (Function URL).
import { UserProfile } from '@/features/nutrition/lib/goals';
import { API_BASE, getWithRetry, postWithRetry } from '@/api/client';

const PROFILE_URL = `${API_BASE}/profile`;

// Load a user's profile. Returns the profile, null if none saved,
// or undefined if the request failed after retries (cold start).
export async function loadProfile(userId: string): Promise<UserProfile | null | undefined> {
  return getWithRetry<UserProfile | null, undefined>(
    `${PROFILE_URL}?userId=${encodeURIComponent(userId)}&type=profile`,
    (data) => data.profile ?? null, // null = no profile saved yet
    { onFail: undefined, label: 'loadProfile' } // undefined = request failed
  );
}

// Save a user's profile.
export async function saveProfile(userId: string, profile: UserProfile): Promise<boolean> {
  return postWithRetry(PROFILE_URL, { userId, profile }, { label: 'saveProfile' });
}
