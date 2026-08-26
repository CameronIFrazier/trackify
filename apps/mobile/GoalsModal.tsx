import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { NUTRIENT_GROUPS } from './nutrients';
import {
  Comparator,
  COMPARATOR_ORDER,
  COMPARATOR_LABELS,
  COMPARATOR_SYMBOLS,
  defaultComparator,
} from './goalComparators';

type GoalsModalProps = {
  visible: boolean;
  goals: Record<string, number>;
  comparators: Record<string, Comparator>;
  onClose: () => void;
  onSave: (goals: Record<string, number>, comparators: Record<string, Comparator>) => void;
  onResetToComputed?: () => void; // optional: revert to auto-calculated goals
};

export default function GoalsModal({
  visible,
  goals,
  comparators,
  onClose,
  onSave,
  onResetToComputed,
}: GoalsModalProps) {
  const [values, setValues] = useState<Record<string, number>>(goals);
  const [comps, setComps] = useState<Record<string, Comparator>>(comparators);
  // Which nutrient's comparator dropdown is open (null = none).
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  // Re-seed local copies whenever the modal becomes visible.
  const [lastVisible, setLastVisible] = useState(false);
  if (visible && !lastVisible) {
    setValues(goals);
    setComps(comparators);
    setLastVisible(true);
  }
  if (!visible && lastVisible) {
    setLastVisible(false);
    setOpenPicker(null);
  }

  const setValue = (key: string, text: string) => {
    setValues((prev) => ({
      ...prev,
      [key]: text === '' ? 0 : Number(text),
    }));
  };

  const setComp = (key: string, c: Comparator) => {
    setComps((prev) => ({ ...prev, [key]: c }));
    setOpenPicker(null);
  };

  const handleSave = () => {
    onSave(values, comps);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Daily Goals</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.save}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>
            Set your target for each nutrient and whether you want to stay under it,
            hit it exactly, or reach at least that much. Bars turn blue when the goal
            is met.
          </Text>

          {NUTRIENT_GROUPS.map((group) => (
            <View key={group.group} style={styles.group}>
              <Text style={styles.groupTitle}>{group.group}</Text>
              {group.items.map((item) => {
                const comp = comps[item.key] ?? defaultComparator(item.key);
                const isOpen = openPicker === item.key;
                return (
                  <View key={item.key} style={styles.fieldBlock}>
                    <View style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{item.label}</Text>
                      <View style={styles.inputWrap}>
                        <TextInput
                          style={styles.input}
                          keyboardType="numeric"
                          placeholder="0"
                          value={values[item.key] === undefined ? '' : String(values[item.key])}
                          onChangeText={(t) => setValue(item.key, t)}
                        />
                        <Text style={styles.unit}>{item.unit}</Text>
                      </View>
                    </View>

                    {/* Comparator selector */}
                    <TouchableOpacity
                      style={styles.compButton}
                      onPress={() => setOpenPicker(isOpen ? null : item.key)}
                    >
                      <Text style={styles.compButtonText}>
                        Goal: {COMPARATOR_SYMBOLS[comp]} {COMPARATOR_LABELS[comp]}
                      </Text>
                      <Text style={styles.compChevron}>{isOpen ? '\u25B2' : '\u25BC'}</Text>
                    </TouchableOpacity>

                    {isOpen && (
                      <View style={styles.compOptions}>
                        {COMPARATOR_ORDER.map((c) => (
                          <TouchableOpacity
                            key={c}
                            style={[styles.compOption, c === comp && styles.compOptionSelected]}
                            onPress={() => setComp(item.key, c)}
                          >
                            <Text
                              style={[
                                styles.compOptionText,
                                c === comp && styles.compOptionTextSelected,
                              ]}
                            >
                              {COMPARATOR_SYMBOLS[c]}  {COMPARATOR_LABELS[c]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          {onResetToComputed && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                onResetToComputed();
                onClose();
              }}
            >
              <Text style={styles.resetText}>↺ Reset to Recommended</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.resetHint}>
            Reverts every goal and direction to the values calculated from your profile.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingTop: 50,
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', flex: 1, textAlign: 'center', marginHorizontal: 12 },
  cancel: { color: '#888', fontSize: 16 },
  save: { color: '#2e7d32', fontSize: 16, fontWeight: 'bold' },

  scroll: { padding: 16, paddingBottom: 60 },
  intro: { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 18 },
  group: { marginBottom: 24 },
  groupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 4,
  },

  fieldBlock: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
    paddingBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  fieldLabel: { fontSize: 15, color: '#333', flex: 1, minWidth: 0, paddingRight: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', flexBasis: 130, flexShrink: 1, minWidth: 90 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  unit: { width: 42, marginLeft: 6, color: '#888', fontSize: 13 },

  compButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    backgroundColor: '#f5f7ff',
    borderWidth: 1,
    borderColor: '#dde3ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  compButtonText: { color: '#4338ca', fontSize: 13, fontWeight: '600' },
  compChevron: { color: '#4338ca', fontSize: 11 },
  compOptions: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  compOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  compOptionSelected: { backgroundColor: '#eef2ff' },
  compOptionText: { fontSize: 14, color: '#333' },
  compOptionTextSelected: { color: '#4338ca', fontWeight: '700' },

  resetButton: {
    backgroundColor: '#1565c0',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  resetText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  resetHint: { color: '#888', fontSize: 12, marginTop: 8, textAlign: 'center' },
});