import { useState, useMemo, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { NUTRIENT_GROUPS } from './nutrients';
import {
  Comparator,
  COMPARATOR_ORDER,
  COMPARATOR_LABELS,
  COMPARATOR_SYMBOLS,
  goalMet,
} from './goalComparators';
import { LoadedDay } from './dailyLogApi';
import {
  SavedStatement,
  loadStatements,
  saveStatement,
  deleteStatement,
} from './statementsApi';

type NutrientTrackerProps = {
  userId: string | null;
  days: LoadedDay[]; // all loaded logged days (from the Food Log)
};

type RangePreset = 'month' | 'last7' | 'last30' | 'all' | 'custom';

// Flat list of all nutrients: { key, label, unit }.
const ALL_NUTRIENTS = NUTRIENT_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ key: i.key, label: i.label, unit: i.unit }))
);

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function todayStr(): string { return daysAgoStr(0); }

// Pretty-print YYYY-MM-DD as M/D/YYYY for the statement text.
function pretty(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}/${y}`;
}

// Count every calendar day in [from,to] inclusive (for unlogged math).
function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00Z');
  const b = new Date(to + 'T00:00:00Z');
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
}

export default function NutrientTracker({ userId, days }: NutrientTrackerProps) {
  const [selectedKey, setSelectedKey] = useState<string>('calories');
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [useCustom, setUseCustom] = useState(false);
  const [customComp, setCustomComp] = useState<Comparator>('gte');
  const [customAmt, setCustomAmt] = useState('');

  const [preset, setPreset] = useState<RangePreset>('month');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');

  // Saved statements.
  const [saved, setSaved] = useState<SavedStatement[]>([]);
  const [busy, setBusy] = useState(false);

  const selected = ALL_NUTRIENTS.find((n) => n.key === selectedKey);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const list = await loadStatements(userId);
      if (list) setSaved(list);
    })();
  }, [userId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_NUTRIENTS;
    return ALL_NUTRIENTS.filter((n) => n.label.toLowerCase().includes(q));
  }, [search]);

  const range = useMemo((): { from: string; to: string } | null => {
    const today = todayStr();
    if (preset === 'all') {
      // "all" = from the earliest logged day to today (so unlogged math is sane).
      const logged = days.filter((d) => d.status === 'logged').map((d) => d.date).sort();
      const earliest = logged.length ? logged[0] : today;
      return { from: earliest, to: today };
    }
    if (preset === 'last7') return { from: daysAgoStr(6), to: today };
    if (preset === 'last30') return { from: daysAgoStr(29), to: today };
    if (preset === 'month') {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const last = new Date(y, d.getMonth() + 1, 0).getDate();
      return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(last).padStart(2, '0')}` };
    }
    const f = fromText.trim();
    const t = toText.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
    return f <= t ? { from: f, to: t } : { from: t, to: f };
  }, [preset, fromText, toText, days]);

  // The full breakdown for the current selection.
  const result = useMemo(() => {
    if (!range) return null;
    const amt = Number(customAmt);
    if (useCustom && (!customAmt.trim() || isNaN(amt) || amt <= 0)) return null;

    const inRange = days.filter((d) => d.date >= range.from && d.date <= range.to);
    const logged = inRange.filter((d) => d.status === 'logged');
    const unloggedMarked = inRange.filter((d) => d.status === 'not_logged').length;

    // Eligible = logged days that have a goal for this nutrient (or custom mode = all logged).
    let eligible = 0;
    let hit = 0;
    for (const d of logged) {
      const current = (d.totals[selectedKey] as number) ?? 0;
      let goal: number;
      let comp: Comparator;
      if (useCustom) {
        goal = amt;
        comp = customComp;
      } else {
        const g = d.goals[selectedKey];
        if (g === undefined || g <= 0) continue; // no goal that day → not eligible
        goal = g;
        comp = (d.comparators[selectedKey] ?? 'lte') as Comparator;
      }
      eligible++;
      if (goalMet(current, goal, comp)) hit++;
    }

    // Unlogged = total calendar days in range minus days we have an entry for.
    const totalDays = daysBetween(range.from, range.to);
    const withEntry = inRange.length;
    const unlogged = Math.max(unloggedMarked, totalDays - withEntry);

    return { hit, eligible, unlogged, from: range.from, to: range.to };
  }, [days, range, selectedKey, useCustom, customAmt, customComp]);

  // Build the human statement sentence.
  const statementText = useMemo(() => {
    if (!result || !selected) return '';
    const goalPhrase = useCustom
      ? `${selected.label} ${COMPARATOR_SYMBOLS[customComp]} ${customAmt}${selected.unit === 'kcal' ? '' : selected.unit}`
      : `your ${selected.label} goal`;
    const pct = result.eligible > 0 ? Math.round((result.hit / result.eligible) * 100) : 0;
    return (
      `From ${pretty(result.from)} to ${pretty(result.to)}, you hit ${goalPhrase} ` +
      `${result.hit} out of ${result.eligible} logged day${result.eligible === 1 ? '' : 's'} ` +
      `(${pct}%), with ${result.unlogged} day${result.unlogged === 1 ? '' : 's'} unlogged in this period.`
    );
  }, [result, selected, useCustom, customComp, customAmt]);

  const onSave = async () => {
    if (!userId || !statementText) return;
    setBusy(true);
    const id = `stmt_${Date.now()}`;
    const params = {
      nutrientKey: selectedKey,
      useCustom,
      comparator: customComp,
      amount: customAmt,
      preset,
      from: result?.from,
      to: result?.to,
    };
    const ok = await saveStatement(userId, id, statementText, params);
    if (ok) {
      setSaved((prev) => [
        { id, text: statementText, params, createdAt: new Date().toISOString() },
        ...prev,
      ]);
    }
    setBusy(false);
  };

  const onDelete = async (id: string) => {
    if (!userId) return;
    setSaved((prev) => prev.filter((s) => s.id !== id));
    await deleteStatement(userId, id);
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Track a Nutrient</Text>

      {/* Nutrient picker (searchable) */}
      <TouchableOpacity style={styles.selectBtn} onPress={() => setPickerOpen((o) => !o)}>
        <Text style={styles.selectText}>{selected ? selected.label : 'Select nutrient'}</Text>
        <Text style={styles.selectChevron}>{pickerOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {pickerOpen && (
        <View style={styles.picker}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search nutrients…"
            autoCapitalize="none"
          />
          <View>
            {filtered.slice(0, 8).map((n) => (
              <TouchableOpacity
                key={n.key}
                style={[styles.pickerItem, n.key === selectedKey && styles.pickerItemActive]}
                onPress={() => { setSelectedKey(n.key); setPickerOpen(false); setSearch(''); }}
              >
                <Text style={[styles.pickerItemText, n.key === selectedKey && styles.pickerItemTextActive]}>
                  {n.label} <Text style={styles.pickerUnit}>({n.unit})</Text>
                </Text>
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && <Text style={styles.noMatch}>No match</Text>}
            {filtered.length > 8 && <Text style={styles.moreHint}>Keep typing to narrow…</Text>}
          </View>
        </View>
      )}

      {/* Goal source toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity style={[styles.toggle, !useCustom && styles.toggleActive]} onPress={() => setUseCustom(false)}>
          <Text style={[styles.toggleText, !useCustom && styles.toggleTextActive]}>My goal each day</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggle, useCustom && styles.toggleActive]} onPress={() => setUseCustom(true)}>
          <Text style={[styles.toggleText, useCustom && styles.toggleTextActive]}>Custom target</Text>
        </TouchableOpacity>
      </View>

      {useCustom && (
        <View style={styles.customRow}>
          <View style={styles.compPicker}>
            {COMPARATOR_ORDER.map((c) => (
              <TouchableOpacity key={c} style={[styles.compChip, c === customComp && styles.compChipActive]} onPress={() => setCustomComp(c)}>
                <Text style={[styles.compChipText, c === customComp && styles.compChipTextActive]}>{COMPARATOR_SYMBOLS[c]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.amtInput} value={customAmt} onChangeText={setCustomAmt} placeholder="amount" keyboardType="numeric" />
        </View>
      )}

      {/* Range presets */}
      <View style={styles.rangeRow}>
        {([['month', 'This month'], ['last7', 'Last 7'], ['last30', 'Last 30'], ['all', 'All time'], ['custom', 'Custom']] as [RangePreset, string][]).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.rangeChip, preset === key && styles.rangeChipActive]} onPress={() => setPreset(key)}>
            <Text style={[styles.rangeChipText, preset === key && styles.rangeChipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {preset === 'custom' && (
        <View style={styles.customDateRow}>
          <TextInput style={styles.dateInput} value={fromText} onChangeText={setFromText} placeholder="From YYYY-MM-DD" autoCapitalize="none" />
          <Text style={styles.dateDash}>→</Text>
          <TextInput style={styles.dateInput} value={toText} onChangeText={setToText} placeholder="To YYYY-MM-DD" autoCapitalize="none" />
        </View>
      )}

      {/* Live statement + save */}
      <View style={styles.result}>
        {!range ? (
          <Text style={styles.resultMuted}>Enter a valid From–To range (YYYY-MM-DD).</Text>
        ) : useCustom && (!customAmt.trim() || isNaN(Number(customAmt))) ? (
          <Text style={styles.resultMuted}>Enter a target amount above.</Text>
        ) : result && result.eligible === 0 ? (
          <Text style={styles.resultMuted}>
            No logged days with a {selected?.label} goal in this range yet
            {result.unlogged > 0 ? ` (${result.unlogged} day${result.unlogged === 1 ? '' : 's'} unlogged).` : '.'}
          </Text>
        ) : result ? (
          <>
            <Text style={styles.resultText}>{statementText}</Text>
            <TouchableOpacity style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={onSave} disabled={busy}>
              <Text style={styles.saveBtnText}>{busy ? 'Saving…' : '📌 Save this statement'}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {/* Saved statements */}
      {saved.length > 0 && (
        <View style={styles.savedSection}>
          <Text style={styles.savedHeader}>Saved</Text>
          {saved.map((s) => (
            <View key={s.id} style={styles.savedCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedText}>{s.text}</Text>
                <Text style={styles.savedDate}>
                  Saved {new Date(s.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => onDelete(s.id)} style={styles.savedDelete}>
                <Text style={styles.savedDeleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 8, width: '100%', maxWidth: 420, alignSelf: 'center' },
  panelTitle: { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 12 },

  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  selectText: { fontSize: 15, color: '#222', fontWeight: '600' },
  selectChevron: { fontSize: 11, color: '#666' },

  picker: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, marginTop: 6, overflow: 'hidden' },
  searchInput: { paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  pickerItem: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f4f4f4' },
  pickerItemActive: { backgroundColor: '#eef2ff' },
  pickerItemText: { fontSize: 14, color: '#333' },
  pickerItemTextActive: { color: '#4338ca', fontWeight: '700' },
  pickerUnit: { color: '#999', fontSize: 12 },
  noMatch: { padding: 12, color: '#999', fontSize: 13 },
  moreHint: { padding: 8, color: '#aaa', fontSize: 12, textAlign: 'center' },

  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  toggle: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  toggleActive: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  toggleText: { fontSize: 13, color: '#555', fontWeight: '600' },
  toggleTextActive: { color: '#fff' },

  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  compPicker: { flexDirection: 'row', gap: 4 },
  compChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6 },
  compChipActive: { backgroundColor: '#4338ca', borderColor: '#4338ca' },
  compChipText: { fontSize: 14, color: '#333', fontWeight: '700' },
  compChipTextActive: { color: '#fff' },
  amtInput: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },

  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  rangeChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  rangeChipActive: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  rangeChipText: { fontSize: 12, color: '#555', fontWeight: '600' },
  rangeChipTextActive: { color: '#4338ca' },

  customDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  dateInput: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  dateDash: { color: '#888', fontSize: 16 },

  result: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  resultText: { fontSize: 14, color: '#333', lineHeight: 21 },
  resultMuted: { fontSize: 13, color: '#999' },
  saveBtn: { backgroundColor: '#eef2ff', borderRadius: 8, paddingVertical: 9, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#c7d2fe' },
  saveBtnText: { color: '#4338ca', fontSize: 13, fontWeight: '700' },

  savedSection: { marginTop: 18, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  savedHeader: { fontSize: 13, fontWeight: 'bold', color: '#888', marginBottom: 8 },
  savedCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  savedText: { fontSize: 13, color: '#333', lineHeight: 19 },
  savedDate: { fontSize: 11, color: '#aaa', marginTop: 4 },
  savedDelete: { paddingHorizontal: 8, paddingVertical: 2 },
  savedDeleteText: { color: '#c62828', fontSize: 16, fontWeight: 'bold' },
});