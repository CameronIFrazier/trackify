// Barcode → food lookup via Open Food Facts (free, open, no API key).
// Maps OFF's nutriment fields onto Trackify's 35 nutrient keys. Missing
// fields are simply left out (the caller leaves those blank).
//
// OFF normalizes micronutrients to GRAMS in the _100g / _serving fields
// (energy is the exception, in kcal), so the multipliers below convert grams
// to the app's unit: ×1000 for g→mg, ×1_000_000 for g→mcg.

export type BarcodeResult = {
  name: string;
  nutrients: Record<string, number>;
  servingSize: string; // "100g" or the product's serving size if OFF has one
};

// [appKey, [possible OFF base keys], multiplier from OFF's grams to app unit]
const MAP: [string, string[], number][] = [
  ['calories', ['energy-kcal'], 1],
  ['protein', ['proteins'], 1],
  ['totalFat', ['fat'], 1],
  ['saturatedFat', ['saturated-fat'], 1],
  ['transFat', ['trans-fat'], 1],
  ['monounsaturatedFat', ['monounsaturated-fat'], 1],
  ['polyunsaturatedFat', ['polyunsaturated-fat'], 1],
  ['totalCarbs', ['carbohydrates'], 1],
  ['fiber', ['fiber'], 1],
  ['totalSugars', ['sugars'], 1],
  ['addedSugars', ['added-sugars'], 1],
  ['cholesterol', ['cholesterol'], 1000],
  ['vitaminA', ['vitamin-a'], 1_000_000],
  ['vitaminC', ['vitamin-c'], 1000],
  ['vitaminD', ['vitamin-d'], 1_000_000],
  ['vitaminE', ['vitamin-e'], 1000],
  ['vitaminK', ['vitamin-k'], 1_000_000],
  ['thiamin', ['vitamin-b1'], 1000],
  ['riboflavin', ['vitamin-b2'], 1000],
  ['niacin', ['vitamin-pp', 'niacin'], 1000],
  ['vitaminB6', ['vitamin-b6'], 1000],
  ['folate', ['vitamin-b9', 'folates'], 1_000_000],
  ['vitaminB12', ['vitamin-b12'], 1_000_000],
  ['pantothenicAcid', ['pantothenic-acid'], 1000],
  ['choline', ['choline'], 1000],
  ['calcium', ['calcium'], 1000],
  ['iron', ['iron'], 1000],
  ['magnesium', ['magnesium'], 1000],
  ['phosphorus', ['phosphorus'], 1000],
  ['potassium', ['potassium'], 1000],
  ['sodium', ['sodium'], 1000],
  ['zinc', ['zinc'], 1000],
  ['copper', ['copper'], 1000],
  ['manganese', ['manganese'], 1000],
  ['selenium', ['selenium'], 1_000_000],
];

// Read one numeric nutriment value (trying each candidate base key + suffix).
function pick(nutriments: any, keys: string[], suffix: string): number | undefined {
  for (const k of keys) {
    const v = nutriments[k + suffix];
    if (typeof v === 'number' && !isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

// Look up a barcode. Returns the mapped product, 'notfound' if OFF has no
// product, or null on a network/parse error.
export async function lookupBarcode(code: string): Promise<BarcodeResult | 'notfound' | null> {
  const clean = (code || '').trim();
  if (!clean) return 'notfound';
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json` +
    `?fields=product_name,brands,nutriments,serving_size`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'TrackifyApp/1.0 (trackify.lt)' },
    });
    if (res.status === 404) return 'notfound';
    if (!res.ok) {
      console.log('lookupBarcode: status', res.status);
      return null;
    }
    const data = await res.json();
    const product = data && data.product;
    if (!product || !product.nutriments) return 'notfound';
    const nutriments = product.nutriments;

    // Prefer per-serving values when the product defines a serving; else per 100g.
    const hasServing =
      !!product.serving_size && typeof pick(nutriments, ['energy-kcal'], '_serving') === 'number';
    const suffix = hasServing ? '_serving' : '_100g';
    const servingSize = hasServing ? String(product.serving_size) : '100g';

    const nutrients: Record<string, number> = {};
    for (const [appKey, offKeys, mult] of MAP) {
      const v = pick(nutriments, offKeys, suffix);
      if (v !== undefined) nutrients[appKey] = Math.round(v * mult * 100) / 100;
    }

    const name = (product.product_name || product.brands || '').toString().trim();
    return { name, nutrients, servingSize };
  } catch (e) {
    console.log('lookupBarcode failed:', e);
    return null;
  }
}
