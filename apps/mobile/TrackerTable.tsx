import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import NutrientModal from './NutrientModal';
import { NutrientValues, ALL_NUTRIENT_KEYS } from './nutrients';
import { loadFoods, saveFoods } from './foodApi';

// One row = a food with a name, a checked flag, a serving-size note,
// a quantity multiplier, and a full nutrient map.
type Row = {
  id: number;
  name: string;
  checked: boolean;
  servingSize: string; // free text, display only (e.g. "1 cup", "100g")
  quantity: string;    // raw text; parsed to a number for math ('' / invalid = 1)
  nutrients: NutrientValues;
};

// The three nutrient columns shown inline on the front table.
const FRONT_KEYS = ['calories', 'protein', 'totalSugars'];

// Short header labels for the inline nutrient columns.
const SHORT: Record<string, string> = {
  calories: 'Cal',
  protein: 'P',
  totalSugars: 'Sug',
};

// Explanations shown in the "What are these fields?" modal.
const FIELD_HELP: { label: string; desc: string }[] = [
  { label: '✓  Check', desc: 'Check an item to count it toward today\u2019s totals and your nutrient goals.' },
  { label: 'Item', desc: 'The name of the food.' },
  { label: 'Serving', desc: 'The serving size these values are based on (e.g. "1 cup", "100g"). For your reference \u2014 it doesn\u2019t change the math.' },
  { label: 'Qty', desc: 'How many servings you had. Multiplies this food\u2019s nutrients toward your totals (e.g. Qty 2 counts double).' },
  { label: 'Cal', desc: 'Calories in one serving.' },
  { label: 'P', desc: 'Protein (grams) in one serving.' },
  { label: 'Sug', desc: 'Sugar (grams) in one serving.' },
  { label: 'More', desc: 'Open the full editor to set all 35 nutrients (carbs, fat, vitamins, minerals, and more) for this food.' },
];

// Parse the quantity text into a positive multiplier; blank/invalid -> 1.
function qtyToNumber(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? 1 : n;
}

type TrackerTableProps = {
  initialTitle: string;
  onDelete?: () => void;
  onTotalsChange?: (totals: NutrientValues) => void;
  userId?: string | null;
};

