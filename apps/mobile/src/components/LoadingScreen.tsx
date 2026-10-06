import { SafeAreaView, View, Text, ActivityIndicator, StyleSheet } from 'react-native';

type LoadingScreenProps = {
  message?: string;
};

export default function LoadingScreen({ message = 'Loading…' }: LoadingScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  message: { marginTop: 16, fontSize: 16, color: '#555', fontWeight: '600' },
});