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
import { NUTRIENT_GROUPS, NutrientValues } from './nutrients';

type NutrientModalProps = {
  visible: boolean;
  foodName: string;
  initialValues: NutrientValues;
  onClose: () => void;
  onSave: (values: NutrientValues) => void;
};

export default function NutrientModal({
  visible,
  foodName,
  initialValues,
  onClose,
  onSave,
}: NutrientModalProps) {
  // Local editable copy of the nutrient values while the modal is open.
  const [values, setValues] = useState<NutrientValues>(initialValues);
  // Track which fields were filled by "assume" so we can show them differently.
  const [estimated, setEstimated] = useState<Record<string, boolean>>({});

  const setValue = (key: string, text: string) => {
    setValues((prev) => ({
      ...prev,
      [key]: text === '' ? undefined : Number(text),
    }));
    // If the user manually edits a field, it's no longer an estimate.
    setEstimated((prev) => ({ ...prev, [key]: false }));
  };

  // STUB for now: fills every empty field with a placeholder estimate (0),
  // and marks it as estimated. Later this calls an AI to make real guesses
  // from foodName + the values already entered.
  const assumeUnfilled = () => {
    setValues((prev) => {
      const next = { ...prev };
      const newlyEstimated: Record<string, boolean> = { ...estimated };
      NUTRIENT_GROUPS.forEach((g) =>
        g.items.forEach((item) => {
          if (next[item.key] === undefined) {
            next[item.key] = 0; // placeholder — AI will replace this
            newlyEstimated[item.key] = true;
          }
        })
      );
      setEstimated(newlyEstimated);
      return next;
    });
  };

  const handleSave = () => {
    onSave(values);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {foodName || 'Nutrients'}
          </Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.save}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {NUTRIENT_GROUPS.map((group) => (
            <View key={group.group} style={styles.group}>
              <Text style={styles.groupTitle}>{group.group}</Text>
              {group.items.map((item) => {
                const val = values[item.key];
                const isEst = estimated[item.key];
                return (
                  <View key={item.key} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{item.label}</Text>
                    <View style={styles.inputWrap}>
                      <TextInput
                        style={[styles.input, isEst && styles.inputEstimated]}
                        keyboardType="numeric"
                        placeholder="—"
                        value={val === undefined ? '' : String(val)}
                        onChangeText={(t) => setValue(item.key, t)}
                      />
                      <Text style={styles.unit}>{item.unit}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Assume unfilled button */}
          <TouchableOpacity style={styles.assumeButton} onPress={assumeUnfilled}>
            <Text style={styles.assumeText}>✨ Assume Unfilled</Text>
          </TouchableOpacity>
          <Text style={styles.assumeHint}>
            Fills empty fields with estimates (AI-powered later). Estimated fields
            appear highlighted — edit any to override.
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
    paddingTop: 50, // room for status bar
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', flex: 1, textAlign: 'center', marginHorizontal: 12 },
  cancel: { color: '#888', fontSize: 16 },
  save: { color: '#2e7d32', fontSize: 16, fontWeight: 'bold' },

  scroll: { padding: 16, paddingBottom: 60 },
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
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  fieldLabel: { fontSize: 15, color: '#333', flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', width: 130 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    flex: 1,
    textAlign: 'right',
  },
  inputEstimated: { backgroundColor: '#fff8e1', borderColor: '#ffb300' },
  unit: { width: 42, marginLeft: 6, color: '#888', fontSize: 13 },

  assumeButton: {
    backgroundColor: '#6a1b9a',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  assumeText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  assumeHint: { color: '#888', fontSize: 12, marginTop: 8, textAlign: 'center', lineHeight: 17 },
});