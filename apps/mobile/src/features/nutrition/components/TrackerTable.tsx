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
import NutrientModal from '@/features/nutrition/components/NutrientModal';
import { NutrientValues, ALL_NUTRIENT_KEYS, NUTRIENT_GROUPS } from '@/features/nutrition/lib/nutrients';
import { loadFoods, saveFoods } from '@/features/nutrition/api/foodApi';

// Sort key is 'manual' (saved order), 'name', or any nutrient key.
type SortKey = 'manual' | 'name' | string;
type SortDir = 'asc' | 'desc';

// key -> display label, for the sort button + nutrient picker.
const NUTRIENT_LABEL: Record<string, string> = {};
NUTRIENT_GROUPS.forEach((g) => g.items.forEach((i) => { NUTRIENT_LABEL[i.key] = i.label; }));

// Quick-pick presets shown at the top of the Sort menu.
const SORT_PRESETS: { key: SortKey; label: string }[] = [
  { key: 'manual', label: 'Manual (your order)' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'calories', label: 'Calories' },
  { key: 'protein', label: 'Protein' },
  { key: 'totalSugars', label: 'Sugar' },
];

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
  tableId: string;                                  // which table this instance owns
  initialTitle: string;
  onDelete?: () => void;                            // delete this whole table (undefined = can't delete)
  onRename?: (name: string) => void;                // persist a table rename
  onTotalsChange?: (totals: NutrientValues) => void;
  userId?: string | null;
  clearChecksSignal?: number; // bump to uncheck all items (new-day plate clear)
  onLoaded?: () => void;      // fired once foods have finished loading from the DB
};

