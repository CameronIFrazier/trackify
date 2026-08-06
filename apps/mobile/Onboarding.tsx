import { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { UserProfile, Sex, ActivityLevel } from './goals';
import { registerUser } from './auth';

type OnboardingProps = {
  // Called after Cognito signup succeeds; parent then shows email verification.
  onComplete: (profile: UserProfile, email: string, password: string) => void;
};

const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string }[] = [
  { key: 'sedentary', label: 'Sedentary' },
  { key: 'light', label: 'Light' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'active', label: 'Active' },
  { key: 'veryActive', label: 'Very Active' },
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState(''); // optional
  const [activity, setActivity] = useState<ActivityLevel | null>(null); // skippable
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    // Validate required fields.
    if (!name.trim()) return setError('Please enter your name.');
    if (!email.trim() || !email.includes('@')) return setError('Please enter a valid email.');
    if (!password) return setError('Please create a password.');
    // Cognito default policy: min 8 chars with upper/lower/number/special.
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (!age.trim() || Number(age) <= 0) return setError('Please enter your age.');
    if (!sex) return setError('Please select your sex.');
    if (!heightCm.trim() || Number(heightCm) <= 0) return setError('Please enter your height.');

    setError('');
    const profile: UserProfile = {
      name: name.trim(),
      email: email.trim(),
      age: Number(age),
      sex,
      heightCm: Number(heightCm),
      weightKg: weightKg.trim() ? Number(weightKg) : undefined,
      activity: activity ?? 'moderate', // default if skipped
    };

    // Register with Cognito. This emails a verification code.
    setBusy(true);
    try {
      await registerUser(email.trim(), password);
      onComplete(profile, email.trim(), password);
    } catch (e: any) {
      setError(e?.message ?? 'Sign up failed. Try a different email or stronger password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Welcome to Trackify</Text>
        <Text style={styles.subtitle}>Let's set up your profile to personalize your goals.</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
        />

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter password"
          secureTextEntry
        />

        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={setAge}
          placeholder="Years"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Sex</Text>
        <View style={styles.optionRow}>
          {(['male', 'female'] as Sex[]).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.option, sex === s && styles.optionSelected]}
              onPress={() => setSex(s)}
            >
              <Text style={[styles.optionText, sex === s && styles.optionTextSelected]}>
                {s === 'male' ? 'Male' : 'Female'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Height (cm)</Text>
        <TextInput
          style={styles.input}
          value={heightCm}
          onChangeText={setHeightCm}
          placeholder="e.g. 175"
          keyboardType="numeric"
        />

        <Text style={styles.label}>
          Current Weight (kg) <Text style={styles.optional}>— optional</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="e.g. 70 (skippable)"
          keyboardType="numeric"
        />

        <Text style={styles.label}>
          Activity Level <Text style={styles.optional}>— optional (defaults to Moderate)</Text>
        </Text>
        <View style={styles.activityRow}>
          {ACTIVITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.activityOption, activity === opt.key && styles.optionSelected]}
              onPress={() => setActivity(opt.key)}
            >
              <Text style={[styles.activityText, activity === opt.key && styles.optionTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitButton, busy && { opacity: 0.6 }]}
          onPress={submit}
          disabled={busy}
        >
          <Text style={styles.submitText}>{busy ? 'Creating…' : 'Create Profile & Start'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', marginTop: 12, color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 6, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 },
  optional: { fontWeight: '400', color: '#999', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  optionRow: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  optionSelected: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  optionText: { color: '#333', fontWeight: '600' },
  optionTextSelected: { color: '#fff' },

  activityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityOption: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  activityText: { color: '#333', fontWeight: '600', fontSize: 13 },

  error: { color: '#c62828', marginTop: 16, fontSize: 14, textAlign: 'center' },

  submitButton: {
    backgroundColor: '#2e7d32',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});