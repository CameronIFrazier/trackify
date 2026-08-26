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
  onBack?: () => void;
};

type Units = 'imperial' | 'metric';

// Conversion constants.
const FT_TO_CM = 30.48;
const IN_TO_CM = 2.54;
const LB_TO_KG = 0.453592;

const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string }[] = [
  { key: 'sedentary', label: 'Sedentary' },
  { key: 'light', label: 'Light' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'active', label: 'Active' },
  { key: 'veryActive', label: 'Very Active' },
];

export default function Onboarding({ onComplete, onBack }: OnboardingProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);

  // Units default to Imperial (most users are American).
  const [units, setUnits] = useState<Units>('imperial');

  // Imperial height/weight.
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');

  // Metric height/weight.
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');

  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Switch unit systems, converting any values already entered so nothing is lost.
  const switchUnits = (target: Units) => {
    if (target === units) return;

    if (target === 'metric') {
      if (heightFt.trim() || heightIn.trim()) {
        const ft = Number(heightFt || '0');
        const inch = Number(heightIn || '0');
        const cm = Math.round(ft * FT_TO_CM + inch * IN_TO_CM);
        if (cm > 0) setHeightCm(String(cm));
      }
      if (weightLbs.trim()) {
        const kg = Math.round(Number(weightLbs) * LB_TO_KG * 10) / 10;
        if (kg > 0) setWeightKg(String(kg));
      }
    } else {
      if (heightCm.trim()) {
        const totalIn = Number(heightCm) / IN_TO_CM;
        let ft = Math.floor(totalIn / 12);
        let inch = Math.round(totalIn - ft * 12);
        if (inch === 12) { ft += 1; inch = 0; } // rounding edge (e.g. 5'11.6" -> 6'0")
        if (ft > 0) {
          setHeightFt(String(ft));
          setHeightIn(String(inch));
        }
      }
      if (weightKg.trim()) {
        const lbs = Math.round(Number(weightKg) / LB_TO_KG);
        if (lbs > 0) setWeightLbs(String(lbs));
      }
    }
    setUnits(target);
  };

  const submit = async () => {
    // Validate required identity fields.
    if (!name.trim()) return setError('Please enter your name.');
    if (!email.trim() || !email.includes('@')) return setError('Please enter a valid email.');
    if (!password) return setError('Please create a password.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (!age.trim() || Number(age) <= 0) return setError('Please enter your age.');
    if (!sex) return setError('Please select your sex.');

    // Resolve height/weight to metric based on the active unit system.
    let finalHeightCm: number;
    let finalWeightKg: number | undefined;

    if (units === 'imperial') {
      const ft = Number(heightFt || '0');
      const inch = Number(heightIn || '0');
      if (!heightFt.trim() || ft <= 0) return setError('Please enter your height.');
      finalHeightCm = Math.round(ft * FT_TO_CM + inch * IN_TO_CM);
      finalWeightKg = weightLbs.trim()
        ? Math.round(Number(weightLbs) * LB_TO_KG * 10) / 10
        : undefined;
    } else {
      if (!heightCm.trim() || Number(heightCm) <= 0) return setError('Please enter your height.');
      finalHeightCm = Math.round(Number(heightCm));
      finalWeightKg = weightKg.trim() ? Number(weightKg) : undefined;
    }

    setError('');
    const profile: UserProfile = {
      name: name.trim(),
      email: email.trim(),
      age: Number(age),
      sex,
      heightCm: finalHeightCm,
      weightKg: finalWeightKg,
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
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} disabled={busy}>
            <Text style={styles.backText}>← Back to Sign In</Text>
          </TouchableOpacity>
        )}

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

        {/* Unit system toggle */}
        <Text style={styles.label}>Units</Text>
        <View style={styles.optionRow}>
          <TouchableOpacity
            style={[styles.option, units === 'imperial' && styles.optionSelected]}
            onPress={() => switchUnits('imperial')}
          >
            <Text style={[styles.optionText, units === 'imperial' && styles.optionTextSelected]}>
              Imperial (ft, lbs)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, units === 'metric' && styles.optionSelected]}
            onPress={() => switchUnits('metric')}
          >
            <Text style={[styles.optionText, units === 'metric' && styles.optionTextSelected]}>
              Metric (cm, kg)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Height — imperial (ft + in) or metric (cm) */}
        <Text style={styles.label}>Height</Text>
        {units === 'imperial' ? (
          <View style={styles.dualRow}>
            <View style={styles.dualField}>
              <TextInput
                style={[styles.input, styles.dualInput]}
                value={heightFt}
                onChangeText={setHeightFt}
                placeholder="5"
                keyboardType="numeric"
              />
              <Text style={styles.unitSuffix}>ft</Text>
            </View>
            <View style={styles.dualField}>
              <TextInput
                style={[styles.input, styles.dualInput]}
                value={heightIn}
                onChangeText={setHeightIn}
                placeholder="9"
                keyboardType="numeric"
              />
              <Text style={styles.unitSuffix}>in</Text>
            </View>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            value={heightCm}
            onChangeText={setHeightCm}
            placeholder="e.g. 175"
            keyboardType="numeric"
          />
        )}

        {/* Weight — imperial (lbs) or metric (kg), optional either way */}
        <Text style={styles.label}>
          Current Weight ({units === 'imperial' ? 'lbs' : 'kg'}){' '}
          <Text style={styles.optional}>— optional</Text>
        </Text>
        {units === 'imperial' ? (
          <TextInput
            style={styles.input}
            value={weightLbs}
            onChangeText={setWeightLbs}
            placeholder="e.g. 154 (skippable)"
            keyboardType="numeric"
          />
        ) : (
          <TextInput
            style={styles.input}
            value={weightKg}
            onChangeText={setWeightKg}
            placeholder="e.g. 70 (skippable)"
            keyboardType="numeric"
          />
        )}

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
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, marginTop: 4 },
  backText: { color: '#2e7d32', fontSize: 15, fontWeight: '600' },
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

  // Dual (feet + inches) row
  dualRow: { flexDirection: 'row', gap: 10 },
  dualField: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dualInput: { flex: 1, minWidth: 0 },
  unitSuffix: { marginLeft: 8, color: '#666', fontSize: 15, fontWeight: '600' },

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