import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import NutrientModal from './NutrientModal';
import { NutrientValues, SUMMARY_KEYS, ALL_NUTRIENT_KEYS } from './nutrients';

// One row = a food with a name, a checked flag, and a full nutrient map.
type Row = {
  id: number;
  name: string;
  checked: boolean;
  nutrients: NutrientValues;
};

// Short header labels for the editable summary columns.
const SHORT: Record<string, string> = {
  calories: 'Cal',
  protein: 'P',
  totalCarbs: 'C',
  totalFat: 'F',
  totalSugars: 'Sug',
};

type TrackerTableProps = {
  initialTitle: string;
  onDelete?: () => void;
  onTotalsChange?: (totals: NutrientValues) => void;
};

export default function TrackerTable({ initialTitle, onDelete, onTotalsChange }: TrackerTableProps) {
  const [title, setTitle] = useState(initialTitle);
  const [editingTitle, setEditingTitle] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState('');

  // Which row's nutrient modal is open (null = none).
  const [modalRowId, setModalRowId] = useState<number | null>(null);

  const toggleChecked = (id: number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  };

  const addRow = () => {
    if (!name.trim()) return;
    const newRow: Row = {
      id: Date.now(),
      name: name.trim(),
      checked: false,
      nutrients: {},
    };
    setRows((prev) => [...prev, newRow]);
    setName('');
  };

  const deleteRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Edit a single summary nutrient value directly from the row.
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

  // Save from the modal (full nutrient set).
  const saveNutrients = (id: number, values: NutrientValues) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, nutrients: values } : r)));
  };

  // Totals: for each summary column, sum that nutrient across checked rows.
  const totals: Record<string, number> = {};
  SUMMARY_KEYS.forEach((key) => {
    totals[key] = rows
      .filter((r) => r.checked)
      .reduce((sum, r) => sum + (r.nutrients[key] ?? 0), 0);
  });

  // Full nutrient totals (all keys, not just summary) for the progress bars.
  const fullTotals: NutrientValues = {};
  ALL_NUTRIENT_KEYS.forEach((key) => {
    fullTotals[key] = rows
      .filter((r) => r.checked)
      .reduce((sum, r) => sum + (r.nutrients[key] ?? 0), 0);
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
        {onDelete && (
          <TouchableOpacity onPress={onDelete} style={styles.deleteTableBtn}>
            <Text style={styles.deleteTableText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Totals */}
      <View style={styles.totalsCard}>
        <View style={styles.totalsRow}>
          {SUMMARY_KEYS.map((key) => (
            <View key={key} style={styles.totalCol}>
              <Text style={styles.totalNum}>{totals[key]}</Text>
              <Text style={styles.totalLabel}>{SHORT[key]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, styles.checkCol]}>✓</Text>
        <Text style={[styles.cell, styles.nameCol, styles.headerText]}>Item</Text>
        {SUMMARY_KEYS.map((key) => (
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
            {/* Editable macro inputs, right in the row */}
            {SUMMARY_KEYS.map((key) => (
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

      {/* Add-row form (just a name; macros are editable inline after) */}
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
  deleteTableBtn: { padding: 6, marginLeft: 8 },
  deleteTableText: { color: '#c62828', fontSize: 18, fontWeight: 'bold' },

  totalsCard: { backgroundColor: '#2e7d32', borderRadius: 10, padding: 12, marginBottom: 14 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalCol: { alignItems: 'center', flex: 1 },
  totalNum: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  totalLabel: { color: '#c8e6c9', fontSize: 11, marginTop: 2 },

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
  nameCol: { flex: 2.2 },
  macroCol: { flex: 1, textAlign: 'center' },
  macroInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginHorizontal: 2,
    color: '#333',
  },
  moreCol: { width: 42, alignItems: 'center' },
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
});