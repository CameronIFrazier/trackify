import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  PROGRESS_ORDER,
  DAILY_VALUES,
  nutrientMeta,
  NutrientValues,
  NUTRIENT_GROUPS,
} from './nutrients';
import {
  Comparator,
  defaultComparator,
  goalColor,
  goalFillFraction,
  COMPARATOR_SYMBOLS,
} from './goalComparators';

type NutrientProgressProps = {
  totals: NutrientValues;                       // today's accumulated nutrients
  goals?: Record<string, number>;               // personalized goal amounts (falls back to DVs)
  comparators?: Record<string, Comparator>;     // per-nutrient direction (falls back to defaults)
  onEditGoals?: () => void;                     // open the goal-editing screen
  hiddenNutrients?: string[];                   // keys hidden from display (still tracked)
  onToggleHidden?: (key: string) => void;       // hide/unhide one nutrient (persists)
   onShowSources?: () => void;   
};

// Build ordered groups: each NUTRIENT_GROUP's keys, sorted by PROGRESS_ORDER.
const ORDER_INDEX: Record<string, number> = {};
PROGRESS_ORDER.forEach((k, i) => { ORDER_INDEX[k] = i; });

const SECTIONS = NUTRIENT_GROUPS.map((g) => ({
  title: g.group,
  keys: g.items
    .map((i) => i.key)
    .filter((k) => k in ORDER_INDEX)
    .sort((a, b) => ORDER_INDEX[a] - ORDER_INDEX[b]),
}));

export default function NutrientProgress({
  totals,
  goals,
  comparators,
  onEditGoals,
  hiddenNutrients = [],
  onToggleHidden,
  onShowSources,
}: NutrientProgressProps) {
  const [showHidden, setShowHidden] = useState(false);
  const hiddenSet = new Set(hiddenNutrients);
  const canToggle = !!onToggleHidden;

  const renderRow = (key: string) => {
    const goal = (goals ?? DAILY_VALUES)[key] ?? 0;
    const current = totals[key] ?? 0;
    const comparator: Comparator = comparators?.[key] ?? defaultComparator(key);
    const ratio = goal > 0 ? current / goal : 0;
    const fill = goalFillFraction(ratio);
    const color = goalColor(ratio, comparator);
    const meta = nutrientMeta(key);
    const sym = COMPARATOR_SYMBOLS[comparator];
    const isHidden = hiddenSet.has(key);

    return (
      <View key={key} style={[styles.row, isHidden && styles.rowHidden]}>
        {canToggle && (
          <TouchableOpacity onPress={() => onToggleHidden!(key)} style={styles.eyeBtn}>
            <Text style={styles.eyeIcon}>{isHidden ? '🚫' : '👁'}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.label} numberOfLines={1}>{meta.label}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${fill * 100}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.value} numberOfLines={1}>
          {current}
          <Text style={styles.goalPart}>
            {' '}{sym}{goal}{meta.unit === 'kcal' ? '' : meta.unit}
          </Text>
        </Text>
      </View>
    );
  };

  const totalHidden = hiddenNutrients.length;

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

       {onShowSources && (
        <TouchableOpacity style={styles.sourcesLink} onPress={onShowSources}>
          <Text style={styles.sourcesLinkText}>ⓘ  How are the default values calculated?</Text>
        </TouchableOpacity>
      )}

      {canToggle && totalHidden > 0 && (
        <TouchableOpacity style={styles.showHiddenBtn} onPress={() => setShowHidden((v) => !v)}>
          <Text style={styles.showHiddenText}>
            {showHidden ? 'Hide hidden' : `Show ${totalHidden} hidden`}
          </Text>
        </TouchableOpacity>
      )}

      {SECTIONS.map((section) => {
        // Visible keys in this section (plus hidden ones only when showHidden).
        const visible = section.keys.filter((k) => !hiddenSet.has(k));
        const hiddenInSection = section.keys.filter((k) => hiddenSet.has(k));
        const toRender = showHidden ? [...visible, ...hiddenInSection] : visible;
        if (toRender.length === 0) return null;
        return (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {toRender.map(renderRow)}
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
    marginBottom: 8,
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

  showHiddenBtn: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 6 },
  showHiddenText: { color: '#4338ca', fontSize: 12, fontWeight: '600' },
  sourcesLink: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 4 },
  sourcesLinkText: { color: '#1565c0', fontSize: 13, fontWeight: '600' },

  section: { marginTop: 10 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 3,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    minWidth: 0,
  },
  rowHidden: { opacity: 0.45 },
  eyeBtn: { paddingRight: 6, paddingVertical: 2 },
  eyeIcon: { fontSize: 12 },
  label: { width: 96, fontSize: 12, color: '#444' },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    overflow: 'hidden',
    marginHorizontal: 8,
    minWidth: 0,
  },
  barFill: { height: '100%', borderRadius: 5 },
  value: { width: 90, fontSize: 10, color: '#888', textAlign: 'right' },
  goalPart: { color: '#aaa' },
});