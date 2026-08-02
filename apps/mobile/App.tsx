import { useState } from 'react';
import {
  SafeAreaView,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import TrackerTable from './TrackerTable';
import NutrientProgress from './NutrientProgress';
import { NutrientValues } from './nutrients';

export default function App() {
  // The food table reports its checked-row totals up here so the progress
  // bars (below the table) can read today's accumulated nutrients.
  const [totals, setTotals] = useState<NutrientValues>({});

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.appTitle}>Trackify</Text>

        {/* The single food table */}
        <TrackerTable initialTitle="Food" onTotalsChange={setTotals} />

        {/* Infographics: nutrient progress bars, fed by the table's totals */}
        <NutrientProgress totals={totals} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  scroll: { padding: 16 },
  appTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, marginTop: 8, color: '#1a1a1a' },
});