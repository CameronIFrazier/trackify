// Camera / photo "Add a food" flow.
//
// Opened from the camera icon in the top nav. On native it opens the camera;
// on web it opens a file picker (upload only). After an image is captured it
// asks Claude for the food's name + nutrients, then shows a review screen:
// the photo, an editable name, the full editable nutrient grid (same as the
// "More" editor), and a dropdown to pick which table to add it to (or none).
// The photo is only uploaded to S3 when the user confirms adding it.
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { NUTRIENT_GROUPS, NutrientValues } from '@/features/nutrition/lib/nutrients';
import { estimateFoodFromImage, EstimateImage } from '@/features/nutrition/api/nutrientEstimateApi';
import {
  getPhotoUploadUrl,
  uploadToPresignedUrl,
  base64ToJpegBlob,
} from '@/features/nutrition/api/photoApi';
import { loadFoods, saveFoods, FoodRow } from '@/features/nutrition/api/foodApi';
import { FoodTable, loadTables } from '@/features/nutrition/api/tablesApi';

// Sentinel for the "don't add to any table" dropdown option.
const NO_TABLE = '__none__';

type Props = {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
  onAdded: (tableId: string) => void; // fired after a food is saved to a table
};

export default function CameraAddModal({ visible, userId, onClose, onAdded }: Props) {
  const [preview, setPreview] = useState<string | null>(null); // data URL / file URI to show
  const [image, setImage] = useState<EstimateImage | null>(null); // base64 for estimate + upload
  const [name, setName] = useState('');
  const [values, setValues] = useState<NutrientValues>({});
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [tables, setTables] = useState<FoodTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>(NO_TABLE);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Guards so capture fires once per open, and we can reset between opens.
  const startedRef = useRef(false);

  const reset = () => {
    setPreview(null);
    setImage(null);
    setName('');
    setValues({});
    setEstimating(false);
    setError('');
    setSaving(false);
    setPickerOpen(false);
  };

  // When the modal opens: load tables, then kick off capture once.
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
          setSelectedTableId(list[0].id); // default to the first table
        }
      }
      startCapture();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const setValue = (key: string, text: string) => {
    setValues((prev) => ({ ...prev, [key]: text === '' ? undefined : Number(text) }));
  };

  // Ask Claude for the food's name + nutrients from the photo.
  const runEstimate = async (img: EstimateImage) => {
    setError('');
    setEstimating(true);
    try {
      const schema = NUTRIENT_GROUPS.flatMap((g) =>
        g.items.map((i) => ({ key: i.key, label: i.label, unit: i.unit }))
      );
      const result = await estimateFoodFromImage(img, schema);
      if (!result) {
        setError('Could not analyze the photo — you can still enter the food and values by hand.');
        return;
      }
      setValues(result.nutrients);
      if (result.name) setName(result.name);
    } catch {
      setError('Something went wrong analyzing the photo — you can still enter values by hand.');
    } finally {
      setEstimating(false);
    }
  };

  // Native: open the camera, shrink the result, estimate.
  const captureNative = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera permission is needed to take a food photo.');
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (picked.canceled || !picked.assets?.[0]) {
      onClose(); // user backed out of the camera
      return;
    }
    const shrunk = await ImageManipulator.manipulateAsync(
      picked.assets[0].uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (!shrunk.base64) {
      setError('Could not process the photo — please try again.');
      return;
    }
    const img: EstimateImage = { base64: shrunk.base64, mediaType: 'image/jpeg' };
    setImage(img);
    setPreview(shrunk.uri);
    runEstimate(img);
  };

  // Web: upload only — file input + canvas resize to a clean JPEG.
  const captureWeb = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) {
        onClose(); // canceled
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 1024 / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        URL.revokeObjectURL(url);
        if (!ctx) {
          setError('Could not read that image. Try a JPEG or PNG.');
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        const picked: EstimateImage = { base64, mediaType: 'image/jpeg' };
        setImage(picked);
        setPreview(dataUrl);
        runEstimate(picked);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setError("Couldn't read that image. Try a JPEG or PNG (HEIC isn't supported in the browser).");
      };
      img.src = url;
    };
    input.click();
  };

  const startCapture = () => {
    setError('');
    if (Platform.OS === 'web') captureWeb();
    else captureNative();
  };

  const selectedLabel =
    selectedTableId === NO_TABLE
      ? "Don't add to any table"
      : tables.find((t) => t.id === selectedTableId)?.name ?? 'Select a table';

  const handleAdd = async () => {
    if (saving) return;
    // "Don't add" → nothing to save, no upload (so no orphaned photo).
    if (selectedTableId === NO_TABLE || !userId) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      // Upload the photo to S3 now that we're committing to saving the food.
      let photoKey: string | null = null;
      if (image) {
        // Build the upload Blob. Web: from base64 (reliable in the browser).
        // Native: read the resized file via its URI — RN's fetch can't upload a
        // Blob built from raw bytes, but it uploads a file-URI Blob correctly.
        let blob: Blob | null = null;
        try {
          if (Platform.OS === 'web') {
            blob = base64ToJpegBlob(image.base64);
          } else if (preview) {
            blob = await (await fetch(preview)).blob();
          }
        } catch {
          blob = null;
        }
        if (blob) {
          const presign = await getPhotoUploadUrl(userId);
          if (presign) {
            try {
              const ok = await uploadToPresignedUrl(presign.uploadUrl, blob);
              if (ok) photoKey = presign.key;
            } catch {
              photoKey = null; // non-fatal: still save the food without a photo
            }
          }
        }
      }

      const newFood: FoodRow = {
        id: Date.now(),
        name: name.trim() || 'Food',
        checked: false,
        servingSize: '',
        quantity: 1,
        nutrients: values,
        photoKey,
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
          <Text style={styles.headerTitle}>Add from Photo</Text>
          <TouchableOpacity onPress={handleAdd} disabled={saving || estimating}>
            <Text style={[styles.add, (saving || estimating) && { opacity: 0.5 }]}>
              {saving ? 'Saving…' : 'Add'}
            </Text>
          </TouchableOpacity>
        </View>

        {!preview ? (
          // Waiting for the camera / file picker.
          <View style={styles.waiting}>
            <ActivityIndicator size="large" color="#6a1b9a" />
            <Text style={styles.waitingText}>
              {Platform.OS === 'web' ? 'Choose a food photo…' : 'Opening camera…'}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {error ? (
              <TouchableOpacity style={styles.retryBtn} onPress={startCapture}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Image source={{ uri: preview }} style={styles.photo} resizeMode="cover" />

            {estimating ? (
              <View style={styles.estimatingRow}>
                <ActivityIndicator color="#6a1b9a" />
                <Text style={styles.estimatingText}>Analyzing the food…</Text>
              </View>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Food name */}
            <Text style={styles.fieldHeading}>Food</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Name of the food"
              placeholderTextColor="#999"
            />

            {/* Table picker */}
            <Text style={styles.fieldHeading}>Add to</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setPickerOpen(true)}>
              <Text style={styles.dropdownText}>{selectedLabel}</Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>

            {/* Nutrients (same grid as the More editor) */}
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
          </ScrollView>
        )}

        {/* Table-picker list */}
        <Modal
          visible={pickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerOpen(false)}
        >
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
                    <Text style={[styles.menuRowText, selectedTableId === t.id && styles.menuRowActive]}>
                      {t.name}
                    </Text>
                    {selectedTableId === t.id && <Text style={styles.menuCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.menuRow, styles.menuRowLast]}
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
  add: { color: '#2e7d32', fontSize: 16, fontWeight: 'bold' },

  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  waitingText: { marginTop: 14, color: '#666', fontSize: 15 },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#6a1b9a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  scroll: { padding: 16, paddingBottom: 60 },
  photo: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#f0f0f0' },

  estimatingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, gap: 8 },
  estimatingText: { color: '#6a1b9a', fontSize: 14, fontWeight: '600' },
  error: { color: '#c62828', fontSize: 13, marginTop: 12, textAlign: 'center' },

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
  menuRowLast: {},
  menuRowText: { flex: 1, fontSize: 15, color: '#333' },
  menuRowActive: { color: '#2e7d32', fontWeight: '700' },
  menuCheck: { fontSize: 15, color: '#2e7d32', fontWeight: 'bold' },
});
