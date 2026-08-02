// The canonical nutrient list, based on the FDA Nutrition Facts label standard.
// Grouped so the modal can render labeled sections. `key` is the storage field,
// `label` is what the user sees, `unit` is the measurement unit.

export type NutrientDef = {
  key: string;
  label: string;
  unit: string;
};

export type NutrientGroup = {
  group: string;
  items: NutrientDef[];
};

export const NUTRIENT_GROUPS: NutrientGroup[] = [
  {
    group: 'Macros',
    items: [
      { key: 'calories', label: 'Calories', unit: 'kcal' },
      { key: 'protein', label: 'Protein', unit: 'g' },
      { key: 'totalFat', label: 'Total Fat', unit: 'g' },
      { key: 'saturatedFat', label: 'Saturated Fat', unit: 'g' },
      { key: 'transFat', label: 'Trans Fat', unit: 'g' },
      { key: 'monounsaturatedFat', label: 'Monounsaturated Fat', unit: 'g' },
      { key: 'polyunsaturatedFat', label: 'Polyunsaturated Fat', unit: 'g' },
      { key: 'totalCarbs', label: 'Total Carbohydrate', unit: 'g' },
      { key: 'fiber', label: 'Dietary Fiber', unit: 'g' },
      { key: 'totalSugars', label: 'Total Sugars', unit: 'g' },
      { key: 'addedSugars', label: 'Added Sugars', unit: 'g' },
      { key: 'cholesterol', label: 'Cholesterol', unit: 'mg' },
    ],
  },
  {
    group: 'Vitamins',
    items: [
      { key: 'vitaminA', label: 'Vitamin A', unit: 'mcg' },
      { key: 'vitaminC', label: 'Vitamin C', unit: 'mg' },
      { key: 'vitaminD', label: 'Vitamin D', unit: 'mcg' },
      { key: 'vitaminE', label: 'Vitamin E', unit: 'mg' },
      { key: 'vitaminK', label: 'Vitamin K', unit: 'mcg' },
      { key: 'thiamin', label: 'Thiamin (B1)', unit: 'mg' },
      { key: 'riboflavin', label: 'Riboflavin (B2)', unit: 'mg' },
      { key: 'niacin', label: 'Niacin (B3)', unit: 'mg' },
      { key: 'vitaminB6', label: 'Vitamin B6', unit: 'mg' },
      { key: 'folate', label: 'Folate (B9)', unit: 'mcg' },
      { key: 'vitaminB12', label: 'Vitamin B12', unit: 'mcg' },
      { key: 'pantothenicAcid', label: 'Pantothenic Acid (B5)', unit: 'mg' },
      { key: 'choline', label: 'Choline', unit: 'mg' },
    ],
  },
  {
    group: 'Minerals',
    items: [
      { key: 'calcium', label: 'Calcium', unit: 'mg' },
      { key: 'iron', label: 'Iron', unit: 'mg' },
      { key: 'magnesium', label: 'Magnesium', unit: 'mg' },
      { key: 'phosphorus', label: 'Phosphorus', unit: 'mg' },
      { key: 'potassium', label: 'Potassium', unit: 'mg' },
      { key: 'sodium', label: 'Sodium', unit: 'mg' },
      { key: 'zinc', label: 'Zinc', unit: 'mg' },
      { key: 'copper', label: 'Copper', unit: 'mg' },
      { key: 'manganese', label: 'Manganese', unit: 'mg' },
      { key: 'selenium', label: 'Selenium', unit: 'mcg' },
    ],
  },
];

// Flat list of every nutrient key, handy for iteration.
export const ALL_NUTRIENT_KEYS: string[] = NUTRIENT_GROUPS.flatMap((g) =>
  g.items.map((i) => i.key)
);

// A food's nutrient values: key -> number (or undefined if unfilled).
export type NutrientValues = Record<string, number | undefined>;

// Which keys show as editable columns in the compact table view.
export const SUMMARY_KEYS = ['calories', 'protein', 'totalCarbs', 'totalFat', 'totalSugars'];

// Standard adult Daily Values (FDA reference amounts) — used as the "full" point
// for each progress bar. Based on a 2,000 kcal reference diet.
export const DAILY_VALUES: Record<string, number> = {
  calories: 2000,
  protein: 50,
  totalSugars: 50,      // no official DV; using added-sugars-style reference
  totalFat: 78,
  saturatedFat: 20,
  totalCarbs: 275,
  fiber: 28,
  addedSugars: 50,
  sodium: 2300,
  potassium: 4700,
  cholesterol: 300,
  transFat: 2,
  monounsaturatedFat: 44,
  polyunsaturatedFat: 22,
  calcium: 1300,
  iron: 18,
  vitaminD: 20,
  vitaminC: 90,
  vitaminA: 900,
  vitaminE: 15,
  vitaminK: 120,
  thiamin: 1.2,
  riboflavin: 1.3,
  niacin: 16,
  vitaminB6: 1.7,
  folate: 400,
  vitaminB12: 2.4,
  pantothenicAcid: 5,
  choline: 550,
  magnesium: 420,
  phosphorus: 1250,
  zinc: 11,
  copper: 0.9,
  manganese: 2.3,
  selenium: 55,
};

// Progress-bar display order: most essential for daily life first.
// User asked: always start with calories, protein, sugar. Then the macros the
// body needs in largest amounts, then critical electrolytes, then the rest.
export const PROGRESS_ORDER: string[] = [
  'calories',
  'protein',
  'totalSugars',
  'totalCarbs',
  'totalFat',
  'fiber',
  'saturatedFat',
  'sodium',
  'potassium',
  'cholesterol',
  'calcium',
  'iron',
  'vitaminD',
  'vitaminC',
  'vitaminB12',
  'magnesium',
  'vitaminA',
  'folate',
  'zinc',
  'vitaminB6',
  'vitaminE',
  'niacin',
  'riboflavin',
  'thiamin',
  'phosphorus',
  'vitaminK',
  'addedSugars',
  'transFat',
  'monounsaturatedFat',
  'polyunsaturatedFat',
  'pantothenicAcid',
  'choline',
  'copper',
  'manganese',
  'selenium',
];

// Label + unit lookup for any key.
const LABEL_LOOKUP: Record<string, { label: string; unit: string }> = {};
NUTRIENT_GROUPS.forEach((g) =>
  g.items.forEach((i) => (LABEL_LOOKUP[i.key] = { label: i.label, unit: i.unit }))
);
export function nutrientMeta(key: string) {
  return LABEL_LOOKUP[key] ?? { label: key, unit: '' };
}