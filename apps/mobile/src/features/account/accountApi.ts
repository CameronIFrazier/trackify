// Deletes all of the user's data from Aurora (every table). Same Lambda,
// routed by type=delete_account. Uses the longer GET-style backoff because a
// delete may be the first request to hit a cold database.
import { API_BASE, postWithRetry, GET_DELAYS } from '@/api/client';

const DELETE_URL = `${API_BASE}/delete_account`;

// Returns true only if the server confirms the data was deleted.
export async function deleteAccountData(userId: string): Promise<boolean> {
  return postWithRetry(
    DELETE_URL,
    { userId, type: 'delete_account' },
    { delays: GET_DELAYS, label: 'deleteAccountData' }
  );
}
