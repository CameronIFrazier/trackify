// Barcode "Add a food" flow.
//
// Opened from the barcode icon in the top nav. On native it opens a live
// camera scanner (expo-camera); on web it falls back to typing the barcode in
// by hand. After a code is read it's looked up in Open Food Facts, then a
// review screen shows the product name, the mapped nutrients (missing ones left
// blank), and a dropdown to pick which table to add it to (or none).
//
// Requires expo-camera:  npx expo install expo-camera
import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NUTRIENT_GROUPS, NutrientValues } from '@/features/nutrition/lib/nutrients';
import { lookupBarcode } from '@/features/nutrition/api/barcodeApi';
import { loadFoods, saveFoods, FoodRow } from '@/features/nutrition/api/foodApi';
import { FoodTable, loadTables } from '@/features/nutrition/api/tablesApi';

const NO_TABLE = '__none__';

type Stage = 'scan' | 'looking' | 'review' | 'notfound';

type Props = {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
  onAdded: (tableId: string) => void;
};

export default function BarcodeAddModal({ visible, userId, onClose, onAdded }: Props) {
  const [stage, setStage] = useState<Stage>('scan');
  const [manualCode, setManualCode] = useState('');
  const [name, setName] = useState('');
  const [values, setValues] = useState<NutrientValues>({});
  const [servingSize, setServingSize] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [tables, setTables] = useState<FoodTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>(NO_TABLE);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  // Guards one scan at a time + one-time setup per open.
  const scannedRef = useRef(false);
  const startedRef = useRef(false);

  const reset = () => {
    setStage('scan');
    setManualCode('');
    setName('');
    setValues({});
    setServingSize('');
    setError('');
    setSaving(false);
    setPickerOpen(false);
    scannedRef.current = false;
  };

  // On open: load tables, ask for camera permission (native).
  useEffect(() => {
    if (!visible) {
      startedRef.current = false;
      reset();
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      if (userId) {
        const list = await loadTables(userId);
        if (list && list.length > 0) {
          setTables(list);
          setSelectedTableId(list[0].id);
        }
      }
      if (Platform.OS !== 'web' && permission && !permission.granted) {
        requestPermission();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const setValue = (key: string, text: string) => {
    setValues((prev) => ({ ...prev, [key]: text === '' ? undefined : Number(text) }));
  };

  // Look a code up and move to the review screen.
  const handleCode = async (code: string) => {
    setError('');
    setStage('looking');
    const result = await lookupBarcode(code);
    if (result === null) {
      setError('Could not reach the food database — check your connection and try again.');
      setStage('notfound');
      return;
    }
    if (result === 'notfound') {
      setStage('notfound');
      return;
    }
    setName(result.name);
    setValues(result.nutrients);
    setServingSize(result.servingSize);
    setStage('review');
  };

  // Native scanner callback (guarded so it fires once).
  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current || stage !== 'scan') return;
    scannedRef.current = true;
    handleCode(data);
  };

  const scanAgain = () => {
    scannedRef.current = false;
    setManualCode('');
    setError('');
    setStage('scan');
  };

  // From "not found": let the user fill it in by hand.
  const enterManually = () => {
    setName('');
    setValues({});
    setServingSize('100g');
    setStage('review');
  };

  const selectedLabel =
    selectedTableId === NO_TABLE
      ? "Don't add to any table"
      : tables.find((t) => t.id === selectedTableId)?.name ?? 'Select a table';

  const handleAdd = async () => {
    if (saving) return;
    if (selectedTableId === NO_TABLE || !userId) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const newFood: FoodRow = {
        id: Date.now(),
        name: name.trim() || 'Food',
        checked: false,
        servingSize: servingSize || '',
        quantity: 1,
        nutrients: values,
        photoKey: null,
      };
      const existing = (await loadFoods(userId, selectedTableId)) ?? [];
      const ok = await saveFoods(userId, selectedTableId, [...existing, newFood]);
      if (!ok) {
        setError('Could not save to that table — please try again.');
        setSaving(false);
        return;
      }
      onAdded(selectedTableId);
      onClose();
    } catch {
      setError('Could not save — please try again.');
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={saving}>
            <Text style={[styles.cancel, saving && { opacity: 0.5 }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan a Barcode</Text>
          {stage === 'review' ? (
            <TouchableOpacity onPress={handleAdd} disabled={saving}>
              <Text style={[styles.add, saving && { opacity: 0.5 }]}>{saving ? 'Saving…' : 'Add'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* SCAN */}
        {stage === 'scan' && (
          <View style={styles.scanWrap}>
            {Platform.OS === 'web' ? (
              <View style={styles.manualBox}>
                <Ionicons name="barcode-outline" size={48} color="#6a1b9a" />
                <Text style={styles.manualTitle}>Enter the barcode number</Text>
                <Text style={styles.manualHint}>
                  Live scanning isn't available in the browser — type the digits under the barcode.
                </Text>
                <TextInput
                  style={styles.manualInput}
                  value={manualCode}
                  onChangeText={setManualCode}
                  placeholder="e.g. 0123456789012"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, !manualCode.trim() && { opacity: 0.5 }]}
                  onPress={() => handleCode(manualCode)}
                  disabled={!manualCode.trim()}
                >
                  <Text style={styles.primaryBtnText}>Look up</Text>
                </TouchableOpacity>
              </View>
            ) : permission && permission.granted ? (
              <View style={styles.cameraWrap}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
                  }}
                  onBarcodeScanned={onBarcodeScanned}
                />
                <Text style={styles.scanHint}>Point the camera at the barcode</Text>
              </View>
            ) : (
              <View style={styles.manualBox}>
                <Ionicons name="camera-outline" size={48} color="#6a1b9a" />
                <Text style={styles.manualTitle}>Camera access needed</Text>
                <Text style={styles.manualHint}>Allow camera access to scan a barcode.</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                  <Text style={styles.primaryBtnText}>Allow camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* LOOKING UP */}
        {stage === 'looking' && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#6a1b9a" />
            <Text style={styles.centerText}>Looking up the product…</Text>
          </View>
        )}

        {/* NOT FOUND */}
        {stage === 'notfound' && (
          <View style={styles.centerBox}>
            <Ionicons name="help-circle-outline" size={48} color="#999" />
            <Text style={styles.centerText}>
              {error || "We couldn't find that product in the food database."}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={enterManually}>
              <Text style={styles.primaryBtnText}>Enter it manually</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={scanAgain}>
              <Text style={styles.secondaryBtnText}>{Platform.OS === 'web' ? 'Try another code' : 'Scan again'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* REVIEW */}
        {stage === 'review' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.fieldHeading}>Food</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Name of the food"
              placeholderTextColor="#999"
            />
            {servingSize ? <Text style={styles.servingNote}>Values are per: {servingSize}</Text> : null}

            <Text style={styles.fieldHeading}>Add to</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setPickerOpen(true)}>
              <Text style={styles.dropdownText}>{selectedLabel}</Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>

            {NUTRIENT_GROUPS.map((group) => (
              <View key={group.group} style={styles.group}>
                <Text style={styles.groupTitle}>{group.group}</Text>
                {group.items.map((item) => {
                  const val = values[item.key];
                  return (
                    <View key={item.key} style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{item.label}</Text>
                      <View style={styles.inputWrap}>
                        <TextInput
                          style={styles.input}
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

            <TouchableOpacity style={styles.secondaryBtn} onPress={scanAgain}>
              <Text style={styles.secondaryBtnText}>{Platform.OS === 'web' ? 'Look up another' : 'Scan another'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Table picker */}
        <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
            <View style={styles.menuCard}>
              <Text style={styles.menuTitle}>Add to table</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                {tables.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.menuRow}
                    onPress={() => { setSelectedTableId(t.id); setPickerOpen(false); }}
                  >
                    <Text style={[styles.menuRowText, selectedTableId === t.id && styles.menuRowActive]}>{t.name}</Text>
                    {selectedTableId === t.id && <Text style={styles.menuCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => { setSelectedTableId(NO_TABLE); setPickerOpen(false); }}
                >
                  <Text style={[styles.menuRowText, selectedTableId === NO_TABLE && styles.menuRowActive]}>
                    Don't add to any table
                  </Text>
                  {selectedTableId === NO_TABLE && <Text style={styles.menuCheck}>✓</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
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
  add: { color: '#2e7d32', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },

  scanWrap: { flex: 1 },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  scanHint: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },

  manualBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  manualTitle: { fontSize: 18, fontWeight: 'bold', color: '#222', marginTop: 14 },
  manualHint: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  manualInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 18,
    color: '#222',
  },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  centerText: { fontSize: 15, color: '#444', textAlign: 'center', marginTop: 14, lineHeight: 21 },

  primaryBtn: {
    backgroundColor: '#6a1b9a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 18,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: { marginTop: 14, paddingVertical: 10, alignItems: 'center' },
  secondaryBtnText: { color: '#6a1b9a', fontWeight: '600', fontSize: 14 },

  scroll: { padding: 16, paddingBottom: 60 },
  error: { color: '#c62828', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  fieldHeading: { fontSize: 13, fontWeight: 'bold', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 6 },
  nameInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
  },
  servingNote: { fontSize: 12, color: '#888', marginTop: 6 },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  dropdownText: { fontSize: 15, color: '#222' },

  group: { marginTop: 24 },
  groupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 4,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, minWidth: 0 },
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

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  menuCard: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 8, width: '100%', maxWidth: 360 },
  menuTitle: { fontSize: 13, fontWeight: 'bold', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingVertical: 8 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuRowText: { flex: 1, fontSize: 15, color: '#333' },
  menuRowActive: { color: '#2e7d32', fontWeight: '700' },
  menuCheck: { fontSize: 15, color: '#2e7d32', fontWeight: 'bold' },
});
