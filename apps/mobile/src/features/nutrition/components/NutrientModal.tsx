import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { NUTRIENT_GROUPS, NutrientValues } from '@/features/nutrition/lib/nutrients';
import { estimateNutrients, EstimateImage } from '@/features/nutrition/api/nutrientEstimateApi';
import {
  getPhotoUploadUrl,
  getPhotoViewUrl,
  uploadToPresignedUrl,
  base64ToJpegBlob,
} from '@/features/nutrition/api/photoApi';

type NutrientModalProps = {
  visible: boolean;
  foodName: string;
  initialValues: NutrientValues;
  userId?: string | null;        // needed to scope the photo's S3 key to this user
  initialPhotoKey?: string | null; // the food's saved photo, if any
  onClose: () => void;
  onSave: (values: NutrientValues, photoKey: string | null) => void;
};

export default function NutrientModal({
  visible,
  foodName,
  initialValues,
  userId,
  initialPhotoKey,
  onClose,
  onSave,
}: NutrientModalProps) {
  // Local editable copy of the nutrient values while the modal is open.
  const [values, setValues] = useState<NutrientValues>(initialValues);
  // Track which fields were filled by "assume" so we can show them differently.
  const [estimated, setEstimated] = useState<Record<string, boolean>>({});
  // Loading + error state for the AI estimate call.
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  // Saved-photo state: the S3 key we persist, a display URL, and upload status.
  const [photoKey, setPhotoKey] = useState<string | null>(initialPhotoKey ?? null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // When the modal opens for a food that already has a saved photo, fetch a
  // short-lived view URL so we can show it.
  useEffect(() => {
    let cancelled = false;
    if (visible && initialPhotoKey && userId) {
      getPhotoViewUrl(userId, initialPhotoKey).then((url) => {
        if (!cancelled && url) setPhotoUrl(url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [visible, initialPhotoKey, userId]);

  const setValue = (key: string, text: string) => {
    setValues((prev) => ({
      ...prev,
      [key]: text === '' ? undefined : Number(text),
    }));
    // If the user manually edits a field, it's no longer an estimate.
    setEstimated((prev) => ({ ...prev, [key]: false }));
  };

  // Clear every nutrient field back to empty and drop the estimated markers.
  const emptyAllFields = () => {
    setValues({});
    setEstimated({});
    setEstimateError('');
  };

  // Merge an estimate result into the fields — only blanks are filled, so
  // anything the user typed (or an exact value they know) is preserved.
  const applyResult = (result: Record<string, number>) => {
    setValues((prev) => {
      const next = { ...prev };
      const newlyEstimated: Record<string, boolean> = { ...estimated };
      for (const [key, val] of Object.entries(result)) {
        if (next[key] === undefined) {
          next[key] = val;
          newlyEstimated[key] = true;
        }
      }
      setEstimated(newlyEstimated);
      return next;
    });
  };

  // Shared estimate call. With no image it's the text-only "Assume Unfilled";
  // with an image, Claude also sees the photo. The food name and any values
  // already entered are sent either way to guide the guess.
  const runEstimate = async (image?: EstimateImage) => {
    setEstimateError('');
    setEstimating(true);
    try {
      const schema = NUTRIENT_GROUPS.flatMap((g) =>
        g.items.map((i) => ({ key: i.key, label: i.label, unit: i.unit }))
      );
      const result = await estimateNutrients(foodName, values, schema, image);
      if (!result) {
        setEstimateError('Could not estimate right now — please try again.');
        return;
      }
      applyResult(result);
    } catch (e) {
      setEstimateError('Something went wrong estimating — please try again.');
    } finally {
      setEstimating(false);
    }
  };

  const assumeUnfilled = () => runEstimate();

  // Upload the photo bytes to S3 (presigned PUT) and remember its key so it
  // gets saved with the food. Non-blocking relative to the estimate: a failed
  // upload still lets the estimate succeed.
  const uploadPhoto = async (blob: Blob) => {
    if (!userId) return; // can't scope a key without a user; skip persistence
    setPhotoBusy(true);
    try {
      const presign = await getPhotoUploadUrl(userId);
      if (!presign) return;
      const ok = await uploadToPresignedUrl(presign.uploadUrl, blob);
      if (!ok) return;
      setPhotoKey(presign.key);
      const url = await getPhotoViewUrl(userId, presign.key);
      if (url) setPhotoUrl(url);
    } finally {
      setPhotoBusy(false);
    }
  };

  // Shared handler once we have a resized image: show it immediately, then run
  // the estimate and the S3 upload in parallel.
  const onImageReady = async (image: EstimateImage, blob: Blob | null, preview: string) => {
    setPhotoUrl(preview); // instant local preview while things run
    await Promise.all([runEstimate(image), blob ? uploadPhoto(blob) : Promise.resolve()]);
  };

  const removePhoto = () => {
    // Clears the photo from this food on save. The S3 object is left in place
    // (harmless orphan) — a cleanup pass can sweep unreferenced keys later.
    setPhotoKey(null);
    setPhotoUrl(null);
  };

  // Pick/take a photo, shrink it, and estimate from it.
  const estimateFromPhoto = async (source: 'camera' | 'library') => {
    setEstimateError('');
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setEstimateError(
          `Permission is needed to use the ${source === 'camera' ? 'camera' : 'photo library'}.`
        );
        return;
      }
      const picked =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
      if (picked.canceled || !picked.assets?.[0]) return;

      // Shrink to keep the upload small (max 1024px wide, JPEG ~0.6).
      const shrunk = await ImageManipulator.manipulateAsync(
        picked.assets[0].uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!shrunk.base64) {
        setEstimateError('Could not process the photo — please try again.');
        return;
      }
      // Native: read the resized file into a Blob for the S3 PUT.
      let blob: Blob | null = null;
      try {
        blob = await (await fetch(shrunk.uri)).blob();
      } catch {
        blob = null; // upload will be skipped; estimate still runs
      }
      await onImageReady(
        { base64: shrunk.base64, mediaType: 'image/jpeg' },
        blob,
        shrunk.uri
      );
    } catch (e) {
      setEstimateError('Could not process the photo — please try again.');
    }
  };

  // On web, expo-image-picker is flaky — it rejects files whose MIME type the
  // browser reports as empty (e.g. HEIC). Use a plain file input + canvas
  // resize instead: reliable, and it outputs a clean JPEG.
  const pickAndResizeWeb = (): Promise<EstimateImage | 'error' | null> =>
    new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return resolve(null); // canceled
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
          if (!ctx) return resolve('error');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve({ base64: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve('error');
        };
        img.src = url;
      };
      input.click();
    });

  // Offer camera vs. library on phone; use the file input on web.
  const pickAndEstimate = async () => {
    if (Platform.OS === 'web') {
      setEstimateError('');
      const res = await pickAndResizeWeb();
      if (res === null) return; // canceled
      if (res === 'error') {
        setEstimateError("Couldn't read that image. Try a JPEG or PNG (HEIC isn't supported in the browser).");
        return;
      }
      // Web: build the upload Blob from the base64 we already have.
      let blob: Blob | null = null;
      try {
        blob = base64ToJpegBlob(res.base64);
      } catch {
        blob = null;
      }
      await onImageReady(res, blob, `data:image/jpeg;base64,${res.base64}`);
      return;
    }
    Alert.alert('Estimate from Photo', 'Add a photo of the food to improve the estimate.', [
      { text: 'Take Photo', onPress: () => estimateFromPhoto('camera') },
      { text: 'Choose from Library', onPress: () => estimateFromPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = () => {
    onSave(values, photoKey);
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
          {/* Assume Unfilled — placed at the top for quick access */}
          <TouchableOpacity
            style={[styles.assumeButton, estimating && { opacity: 0.6 }]}
            onPress={assumeUnfilled}
            disabled={estimating}
          >
            <Text style={styles.assumeText}>
              {estimating ? 'Estimating…' : '✨ Assume Unfilled'}
            </Text>
          </TouchableOpacity>
          {/* Estimate from a photo — sends the image plus anything entered */}
          <TouchableOpacity
            style={[styles.photoButton, estimating && { opacity: 0.6 }]}
            onPress={pickAndEstimate}
            disabled={estimating}
          >
            <Text style={styles.photoButtonText}>📷 Estimate from Photo</Text>
          </TouchableOpacity>

          {estimateError ? <Text style={styles.assumeError}>{estimateError}</Text> : null}

          {/* Saved / just-uploaded food photo */}
          {photoUrl ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: photoUrl }} style={styles.photoPreview} resizeMode="cover" />
              {photoBusy ? (
                <Text style={styles.photoStatus}>Saving photo…</Text>
              ) : (
                <TouchableOpacity onPress={removePhoto} style={styles.photoRemove}>
                  <Text style={styles.photoRemoveText}>Remove photo</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <Text style={styles.assumeHint}>
            Uses AI to estimate empty fields from the food name, an optional photo, and
            any values you've entered. Known values are kept and help guide the guess —
            estimated fields appear highlighted, and you can edit any to override.
          </Text>

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

          {/* Empty all fields — reset, kept at the bottom */}
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={emptyAllFields}
            disabled={estimating}
          >
            <Text style={styles.emptyText}>Empty All Fields</Text>
          </TouchableOpacity>
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
  photoButton: {
    backgroundColor: '#f3e5f5',
    borderWidth: 1,
    borderColor: '#6a1b9a',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  photoButtonText: { color: '#6a1b9a', fontSize: 15, fontWeight: '700' },
  photoPreviewWrap: { alignItems: 'center', marginTop: 12 },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  photoStatus: { color: '#6a1b9a', fontSize: 12, marginTop: 8, fontWeight: '600' },
  photoRemove: { marginTop: 8, paddingVertical: 4, paddingHorizontal: 10 },
  photoRemoveText: { color: '#c62828', fontSize: 13, fontWeight: '600' },
  assumeError: { color: '#c62828', fontSize: 13, marginTop: 10, textAlign: 'center' },
  emptyButton: {
    borderWidth: 1,
    borderColor: '#c62828',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#fff',
  },
  emptyText: { color: '#c62828', fontSize: 15, fontWeight: '600' },
  assumeHint: { color: '#888', fontSize: 12, marginTop: 8, marginBottom: 20, textAlign: 'center', lineHeight: 17 },
});