export default function TrackerTable({ tableId, initialTitle, onDelete, onRename, onTotalsChange, userId, clearChecksSignal, onLoaded }: TrackerTableProps) {
  const [title, setTitle] = useState(initialTitle);
  const [editingTitle, setEditingTitle] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [page, setPage] = useState(0); // current page (0-based) for row pagination

  // Search + sort are display-only: they never change the saved row order.
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('manual');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [nutrientPickerOpen, setNutrientPickerOpen] = useState(false);
  // Which row's name is being edited inline (null = none).
  const [editingNameId, setEditingNameId] = useState<number | null>(null);

  const PAGE_SIZE = 10;

  // Derived view: filter by search, then sort. `rows` stays the canonical order.
  const displayRows = (() => {
    let out = rows;
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((r) => r.name.toLowerCase().includes(q));
    if (sortKey !== 'manual') {
      out = [...out].sort((a, b) => {
        let cmp: number;
        if (sortKey === 'name') {
          cmp = a.name.localeCompare(b.name);
        } else {
          cmp = (a.nutrients[sortKey] ?? 0) - (b.nutrients[sortKey] ?? 0);
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  })();

  const pageCount = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  // Clamp the page if the view shrinks (deletion, search filter, etc.).
  const safePage = Math.min(page, pageCount - 1);
  const pagedRows = displayRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const showPager = displayRows.length > PAGE_SIZE;

  // Reset to the first page whenever the search text or sort changes.
  useEffect(() => { setPage(0); }, [search, sortKey, sortDir]);

  // Choose a sort field; re-picking the active field flips direction.
  const selectSort = (key: SortKey) => {
    if (key === sortKey && key !== 'manual') {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc'); // name A–Z, nutrients high→low
    }
    setSortMenuOpen(false);
    setNutrientPickerOpen(false);
  };

  // Short label + arrow for the Sort button.
  const sortFieldLabel =
    sortKey === 'manual' ? 'Sort'
    : sortKey === 'name' ? 'Name'
    : (SHORT[sortKey] ?? NUTRIENT_LABEL[sortKey] ?? sortKey);
  const sortArrow = sortKey === 'manual' ? '' : sortDir === 'desc' ? ' ↓' : ' ↑';

  // Keep the title in sync if the active table changes under us.
  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle, tableId]);

  // Track whether we've done the initial load, so we don't save before loading.
  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved foods for THIS table (with retry for Aurora cold-start).
  // Re-runs when the active table changes, so cycling loads the right foods.
  useEffect(() => {
    if (!userId || !tableId) return;
    loadedRef.current = false; // reset guard for the new table
    (async () => {
      const saved = await loadFoods(userId, tableId);
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
        onLoaded?.();             // signal parent that foods are loaded
      }
      // if null, leave loadedRef false so we don't overwrite the DB with an
      // empty table, and the user can reload to retry.
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tableId]);

  // Debounced save whenever rows change (after the initial load).
  useEffect(() => {
    if (!loadedRef.current) return; // don't save during/before initial load
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (userId && tableId) {
        // Convert the raw quantity text to a number for storage.
        saveFoods(
          userId,
          tableId,
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
    setRows((prev) => {
      const next = [...prev, newRow];
      // Jump to the page the new item lands on (the last page).
      setPage(Math.ceil(next.length / PAGE_SIZE) - 1);
      return next;
    });
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

  // Edit a food's name inline.
  const setRowName = (id: number, text: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name: text } : r)));
  };

  // Finish inline name editing: trim, and never leave a blank name.
  const finishEditName = (id: number) => {
    setEditingNameId(null);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name: r.name.trim() || 'Untitled' } : r)));
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

  // New-day plate clear: when the signal bumps, uncheck every item (items stay
  // in the table, just unchecked). Skip the initial mount (signal 0 / undefined).
  const clearSignalRef = useRef<number | undefined>(clearChecksSignal);
  useEffect(() => {
    if (clearChecksSignal === undefined) return;
    if (clearSignalRef.current === clearChecksSignal) return;
    clearSignalRef.current = clearChecksSignal;
    if (!loadedRef.current) return; // don't fire before foods have loaded
    setRows((prev) => prev.map((r) => ({ ...r, checked: false })));
  }, [clearChecksSignal]);

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
            onBlur={() => { setEditingTitle(false); onRename?.(title.trim() || 'Food'); }}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => { setEditingTitle(false); onRename?.(title.trim() || 'Food'); }}
          />
        ) : (
          <TouchableOpacity onPress={() => setEditingTitle(true)} style={{ flex: 1 }}>
            <Text style={styles.title}>{title} ✎</Text>
          </TouchableOpacity>
        )}
        {showPager && (
          <View style={styles.pager}>
            <TouchableOpacity
              onPress={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              style={styles.pagerBtn}
            >
              <Text style={[styles.pagerArrow, safePage === 0 && styles.pagerArrowDisabled]}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.pagerLabel}>{safePage + 1}/{pageCount}</Text>
            <TouchableOpacity
              onPress={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              style={styles.pagerBtn}
            >
              <Text style={[styles.pagerArrow, safePage >= pageCount - 1 && styles.pagerArrowDisabled]}>›</Text>
            </TouchableOpacity>
          </View>
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

      {/* Search + Sort controls */}
      <View style={styles.controls}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search items…"
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.sortBtn, sortKey !== 'manual' && styles.sortBtnActive]}
          onPress={() => setSortMenuOpen(true)}
        >
          <Text style={[styles.sortBtnText, sortKey !== 'manual' && styles.sortBtnTextActive]}>
            {sortFieldLabel}{sortArrow} ▾
          </Text>
        </TouchableOpacity>
      </View>

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
      {displayRows.length === 0 ? (
        <Text style={styles.emptyText}>
          {rows.length === 0 ? 'No items yet — add one below.' : 'No items match your search.'}
        </Text>
      ) : (
        pagedRows.map((row) => (
          <View key={row.id} style={styles.row}>
            <TouchableOpacity
              style={[styles.checkCol, styles.checkBoxWrap]}
              onPress={() => toggleChecked(row.id)}
            >
              <View style={[styles.checkbox, row.checked && styles.checkboxOn]}>
                {row.checked && <Text style={styles.checkMark}>✓</Text>}
              </View>
            </TouchableOpacity>

            {/* Name — tap to edit inline */}
            {editingNameId === row.id ? (
              <TextInput
                style={[styles.cell, styles.nameCol, styles.nameInput]}
                value={row.name}
                onChangeText={(t) => setRowName(row.id, t)}
                onBlur={() => finishEditName(row.id)}
                onSubmitEditing={() => finishEditName(row.id)}
                autoFocus
                returnKeyType="done"
              />
            ) : (
              <TouchableOpacity style={styles.nameCol} onPress={() => setEditingNameId(row.id)}>
                <Text style={styles.cell} numberOfLines={1}>{row.name}</Text>
              </TouchableOpacity>
            )}

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

      {/* Sort menu */}
      <Modal
        visible={sortMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setSortMenuOpen(false)}
        >
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Sort by</Text>
            {SORT_PRESETS.map((p) => {
              const isActive = p.key === sortKey;
              return (
                <TouchableOpacity key={p.key} style={styles.menuRow} onPress={() => selectSort(p.key)}>
                  <Text style={[styles.menuRowText, isActive && styles.menuRowActive]}>{p.label}</Text>
                  {isActive && p.key !== 'manual' && (
                    <Text style={styles.menuRowArrow}>{sortDir === 'desc' ? '↓' : '↑'}</Text>
                  )}
                  {isActive && <Text style={styles.menuCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.menuRow, styles.menuRowLast]}
              onPress={() => { setSortMenuOpen(false); setNutrientPickerOpen(true); }}
            >
              <Text style={styles.menuRowText}>Other nutrient…</Text>
              <Text style={styles.menuRowArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Nutrient picker — sort by any of the 35 nutrients */}
      <Modal
        visible={nutrientPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNutrientPickerOpen(false)}
      >
        <View style={styles.menuOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.menuTitle}>Sort by nutrient</Text>
              <TouchableOpacity onPress={() => setNutrientPickerOpen(false)}>
                <Text style={styles.pickerClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {NUTRIENT_GROUPS.map((group) => (
                <View key={group.group} style={styles.pickerGroup}>
                  <Text style={styles.pickerGroupTitle}>{group.group}</Text>
                  {group.items.map((item) => {
                    const isActive = item.key === sortKey;
                    return (
                      <TouchableOpacity key={item.key} style={styles.menuRow} onPress={() => selectSort(item.key)}>
                        <Text style={[styles.menuRowText, isActive && styles.menuRowActive]}>{item.label}</Text>
                        {isActive && <Text style={styles.menuCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  pager: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  pagerBtn: { paddingHorizontal: 4 },
  pagerArrow: { fontSize: 20, color: '#2e7d32', fontWeight: 'bold' },
  pagerArrowDisabled: { color: '#ccc' },
  pagerLabel: { fontSize: 12, color: '#666', fontWeight: '600', minWidth: 28, textAlign: 'center' },
  deleteTableText: { color: '#c62828', fontSize: 18, fontWeight: 'bold' },

  totalsCard: { backgroundColor: '#2e7d32', borderRadius: 10, padding: 12, marginBottom: 10 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalCol: { alignItems: 'center', flex: 1 },
  totalNum: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  totalLabel: { color: '#c8e6c9', fontSize: 11, marginTop: 2 },

  helpBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 4 },
  helpBtnText: { color: '#1565c0', fontSize: 13, fontWeight: '600' },

  // Search + sort controls
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 8, backgroundColor: '#fafafa', minWidth: 0 },
  searchIcon: { fontSize: 13, marginRight: 4, color: '#999' },
  searchInput: { flex: 1, paddingVertical: 7, fontSize: 14, color: '#333', minWidth: 0 },
  searchClear: { paddingHorizontal: 4, paddingVertical: 2 },
  searchClearText: { color: '#999', fontSize: 13 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fafafa' },
  sortBtnActive: { borderColor: '#2e7d32', backgroundColor: '#f1f8f1' },
  sortBtnText: { fontSize: 13, color: '#555', fontWeight: '600' },
  sortBtnTextActive: { color: '#2e7d32' },

  nameInput: { borderWidth: 1, borderColor: '#2e7d32', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 6, marginRight: 2, color: '#333' },

  // Sort menu + nutrient picker
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  menuCard: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 8, width: '100%', maxWidth: 360 },
  menuTitle: { fontSize: 13, fontWeight: 'bold', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingVertical: 8 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  menuRowLast: {},
  menuRowText: { flex: 1, fontSize: 15, color: '#333' },
  menuRowActive: { color: '#2e7d32', fontWeight: '700' },
  menuRowArrow: { fontSize: 15, color: '#2e7d32', fontWeight: 'bold', marginHorizontal: 8 },
  menuCheck: { fontSize: 15, color: '#2e7d32', fontWeight: 'bold' },
  pickerCard: { backgroundColor: '#fff', borderRadius: 14, width: '100%', maxWidth: 400, maxHeight: '80%', overflow: 'hidden' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  pickerClose: { color: '#2e7d32', fontSize: 15, fontWeight: 'bold' },
  pickerGroup: { paddingBottom: 6 },
  pickerGroupTitle: { fontSize: 13, fontWeight: 'bold', color: '#2e7d32', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },

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