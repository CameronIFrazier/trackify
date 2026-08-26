// Personalized nutrient goals from user stats.
// Uses the Mifflin-St Jeor equation for calories and RDA tables for the rest —
// established nutrition science, no AI needed.

import { DAILY_VALUES, ALL_NUTRIENT_KEYS } from './nutrients';
import { Comparator, defaultComparator } from './goalComparators';

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';

export type UserProfile = {
  name: string;
  email: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg?: number;          // optional
  activity: ActivityLevel;    // defaults to 'moderate' if skipped
};

// Activity multipliers applied to BMR (standard TDEE factors).
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

// Mifflin-St Jeor BMR, then multiply by activity for maintenance calories.
function calorieGoal(p: UserProfile): number {
  // Need a weight for this formula; if weight was skipped, fall back to a
  // reasonable estimate from height (a rough default so we still show a goal).
  const weight = p.weightKg ?? estimateWeightFromHeight(p.heightCm, p.sex);
  const s = p.sex === 'male' ? 5 : -161;
  const bmr = 10 * weight + 6.25 * p.heightCm - 5 * p.age + s;
  const tdee = bmr * ACTIVITY_FACTORS[p.activity];
  return Math.round(tdee / 10) * 10; // round to nearest 10
}

// Very rough fallback weight if the user skipped it (BMI ~22 midpoint).
function estimateWeightFromHeight(heightCm: number, sex: Sex): number {
  const heightM = heightCm / 100;
  return Math.round(22 * heightM * heightM);
}

// Protein goal: grams per kg of body weight. 1.2 g/kg is a solid general target
// (higher than the 0.8 RDA minimum, aligned with active/muscle-maintenance).
function proteinGoal(p: UserProfile): number {
  const weight = p.weightKg ?? estimateWeightFromHeight(p.heightCm, p.sex);
  return Math.round(weight * 1.2);
}

// RDA values that differ by sex (the ones where it meaningfully matters).
// Everything else falls back to the generic DAILY_VALUES.
const SEX_SPECIFIC_RDA: Record<Sex, Record<string, number>> = {
  male: {
    iron: 8,
    magnesium: 420,
    zinc: 11,
    vitaminC: 90,
    vitaminA: 900,
    thiamin: 1.2,
    riboflavin: 1.3,
    vitaminB6: 1.3,
  },
  female: {
    iron: 18,
    magnesium: 320,
    zinc: 8,
    vitaminC: 75,
    vitaminA: 700,
    thiamin: 1.1,
    riboflavin: 1.1,
    vitaminB6: 1.3,
  },
};

// Build the full personalized goal set: computed calories/protein, sex-adjusted
// RDAs where relevant, generic DVs for the rest.
export function computeGoals(p: UserProfile): Record<string, number> {
  const goals: Record<string, number> = { ...DAILY_VALUES };

  // Apply sex-specific RDAs.
  const sexRda = SEX_SPECIFIC_RDA[p.sex];
  Object.keys(sexRda).forEach((key) => {
    goals[key] = sexRda[key];
  });

  // Override with personalized computed values.
  goals.calories = calorieGoal(p);
  goals.protein = proteinGoal(p);

  // Macro targets scaled to calories:
  // carbs ~45% of calories (4 kcal/g), fat ~30% (9 kcal/g).
  goals.totalCarbs = Math.round((goals.calories * 0.45) / 4);
  goals.totalFat = Math.round((goals.calories * 0.30) / 9);
  // Fiber scales with calories: ~14g per 1000 kcal (dietary guideline).
  goals.fiber = Math.round((goals.calories / 1000) * 14);
  // Added sugars: keep under 10% of calories (guideline).
  goals.addedSugars = Math.round((goals.calories * 0.10) / 4);
  goals.totalSugars = goals.addedSugars * 2; // rough total-sugar allowance

  return goals;
}

// Default comparator for every nutrient: >= for "get enough" nutrients
// (protein, fiber, vitamins, minerals), <= for "stay under" ones
// (calories, sugar, fat, sodium, cholesterol, etc.).
export function computeComparators(): Record<string, Comparator> {
  const out: Record<string, Comparator> = {};
  ALL_NUTRIENT_KEYS.forEach((key) => {
    out[key] = defaultComparator(key);
  });
  return out;
}