import { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import NutrientProgress from './NutrientProgress';
import { loadDailyLog, LoadedDay } from './dailyLogApi';
import { MAIN_GOAL_KEYS, goalMet, Comparator } from './goalComparators';

type FoodLogProps = {
  userId: string | null;
  onBack: () => void;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Cell colors by how the day went (fraction of main goals met).
const CELL = {
  great: '#43a047',    // most/all main goals met
  ok: '#fdd835',       // some met
  poor: '#e53935',     // few met
  notLogged: '#cfcfcf',// day existed but nothing logged
  empty: '#f2f2f2',    // no data for this day
  emptyText: '#bbb',
};

// Local YYYY-MM-DD for a given year/month(0-based)/day.
function ymd(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// Score a logged day: fraction of the MAIN goals that were met (0..1).
function dayScore(day: LoadedDay): number {
  let met = 0;
  let counted = 0;
  for (const key of MAIN_GOAL_KEYS) {
    const goal = day.goals[key];
    if (goal === undefined || goal <= 0) continue; // no goal set for this key
    counted++;
    const current = (day.totals[key] as number) ?? 0;
    const comp = (day.comparators[key] ?? 'lte') as Comparator;
    if (goalMet(current, goal, comp)) met++;
  }
  return counted === 0 ? 0 : met / counted;
}

function cellColorFor(day: LoadedDay | undefined): string {
  if (!day) return CELL.empty;
  if (day.status === 'not_logged') return CELL.notLogged;
  const s = dayScore(day);
  if (s >= 0.75) return CELL.great;
  if (s >= 0.4) return CELL.ok;
  return CELL.poor;
}

export default function FoodLog({ userId, onBack }: FoodLogProps) {
  const [days, setDays] = useState<LoadedDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LoadedDay | null>(null);

  // Calendar view month (default: current month).
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  // Jump-to-date search field.
  const [jumpText, setJumpText] = useState('');
  const [jumpError, setJumpError] = useState('');

  // Parse "M/D/YYYY" (also tolerates "M-D-YYYY") and jump the calendar to that
  // month/year. The day part is optional for the jump (we just switch months),
  // but if given we validate it's a real date.
  const jumpToDate = () => {
    const raw = jumpText.trim();
    if (!raw) return;
    const parts = raw.split(/[/\-.]/).map((p) => p.trim());
    if (parts.length < 2) {
      setJumpError('Use M/D/YYYY');
      return;
    }
    const month = Number(parts[0]);
    const day = parts.length >= 3 ? Number(parts[1]) : 1;
    const year = Number(parts[parts.length === 2 ? 1 : 2]);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      setJumpError('Month must be 1–12');
      return;
    }
    if (!Number.isInteger(year) || year < 1900 || year > 3000) {
      setJumpError('Enter a full year, e.g. 2025');
      return;
    }
    if (parts.length >= 3) {
      const dim = new Date(year, month, 0).getDate();
      if (!Number.isInteger(day) || day < 1 || day > dim) {
        setJumpError('Invalid day for that month');
        return;
      }
    }

    setJumpError('');
    setViewYear(year);
    setViewMonth(month - 1); // Date months are 0-based
    setSelected(null);       // ensure we're on the calendar view
  };

  useEffect(() => {
    (async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      const result = await loadDailyLog(userId);
      setDays(result ?? []);
      setLoading(false);
    })();
  }, [userId]);

  // Map date -> LoadedDay for quick cell lookup.
  const byDate = useMemo(() => {
    const m: Record<string, LoadedDay> = {};
    (days ?? []).forEach((d) => {
      m[d.date] = d;
    });
    return m;
  }, [days]);

  // Today's date string in local time (for highlight + "jump to today").
  const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());

  // Stats for the month currently in view + overall current streak.
  const stats = useMemo(() => {
    const inMonth = (days ?? []).filter((d) => {
      const [y, m] = d.date.split('-').map(Number);
      return y === viewYear && m === viewMonth + 1;
    });
    const logged = inMonth.filter((d) => d.status === 'logged');
    const goalsMet = logged.filter((d) => dayScore(d) >= 0.75).length;

    // Current streak: count back from yesterday over consecutive 'logged' days.
    // (Today isn't logged yet under Option B, so the streak is of completed days.)
    let streak = 0;
    let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    cursor.setDate(cursor.getDate() - 1); // start at yesterday
    for (let i = 0; i < 400; i++) {
      const ds = ymd(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      const entry = byDate[ds];
      if (entry && entry.status === 'logged') {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    return { loggedCount: logged.length, goalsMetCount: goalsMet, streak };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, byDate, viewYear, viewMonth]);

  const goToday = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelected(null);
  };

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build the grid cells: leading blanks + day numbers.
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // ---- Day detail view (replaces the calendar) ----
  if (selected) {
    const d = new Date(selected.date + 'T00:00:00');
    const heading = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelected(null)}>
            <Text style={styles.back}>← Calendar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{heading}</Text>
          <View style={{ width: 70 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.detailWrap}>
          {selected.status === 'not_logged' ? (
            <View style={styles.notLoggedBox}>
              <Text style={styles.notLoggedTitle}>Not logged</Text>
              <Text style={styles.notLoggedText}>
                No food was tracked on this day.
              </Text>
            </View>
          ) : (
            <NutrientProgress
              totals={selected.totals}
              goals={selected.goals}
              comparators={selected.comparators}
            />
          )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Calendar view ----
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Food Log</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.calendarWrap}>
          {/* Jump to date */}
          <View style={styles.jumpRow}>
            <TextInput
              style={styles.jumpInput}
              value={jumpText}
              onChangeText={(t) => { setJumpText(t); if (jumpError) setJumpError(''); }}
              placeholder="Jump to date (M/D/YYYY)"
              keyboardType="numbers-and-punctuation"
              onSubmitEditing={jumpToDate}
              returnKeyType="go"
            />
            <TouchableOpacity style={styles.jumpBtn} onPress={jumpToDate}>
              <Text style={styles.jumpBtnText}>Go</Text>
            </TouchableOpacity>
          </View>
          {jumpError ? <Text style={styles.jumpError}>{jumpError}</Text> : null}

          {/* Summary stats strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{stats.loggedCount}</Text>
              <Text style={styles.statLabel}>days logged</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{stats.goalsMetCount}</Text>
              <Text style={styles.statLabel}>goals met</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>🔥 {stats.streak}</Text>
              <Text style={styles.statLabel}>day streak</Text>
            </View>
          </View>

          {/* Month navigation */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Text style={styles.navText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goToday} style={styles.todayBtn}>
              <Text style={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
              <Text style={styles.todayHint}>Tap for today</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Text style={styles.navText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={styles.weekCell}>
                <Text style={styles.weekText}>{w}</Text>
              </View>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#2e7d32" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day === null) {
                  return <View key={`b${i}`} style={styles.dayCell} />;
                }
                const dateStr = ymd(viewYear, viewMonth, day);
                const entry = byDate[dateStr];
                const bg = cellColorFor(entry);
                const hasData = !!entry;
                const isToday = dateStr === todayStr;
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[styles.dayCell, { backgroundColor: bg }, isToday && styles.todayCell]}
                    disabled={!hasData}
                    onPress={() => entry && setSelected(entry)}
                    activeOpacity={hasData ? 0.6 : 1}
                  >
                    <Text style={[styles.dayNum, !hasData && { color: CELL.emptyText }]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Legend */}
          <View style={styles.legend}>
            <LegendDot color={CELL.great} label="Most goals met" />
            <LegendDot color={CELL.ok} label="Some met" />
            <LegendDot color={CELL.poor} label="Few met" />
            <LegendDot color={CELL.notLogged} label="Not logged" />
          </View>
        </View>

        {!loading && (days ?? []).length === 0 && (
          <Text style={styles.emptyMsg}>
            No history yet. Your completed days will appear here as you log food each day.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', flex: 1, textAlign: 'center', color: '#222' },
  back: { color: '#2e7d32', fontSize: 15, fontWeight: '600', width: 70 },

  scroll: { padding: 16, paddingBottom: 40 },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: { paddingHorizontal: 16, paddingVertical: 4 },
  navText: { fontSize: 26, color: '#2e7d32', fontWeight: 'bold' },
  monthLabel: { fontSize: 18, fontWeight: 'bold', color: '#222' },

  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { flex: 1, alignItems: 'center' },
  weekText: { fontSize: 12, color: '#999', fontWeight: '600' },

  // Cap the calendar width so it stays compact on wide (web/desktop) screens
  // and is centered, instead of stretching edge-to-edge.
  calendarWrap: { width: '100%', maxWidth: 380, alignSelf: 'center' },
  detailWrap: { width: '100%', maxWidth: 480, alignSelf: 'center' },

  jumpRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  jumpInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  jumpBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jumpBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  jumpError: { color: '#c62828', fontSize: 12, marginBottom: 4 },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 14,
    marginTop: 4,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#2e7d32' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },

  todayBtn: { alignItems: 'center', flex: 1 },
  todayHint: { fontSize: 10, color: '#4338ca', marginTop: 1 },

  todayCell: { borderColor: '#1e88e5', borderWidth: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#f0f2f5', // gap effect between cells
    borderRadius: 6,
  },
  dayNum: { fontSize: 13, fontWeight: '600', color: '#fff' },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 11, color: '#666' },

  emptyMsg: { color: '#888', fontSize: 13, textAlign: 'center', marginTop: 24, lineHeight: 18, paddingHorizontal: 20 },

  notLoggedBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  notLoggedTitle: { fontSize: 18, fontWeight: 'bold', color: '#999', marginBottom: 8 },
  notLoggedText: { fontSize: 14, color: '#888', textAlign: 'center' },
});