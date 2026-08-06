import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PROGRESS_ORDER, DAILY_VALUES, nutrientMeta, NutrientValues } from './nutrients';

type NutrientProgressProps = {
  totals: NutrientValues;               // today's accumulated nutrients
  goals?: Record<string, number>;       // personalized goals (falls back to DVs)
  onEditGoals?: () => void;             // open the goal-editing screen
};

// Color shifts as a nutrient approaches/exceeds its goal.
function barColor(pct: number): string {
  if (pct >= 1) return '#2e7d32';      // met goal — green
  if (pct >= 0.6) return '#66bb6a';    // getting there — light green
  if (pct >= 0.3) return '#ffa726';    // partial — amber
  return '#ef9a9a';                    // low — soft red
}

export default function NutrientProgress({ totals, goals, onEditGoals }: NutrientProgressProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Today's Nutrients</Text>
        {onEditGoals && (
          <TouchableOpacity style={styles.editButton} onPress={onEditGoals}>
            <Text style={styles.editText}>Edit Goals</Text>
          </TouchableOpacity>
        )}
      </View>
      {PROGRESS_ORDER.map((key) => {
        const goal = (goals ?? DAILY_VALUES)[key] ?? 0;
        const current = totals[key] ?? 0;
        const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
        const rawPct = goal > 0 ? current / goal : 0; // uncapped, for the % label
        const meta = nutrientMeta(key);
        return (
          <View key={key} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>
              {meta.label}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${pct * 100}%`, backgroundColor: barColor(rawPct) },
                ]}
              />
            </View>
            <Text style={styles.value}>
              {current}/{goal}
              {meta.unit === 'kcal' ? '' : meta.unit}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heading: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  editButton: {
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  editText: { color: '#4338ca', fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6, // tight spacing — packed without cramming
  },
  label: { width: 96, fontSize: 12, color: '#444' },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: { height: '100%', borderRadius: 5 },
  value: { width: 64, fontSize: 10, color: '#888', textAlign: 'right' },
});