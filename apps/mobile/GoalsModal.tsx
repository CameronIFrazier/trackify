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

type GoalsModalProps = {
  visible: boolean;
  goals: Record<string, number>;
  onClose: () => void;
  onSave: (goals: Record<string, number>) => void;
  onResetToComputed?: () => void; // optional: revert to auto-calculated goals
};

export default function GoalsModal({
  visible,
  goals,
  onClose,
  onSave,
  onResetToComputed,
}: GoalsModalProps) {
  const [values, setValues] = useState<Record<string, number>>(goals);

  // Keep local copy in sync when the modal is reopened with fresh goals.
  // (Re-seed whenever it becomes visible.)
  const [lastVisible, setLastVisible] = useState(false);
  if (visible && !lastVisible) {
    setValues(goals);
    setLastVisible(true);
  }
  if (!visible && lastVisible) {
    setLastVisible(false);
  }

  const setValue = (key: string, text: string) => {
    setValues((prev) => ({
      ...prev,
      [key]: text === '' ? 0 : Number(text),
    }));
  };

  const handleSave = () => {
    onSave(values);
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
            Set your target daily amount for each nutrient. These are the goals your
            progress bars fill toward.
          </Text>

          {NUTRIENT_GROUPS.map((group) => (
            <View key={group.group} style={styles.group}>
              <Text style={styles.groupTitle}>{group.group}</Text>
              {group.items.map((item) => (
                <View key={item.key} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{item.label}</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="0"
                      value={
                        values[item.key] === undefined ? '' : String(values[item.key])
                      }
                      onChangeText={(t) => setValue(item.key, t)}
                    />
                    <Text style={styles.unit}>{item.unit}</Text>
                  </View>
                </View>
              ))}
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
            Reverts every goal to the values calculated from your profile.
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
  unit: { width: 42, marginLeft: 6, color: '#888', fontSize: 13 },

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