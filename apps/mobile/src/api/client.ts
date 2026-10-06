// Shared API client for the Trackify Lambda (Function URL).
// One place for the base URL and the cold-start retry logic that every
// endpoint module used to duplicate. Behavior is identical to the old
// per-file loops — this only removes the duplication.

export const API_BASE =
  'https://gmdcz4ashy6yfypp3l7wagi2ee0ihpor.lambda-url.us-west-2.on.aws';

// Pause helper for retry backoff.
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retry backoff schedules (ms to wait before each attempt). Reads wait longer
// because they happen on app-open, when Aurora is most likely to be cold.
export const GET_DELAYS = [0, 3000, 5000, 8000];
export const POST_DELAYS = [0, 3000, 5000];

type RetryOpts = { delays?: number[]; label?: string };

// GET with cold-start retries. On a 2xx, `parse` maps the JSON body to T.
// Returns the parsed value, or `onFail` (default null) when every attempt
// fails — so callers can tell "couldn't reach the DB" apart from "no data".
export async function getWithRetry<T, F = null>(
  url: string,
  parse: (data: any) => T,
  opts: RetryOpts & { onFail?: F } = {}
): Promise<T | F> {
  const { delays = GET_DELAYS, label = 'GET' } = opts;
  // Use the key's presence, not a destructuring default: a default fires on
  // `undefined`, which would turn an explicit `onFail: undefined` into null.
  const onFail = ('onFail' in opts ? opts.onFail : null) as F;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return parse(await res.json());
      console.log(`${label} attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`${label} attempt ${attempt + 1} failed:`, e);
    }
  }
  return onFail;
}

// POST with cold-start retries. Returns true only on a 2xx.
export async function postWithRetry(
  url: string,
  body: unknown,
  opts: RetryOpts = {}
): Promise<boolean> {
  const { delays = POST_DELAYS, label = 'POST' } = opts;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return true;
      console.log(`${label} attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`${label} attempt ${attempt + 1} failed:`, e);
    }
  }
  return false;
}
