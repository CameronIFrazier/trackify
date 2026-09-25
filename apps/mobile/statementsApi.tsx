// Talks to the Lambda "statements" route — saved Track-a-Nutrient statements.

const BASE_URL = 'https://gmdcz4ashy6yfypp3l7wagi2ee0ihpor.lambda-url.us-west-2.on.aws';
const STATEMENTS_URL = `${BASE_URL}/statements`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SavedStatement = {
  id: string;
  text: string;
  params: Record<string, unknown>;
  createdAt: string; // ISO
};

export async function loadStatements(userId: string): Promise<SavedStatement[] | null> {
  const delays = [0, 3000, 5000, 8000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(
        `${STATEMENTS_URL}?userId=${encodeURIComponent(userId)}&type=statements`,
        { method: 'GET' }
      );
      if (res.ok) {
        const data = await res.json();
        return data.statements ?? [];
      }
      console.log(`loadStatements attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`loadStatements attempt ${attempt + 1} failed:`, e);
    }
  }
  return null;
}

async function post(body: Record<string, unknown>): Promise<boolean> {
  const delays = [0, 3000, 5000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(STATEMENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'statements', ...body }),
      });
      if (res.ok) return true;
      console.log(`statements POST attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`statements POST attempt ${attempt + 1} failed:`, e);
    }
  }
  return false;
}

export function saveStatement(
  userId: string,
  statementId: string,
  text: string,
  params: Record<string, unknown>
) {
  return post({ userId, action: 'create', statementId, text, params });
}

export function deleteStatement(userId: string, statementId: string) {
  return post({ userId, action: 'delete', statementId });
}