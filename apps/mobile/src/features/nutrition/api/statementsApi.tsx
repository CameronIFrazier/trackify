// Talks to the Lambda "statements" route — saved Track-a-Nutrient statements.
import { API_BASE, getWithRetry, postWithRetry } from '@/api/client';

const STATEMENTS_URL = `${API_BASE}/statements`;

export type SavedStatement = {
  id: string;
  text: string;
  params: Record<string, unknown>;
  createdAt: string; // ISO
};

export async function loadStatements(userId: string): Promise<SavedStatement[] | null> {
  return getWithRetry<SavedStatement[]>(
    `${STATEMENTS_URL}?userId=${encodeURIComponent(userId)}&type=statements`,
    (data) => data.statements ?? [],
    { label: 'loadStatements' }
  );
}

function post(body: Record<string, unknown>): Promise<boolean> {
  return postWithRetry(STATEMENTS_URL, { type: 'statements', ...body }, { label: 'statements POST' });
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
