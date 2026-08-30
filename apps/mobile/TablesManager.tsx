import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import TrackerTable from './TrackerTable';
import { NutrientValues, ALL_NUTRIENT_KEYS } from './nutrients';
import { loadFoods } from './foodApi';
import {
  FoodTable,
  loadTables,
  createTable,
  renameTable,
  deleteTable,
} from './tablesApi';

type TablesManagerProps = {
  userId: string | null;
  onTotalsChange?: (totals: NutrientValues) => void; // combined totals across ALL tables
  clearChecksSignal?: number;                         // per-day plate clear (active table)
  clearAllChecksSignal?: number;                      // "uncheck all tables" (Stage 3 wiring)
  onLoaded?: () => void;                              // fired once the active table has loaded
};

// Sum quantity-scaled checked nutrients for one table's stored foods.
function totalsForFoods(foods: { checked: boolean; quantity: number; nutrients: NutrientValues }[]): NutrientValues {
  const t: NutrientValues = {};
  ALL_NUTRIENT_KEYS.forEach((key) => {
    const sum = foods
      .filter((f) => f.checked)
      .reduce((s, f) => s + ((f.nutrients[key] as number) ?? 0) * (f.quantity ?? 1), 0);
    t[key] = Math.round(sum * 10) / 10;
  });
  return t;
}

export default function TablesManager({
  userId,
  onTotalsChange,
  clearChecksSignal,
  clearAllChecksSignal,
  onLoaded,
}: TablesManagerProps) {
  const [tables, setTables] = useState<FoodTable[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [ready, setReady] = useState(false);

  // Per-table totals, keyed by tableId. The active table reports via the
  // mounted TrackerTable; the others are computed from a background load.
  const perTableTotals = useRef<Record<string, NutrientValues>>({});

  // Report the combined total across every table.
  const emitCombined = () => {
    const combined: NutrientValues = {};
    ALL_NUTRIENT_KEYS.forEach((key) => {
      let sum = 0;
      for (const tid of Object.keys(perTableTotals.current)) {
        sum += (perTableTotals.current[tid]?.[key] as number) ?? 0;
      }
      combined[key] = Math.round(sum * 10) / 10;
    });
    onTotalsChange?.(combined);
  };

  // Load the table list on mount. If none exist, create a default "Food" table.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      let list = await loadTables(userId);
      if (list === null) list = [];
      if (list.length === 0) {
        // First run for this user: create a default table.
        const id = `tbl_${Date.now()}`;
        await createTable(userId, id, 'Food', 0);
        list = [{ id, name: 'Food', sortOrder: 0 }];
      }
      setTables(list);
      setActiveIdx(0);
      setReady(true);
    })();
  }, [userId]);

  // Background-load the NON-active tables so their checked totals count too.
  useEffect(() => {
    if (!userId || !ready) return;
    (async () => {
      for (let i = 0; i < tables.length; i++) {
        if (i === activeIdx) continue; // active one reports via its mounted TrackerTable
        const tbl = tables[i];
        if (perTableTotals.current[tbl.id]) continue; // already loaded
        const foods = await loadFoods(userId, tbl.id);
        if (foods) {
          perTableTotals.current[tbl.id] = totalsForFoods(foods);
          emitCombined();
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ready, tables, activeIdx]);

  const active = tables[activeIdx];

  // Active table reports its totals here → store + re-emit combined.
  const handleActiveTotals = (t: NutrientValues) => {
    if (active) {
      perTableTotals.current[active.id] = t;
      emitCombined();
    }
  };

  const prev = () => setActiveIdx((i) => (i > 0 ? i - 1 : tables.length - 1));
  const next = () => setActiveIdx((i) => (i < tables.length - 1 ? i + 1 : 0));

  const addTable = async () => {
    if (!userId) return;
    const id = `tbl_${Date.now()}`;
    const name = `Food ${tables.length + 1}`;
    await createTable(userId, id, name, tables.length);
    const nextTables = [...tables, { id, name, sortOrder: tables.length }];
    setTables(nextTables);
    setActiveIdx(nextTables.length - 1); // jump to the new table
  };

  const handleRename = async (name: string) => {
    if (!userId || !active) return;
    await renameTable(userId, active.id, name);
    setTables((prev) => prev.map((t, i) => (i === activeIdx ? { ...t, name } : t)));
  };

  const handleDelete = async () => {
    if (!userId || !active) return;
    if (tables.length <= 1) return; // never delete the last table
    const ok =
      Platform.OS === 'web'
        ? window.confirm(`Delete "${active.name}" and all its food? This can't be undone.`)
        : true; // (native confirm could use Alert; kept simple)
    if (!ok) return;
    await deleteTable(userId, active.id);
    delete perTableTotals.current[active.id];
    const nextTables = tables.filter((_, i) => i !== activeIdx);
    setTables(nextTables);
    setActiveIdx((i) => Math.max(0, Math.min(i, nextTables.length - 1)));
    emitCombined();
  };

  if (!ready || !active) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Loading tables…</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Table cycler */}
      <View style={styles.cycler}>
        <TouchableOpacity onPress={prev} style={styles.arrowBtn} disabled={tables.length <= 1}>
          <Text style={[styles.arrow, tables.length <= 1 && styles.arrowDisabled]}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.position}>
          {activeIdx + 1} of {tables.length}
        </Text>
        <TouchableOpacity onPress={next} style={styles.arrowBtn} disabled={tables.length <= 1}>
          <Text style={[styles.arrow, tables.length <= 1 && styles.arrowDisabled]}>›</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={addTable} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Add Table</Text>
        </TouchableOpacity>
      </View>

      {/* Active table — remounts on table change via key so it reloads cleanly */}
      <TrackerTable
        key={active.id}
        tableId={active.id}
        initialTitle={active.name}
        userId={userId}
        onTotalsChange={handleActiveTotals}
        onRename={handleRename}
        onDelete={tables.length > 1 ? handleDelete : undefined}
        clearChecksSignal={clearChecksSignal}
        onLoaded={onLoaded}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cycler: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 4,
  },
  arrowBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  arrow: { fontSize: 26, color: '#2e7d32', fontWeight: 'bold' },
  arrowDisabled: { color: '#ccc' },
  position: { fontSize: 13, color: '#666', fontWeight: '600', minWidth: 54, textAlign: 'center' },
  addBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  loadingBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  loadingText: { color: '#888', fontSize: 14 },
});