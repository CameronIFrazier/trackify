// Talks to the Lambda "tables" route — manages the user's named food tables.

const BASE_URL = 'https://gmdcz4ashy6yfypp3l7wagi2ee0ihpor.lambda-url.us-west-2.on.aws';
const TABLES_URL = `${BASE_URL}/tables`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FoodTable = {
  id: string;
  name: string;
  sortOrder?: number;
};

// Load the user's tables (ordered). Returns null on failure.
export async function loadTables(userId: string): Promise<FoodTable[] | null> {
  const delays = [0, 3000, 5000, 8000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(
        `${TABLES_URL}?userId=${encodeURIComponent(userId)}&type=tables`,
        { method: 'GET' }
      );
      if (res.ok) {
        const data = await res.json();
        return data.tables ?? [];
      }
      console.log(`loadTables attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`loadTables attempt ${attempt + 1} failed:`, e);
    }
  }
  return null;
}

async function tablesPost(body: Record<string, unknown>): Promise<boolean> {
  const delays = [0, 3000, 5000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const res = await fetch(TABLES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'tables', ...body }),
      });
      if (res.ok) return true;
      console.log(`tables POST attempt ${attempt + 1}: status ${res.status}`);
    } catch (e) {
      console.log(`tables POST attempt ${attempt + 1} failed:`, e);
    }
  }
  return false;
}

export function createTable(userId: string, tableId: string, name: string, sortOrder: number) {
  return tablesPost({ userId, action: 'create', tableId, name, sortOrder });
}

export function renameTable(userId: string, tableId: string, name: string) {
  return tablesPost({ userId, action: 'rename', tableId, name });
}

export function deleteTable(userId: string, tableId: string) {
  return tablesPost({ userId, action: 'delete', tableId });
}

// Bulk upsert the full table list (persists names + order in one call).
export function syncTables(userId: string, tables: FoodTable[]) {
  return tablesPost({ userId, action: 'sync', tables });
}