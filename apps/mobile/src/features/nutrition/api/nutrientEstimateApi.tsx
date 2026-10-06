// Calls the Lambda "estimate" route, which uses Amazon Bedrock (Claude) to
// estimate a food's nutrient values from its name + any values already entered.
// This one is a single-shot call (no cold-start retry) by design.
import { API_BASE } from '@/api/client';

const ESTIMATE_URL = `${API_BASE}/estimate`;

export type NutrientSchemaItem = { key: string; label: string; unit: string };

// Returns a map of nutrientKey -> estimated number, or null on failure.
export async function estimateNutrients(
  foodName: string,
  known: Record<string, number | undefined>,
  schema: NutrientSchemaItem[]
): Promise<Record<string, number> | null> {
  // Strip undefined/NaN from the known values before sending.
  const knownClean: Record<string, number> = {};
  Object.entries(known).forEach(([k, v]) => {
    if (v !== undefined && !isNaN(Number(v))) knownClean[k] = Number(v);
  });

  try {
    const res = await fetch(ESTIMATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'estimate', foodName, known: knownClean, schema }),
    });
    if (!res.ok) {
      console.log('estimateNutrients: status', res.status);
      return null;
    }
    const data = await res.json();
    return data.nutrients ?? null;
  } catch (e) {
    console.log('estimateNutrients failed:', e);
    return null;
  }
}
