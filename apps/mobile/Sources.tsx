import {
  SafeAreaView, View, Text, TouchableOpacity, ScrollView, Linking, StyleSheet,
} from 'react-native';

type Props = { onBack: () => void };

type Source = { label: string; detail: string; url: string };

const SOURCES: { section: string; items: Source[] }[] = [
  {
    section: 'Calorie & Energy Needs',
    items: [
      {
        label: 'Mifflin-St Jeor Equation',
        detail:
          'Daily calorie targets are estimated using the Mifflin-St Jeor resting energy expenditure equation.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
      },
      {
        label: 'Activity Multipliers (TDEE)',
        detail:
          'Calorie needs are scaled by standard physical activity factors (1.2–1.9) to estimate total daily energy expenditure.',
        url: 'https://www.ncbi.nlm.nih.gov/books/NBK278991/',
      },
    ],
  },
  {
    section: 'Macronutrients',
    items: [
      {
        label: 'Protein, Carbohydrate & Fat',
        detail:
          'Protein target (1.2 g/kg body weight) and carbohydrate/fat distribution follow the National Academies Dietary Reference Intakes (DRIs) and Acceptable Macronutrient Distribution Ranges.',
        url: 'https://www.ncbi.nlm.nih.gov/books/NBK56068/',
      },
      {
        label: 'Dietary Fiber & Added Sugars',
        detail:
          'Fiber (14 g per 1,000 kcal) and the added-sugar limit (under 10% of calories) follow the Dietary Guidelines for Americans.',
        url: 'https://www.dietaryguidelines.gov/',
      },
    ],
  },
  {
    section: 'Vitamins & Minerals',
    items: [
      {
        label: 'Recommended Dietary Allowances (RDAs)',
        detail:
          'Vitamin and mineral goals, including values that vary by sex, are based on the RDAs and Daily Values published by the NIH Office of Dietary Supplements and the U.S. FDA.',
        url: 'https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx',
      },
    ],
  },
];

export default function Sources({ onBack }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Sources & References</Text>
          <View style={{ width: 60 }} />
        </View>

        <Text style={styles.intro}>
          Trackify's recommended goals are estimates based on established, publicly
          available nutrition science. They are for general wellness and are not
          medical advice. Tap any source below to read it.
        </Text>

        {SOURCES.map((group) => (
          <View key={group.section} style={styles.card}>
            <Text style={styles.section}>{group.section}</Text>
            {group.items.map((s) => (
              <View key={s.label} style={styles.item}>
                <Text style={styles.itemLabel}>{s.label}</Text>
                <Text style={styles.itemDetail}>{s.detail}</Text>
                <TouchableOpacity onPress={() => Linking.openURL(s.url)}>
                  <Text style={styles.link}>{s.url}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.disclaimer}>
          Consult a qualified healthcare provider before making significant changes
          to your diet, especially if you have a medical condition.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  scroll: { padding: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 16 },
  backBtn: { paddingVertical: 8, width: 60 },
  backText: { color: '#4338ca', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },
  intro: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#eee' },
  section: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12 },
  item: { marginBottom: 16 },
  itemLabel: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  itemDetail: { fontSize: 13, color: '#666', lineHeight: 19, marginBottom: 6 },
  link: { fontSize: 13, color: '#4338ca', textDecorationLine: 'underline' },
  disclaimer: { fontSize: 13, color: '#888', lineHeight: 19, fontStyle: 'italic', marginBottom: 24 },
});