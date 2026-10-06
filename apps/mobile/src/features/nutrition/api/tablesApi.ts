// Talks to the Lambda "tables" route — manages the user's named food tables.
import { API_BASE, getWithRetry, postWithRetry } from '@/api/client';

const TABLES_URL = `${API_BASE}/tables`;

export type FoodTable = {
  id: string;
  name: string;
  sortOrder?: number;
};

// Load the user's tables (ordered). Returns null on failure.
export async function loadTables(userId: string): Promise<FoodTable[] | null> {
  return getWithRetry<FoodTable[]>(
    `${TABLES_URL}?userId=${encodeURIComponent(userId)}&type=tables`,
    (data) => data.tables ?? [],
    { label: 'loadTables' }
  );
}

function tablesPost(body: Record<string, unknown>): Promise<boolean> {
  return postWithRetry(TABLES_URL, { type: 'tables', ...body }, { label: 'tables POST' });
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
