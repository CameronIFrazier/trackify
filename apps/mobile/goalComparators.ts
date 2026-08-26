// Directional goal comparators + the 5-band color logic that both the goals
// editor and the progress bars share.

export type Comparator = 'lt' | 'lte' | 'eq' | 'gte' | 'gt';

// Word labels users see (they think in words, not symbols).
export const COMPARATOR_LABELS: Record<Comparator, string> = {
  lt: 'less than',
  lte: 'less than or equal to',
  eq: 'equal to',
  gte: 'greater than or equal to',
  gt: 'greater than',
};

// Short symbol for compact display next to the words.
export const COMPARATOR_SYMBOLS: Record<Comparator, string> = {
  lt: '<',
  lte: '\u2264',
  eq: '=',
  gte: '\u2265',
  gt: '>',
};

export const COMPARATOR_ORDER: Comparator[] = ['lt', 'lte', 'eq', 'gte', 'gt'];

// Which nutrients you want to HIT OR EXCEED (default \u2265) vs STAY UNDER (default \u2264).
// Everything not listed here defaults to \u2264 ("at most").
const AT_LEAST_KEYS = new Set<string>([
  'protein',
  'fiber',
  // vitamins
  'vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK',
  'thiamin', 'riboflavin', 'niacin', 'vitaminB6', 'folate', 'vitaminB12',
  'pantothenicAcid', 'choline',
  // minerals (the "get enough" ones)
  'calcium', 'iron', 'magnesium', 'phosphorus', 'potassium', 'zinc',
  'copper', 'manganese', 'selenium',
]);

// The sensible default comparator for a computed goal, by nutrient key.
export function defaultComparator(key: string): Comparator {
  return AT_LEAST_KEYS.has(key) ? 'gte' : 'lte';
}

// Does this comparator mean "more is better" (fill climbs toward success)?
function isAtLeast(c: Comparator): boolean {
  return c === 'gte' || c === 'gt';
}
function isAtMost(c: Comparator): boolean {
  return c === 'lte' || c === 'lt';
}

// The 5-band palette. Blue = goal met / best state; red = worst.
const COLORS = {
  blue: '#1e88e5',
  green: '#43a047',
  yellow: '#fdd835',
  orange: '#fb8c00',
  red: '#e53935',
  empty: '#eee',
};

// Given the ratio current/goal and the comparator, return the bar color.
// ratio is uncapped (can exceed 1).
export function goalColor(ratio: number, comparator: Comparator): string {
  if (!isFinite(ratio) || ratio < 0) ratio = 0;

  if (isAtLeast(comparator)) {
    // More is good: climb red -> orange -> yellow -> green -> blue(met).
    if (ratio >= 1) return COLORS.blue;
    if (ratio >= 0.75) return COLORS.green;
    if (ratio >= 0.5) return COLORS.yellow;
    if (ratio >= 0.25) return COLORS.orange;
    return COLORS.red;
  }

  if (isAtMost(comparator)) {
    // Less is good: blue(safe) -> green -> yellow -> orange -> red(over).
    if (ratio >= 1) return COLORS.red;       // hit or passed the limit
    if (ratio >= 0.75) return COLORS.orange;
    if (ratio >= 0.5) return COLORS.yellow;
    if (ratio >= 0.25) return COLORS.green;
    return COLORS.blue;                       // comfortably under
  }

  // eq (exactly): approach like "more is good", blue in a small window at the
  // target, red once clearly over.
  if (ratio > 1.03) return COLORS.red;        // overshot
  if (ratio >= 1) return COLORS.blue;         // hit it (100%-103%)
  if (ratio >= 0.75) return COLORS.green;
  if (ratio >= 0.5) return COLORS.yellow;
  if (ratio >= 0.25) return COLORS.orange;
  return COLORS.red;
}

// How full the bar should draw (0..1). For "less is good" goals the bar still
// fills as the value rises (so a full red bar = you've hit the limit).
export function goalFillFraction(ratio: number): number {
  if (!isFinite(ratio) || ratio < 0) return 0;
  return Math.min(ratio, 1);
}