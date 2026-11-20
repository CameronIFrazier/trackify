// Calls the Lambda "estimate" route, which uses Amazon Bedrock (Claude) to
// estimate a food's nutrient values from its name + any values already entered.
// This one is a single-shot call (no cold-start retry) by design.
import { API_BASE } from '@/api/client';

const ESTIMATE_URL = `${API_BASE}/estimate`;

export type NutrientSchemaItem = { key: string; label: string; unit: string };

// An optional food photo to improve the estimate (base64-encoded, no data: prefix).
export type EstimateImage = { base64: string; mediaType: string };

// Camera flow: estimate a food's nutrients AND guess its name from a photo,
// when the user hasn't typed a name. Returns { nutrients, name } or null.
export async function estimateFoodFromImage(
  image: EstimateImage,
  schema: NutrientSchemaItem[]
): Promise<{ nutrients: Record<string, number>; name: string } | null> {
  try {
    const res = await fetch(ESTIMATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'estimate', foodName: '', known: {}, schema, image, wantName: true }),
    });
    if (!res.ok) {
      console.log('estimateFoodFromImage: status', res.status);
      return null;
    }
    const data = await res.json();
    if (!data.nutrients) return null;
    return { nutrients: data.nutrients, name: (data.name || '').toString() };
  } catch (e) {
    console.log('estimateFoodFromImage failed:', e);
    return null;
  }
}

// Returns a map of nutrientKey -> estimated number, or null on failure.
export async function estimateNutrients(
  foodName: string,
  known: Record<string, number | undefined>,
  schema: NutrientSchemaItem[],
  image?: EstimateImage
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
      body: JSON.stringify({ type: 'estimate', foodName, known: knownClean, schema, image }),
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