export default function TrackerTable({ initialTitle, onDelete, onTotalsChange, userId }: TrackerTableProps) {
  const [title, setTitle] = useState(initialTitle);
  const [editingTitle, setEditingTitle] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  // Track whether we've done the initial load, so we don't save before loading.
  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved foods when we have a user id (with retry for Aurora cold-start).
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const saved = await loadFoods(userId);
      // null = every attempt failed (don't treat as "no data"); array = success.
      if (saved !== null) {
        setRows(
          saved.map((f) => ({
            id: f.id,
            name: f.name,
            checked: f.checked,
            servingSize: f.servingSize ?? '',
            quantity: String(f.quantity ?? 1),
            nutrients: f.nutrients,
          }))
        );
        loadedRef.current = true; // only allow saving once we've truly loaded
      }
      // if null, leave loadedRef false so we don't overwrite the DB with an
      // empty table, and the user can reload to retry.
    })();
  }, [userId]);

  // Debounced save whenever rows change (after the initial load).
  useEffect(() => {
    if (!loadedRef.current) return; // don't save during/before initial load
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (userId) {
        // Convert the raw quantity text to a number for storage.
        saveFoods(
          userId,
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            checked: r.checked,
            servingSize: r.servingSize,
            quantity: qtyToNumber(r.quantity),
            nutrients: r.nutrients,
          }))
        );
      }
    }, 800); // wait 800ms after the last change, then save
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [rows]);

  // Which row's nutrient modal is open (null = none).
  const [modalRowId, setModalRowId] = useState<number | null>(null);

  const toggleChecked = (id: number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  };

  // Uncheck every row (e.g. to reset the day's counted foods).
  const uncheckAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, checked: false })));
  };

  const anyChecked = rows.some((r) => r.checked);

  const addRow = () => {
    if (!name.trim()) return;
    const newRow: Row = {
      id: Date.now(),
      name: name.trim(),
      checked: false,
      servingSize: '',
      quantity: '1',
      nutrients: {},
    };
    setRows((prev) => [...prev, newRow]);
    setName('');
  };

  const deleteRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Edit a single inline nutrient value directly from the row.
  const setRowNutrient = (id: number, key: string, text: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              nutrients: {
                ...r.nutrients,
                [key]: text === '' ? undefined : Number(text),
              },
            }
          : r
      )
    );
  };

  // Edit the serving-size note (free text, no math).
  const setRowServing = (id: number, text: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, servingSize: text } : r)));
  };

  // Edit the quantity (kept as raw text so decimals/partial entry work).
  const setRowQuantity = (id: number, text: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, quantity: text } : r)));
  };

  // Save from the modal (full nutrient set). Preserves serving/quantity.
  const saveNutrients = (id: number, values: NutrientValues) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, nutrients: values } : r)));
  };

  // Totals for the inline columns: sum (nutrient * quantity) across checked rows.
  const totals: Record<string, number> = {};
  FRONT_KEYS.forEach((key) => {
    totals[key] = rows
      .filter((r) => r.checked)
      .reduce((sum, r) => sum + (r.nutrients[key] ?? 0) * qtyToNumber(r.quantity), 0);
  });

  // Full nutrient totals (all keys) for the progress bars — also quantity-scaled.
  const fullTotals: NutrientValues = {};
  ALL_NUTRIENT_KEYS.forEach((key) => {
    const sum = rows
      .filter((r) => r.checked)
      .reduce((s, r) => s + (r.nutrients[key] ?? 0) * qtyToNumber(r.quantity), 0);
    // Trim floating-point noise from the multiplication.
    fullTotals[key] = Math.round(sum * 10) / 10;
  });

  // Report totals up to the parent whenever rows change.
  useEffect(() => {
    onTotalsChange?.(fullTotals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const modalRow = rows.find((r) => r.id === modalRowId) ?? null;

  return (
    <View style={styles.card}>
      {/* Editable title */}
      <View style={styles.titleRow}>
        {editingTitle ? (
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            onBlur={() => setEditingTitle(false)}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => setEditingTitle(false)}
          />
        ) : (
          <TouchableOpacity onPress={() => setEditingTitle(true)} style={{ flex: 1 }}>
            <Text style={styles.title}>{title} ✎</Text>
          </TouchableOpacity>
        )}
        {anyChecked && (
          <TouchableOpacity onPress={uncheckAll} style={styles.uncheckAllBtn}>
            <Text style={styles.uncheckAllText}>Uncheck All</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity onPress={onDelete} style={styles.deleteTableBtn}>
            <Text style={styles.deleteTableText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Totals */}
      <View style={styles.totalsCard}>
        <View style={styles.totalsRow}>
          {FRONT_KEYS.map((key) => (
            <View key={key} style={styles.totalCol}>
              <Text style={styles.totalNum}>{Math.round(totals[key])}</Text>
              <Text style={styles.totalLabel}>{SHORT[key]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Help link */}
      <TouchableOpacity style={styles.helpBtn} onPress={() => setHelpOpen(true)}>
        <Text style={styles.helpBtnText}>ⓘ  What are these fields?</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, styles.checkCol]}>✓</Text>
        <Text style={[styles.cell, styles.nameCol, styles.headerText]}>Item</Text>
        <Text style={[styles.cell, styles.servingCol, styles.headerText]}>Serving</Text>
        <Text style={[styles.cell, styles.qtyCol, styles.headerText]}>Qty</Text>
        {FRONT_KEYS.map((key) => (
          <Text key={key} style={[styles.cell, styles.macroCol, styles.headerText]}>
            {SHORT[key]}
          </Text>
        ))}
        <Text style={[styles.cell, styles.moreCol]}></Text>
        <Text style={[styles.cell, styles.delCol]}></Text>
      </View>

      {/* Rows */}
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No items yet — add one below.</Text>
      ) : (
        rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <TouchableOpacity
              style={[styles.checkCol, styles.checkBoxWrap]}
              onPress={() => toggleChecked(row.id)}
            >
              <View style={[styles.checkbox, row.checked && styles.checkboxOn]}>
                {row.checked && <Text style={styles.checkMark}>✓</Text>}
              </View>
            </TouchableOpacity>

            <Text style={[styles.cell, styles.nameCol]} numberOfLines={1}>
              {row.name}
            </Text>

            {/* Serving size (free text) */}
            <TextInput
              style={[styles.cell, styles.servingCol, styles.servingInput]}
              placeholder="—"
              value={row.servingSize}
              onChangeText={(t) => setRowServing(row.id, t)}
            />

            {/* Quantity (multiplies nutrients toward totals) */}
            <TextInput
              style={[styles.cell, styles.qtyCol, styles.macroInput]}
              keyboardType="numeric"
              placeholder="1"
              value={row.quantity}
              onChangeText={(t) => setRowQuantity(row.id, t)}
            />

            {/* Inline nutrient inputs: Cal, P, Sug */}
            {FRONT_KEYS.map((key) => (
              <TextInput
                key={key}
                style={[styles.cell, styles.macroCol, styles.macroInput]}
                keyboardType="numeric"
                placeholder="—"
                value={row.nutrients[key] === undefined ? '' : String(row.nutrients[key])}
                onChangeText={(t) => setRowNutrient(row.id, key, t)}
              />
            ))}

            <TouchableOpacity style={styles.moreCol} onPress={() => setModalRowId(row.id)}>
              <Text style={styles.moreText}>More</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.delCol} onPress={() => deleteRow(row.id)}>
              <Text style={styles.delText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Add-row form (just a name; details are editable inline after) */}
      <View style={styles.form}>
        <View style={styles.addRowInline}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Item name"
            value={name}
            onChangeText={setName}
            onSubmitEditing={addRow}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addButton} onPress={addRow}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Nutrient modal for the selected row */}
      {modalRow && (
        <NutrientModal
          visible={modalRowId !== null}
          foodName={modalRow.name}
          initialValues={modalRow.nutrients}
          onClose={() => setModalRowId(null)}
          onSave={(values) => saveNutrients(modalRow.id, values)}
        />
      )}

      {/* "What are these fields?" help modal */}
      <Modal
        visible={helpOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpOpen(false)}
      >
        <View style={styles.helpOverlay}>
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>What are these fields?</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {FIELD_HELP.map((f) => (
                <View key={f.label} style={styles.helpItem}>
                  <Text style={styles.helpLabel}>{f.label}</Text>
                  <Text style={styles.helpDesc}>{f.desc}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.helpClose} onPress={() => setHelpOpen(false)}>
              <Text style={styles.helpCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#222' },
  titleInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    borderBottomWidth: 2,
    borderBottomColor: '#2e7d32',
    paddingVertical: 2,
  },
  uncheckAllBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  uncheckAllText: { color: '#555', fontSize: 12, fontWeight: '600' },
  deleteTableBtn: { padding: 6, marginLeft: 8 },
  deleteTableText: { color: '#c62828', fontSize: 18, fontWeight: 'bold' },

  totalsCard: { backgroundColor: '#2e7d32', borderRadius: 10, padding: 12, marginBottom: 10 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalCol: { alignItems: 'center', flex: 1 },
  totalNum: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  totalLabel: { color: '#c8e6c9', fontSize: 11, marginTop: 2 },

  helpBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 4 },
  helpBtnText: { color: '#1565c0', fontSize: 13, fontWeight: '600' },

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#ddd',
  },
  headerText: { fontWeight: 'bold', color: '#666' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cell: { fontSize: 13 },
  checkCol: { width: 28, alignItems: 'center' },
  nameCol: { flex: 1.6, minWidth: 0 },
  servingCol: { flex: 1.3, minWidth: 0, textAlign: 'center' },
  qtyCol: { flex: 0.7, minWidth: 0, textAlign: 'center' },
  macroCol: { flex: 1, textAlign: 'center', minWidth: 0 },
  macroInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginHorizontal: 2,
    color: '#333',
  },
  servingInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginHorizontal: 2,
    color: '#333',
    textAlign: 'left',
  },
  moreCol: { width: 40, alignItems: 'center' },
  moreText: { color: '#1565c0', fontSize: 12, fontWeight: '600' },
  delCol: { width: 22, alignItems: 'center' },
  delText: { color: '#c62828', fontSize: 15 },

  checkBoxWrap: { justifyContent: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  emptyText: { color: '#999', fontStyle: 'italic', paddingVertical: 16, textAlign: 'center' },

  form: { marginTop: 16 },
  addRowInline: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  addButton: { backgroundColor: '#2e7d32', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11, alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  // Help modal
  helpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  helpCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 440,
  },
  helpTitle: { fontSize: 18, fontWeight: 'bold', color: '#222', marginBottom: 14 },
  helpItem: { marginBottom: 12 },
  helpLabel: { fontSize: 14, fontWeight: 'bold', color: '#2e7d32', marginBottom: 2 },
  helpDesc: { fontSize: 13, color: '#444', lineHeight: 18 },
  helpClose: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 8,
  },
  helpCloseText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});