import { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { confirmUser, resendCode } from './auth';

type VerifyEmailProps = {
  email: string;
  onVerified: () => void; // called once the code is confirmed
};

export default function VerifyEmail({ email, onVerified }: VerifyEmailProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    if (!code.trim()) return setError('Enter the code from your email.');
    setBusy(true);
    setError('');
    try {
      await confirmUser(email, code.trim());
      onVerified();
    } catch (e: any) {
      setError(e?.message ?? 'Verification failed. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    try {
      await resendCode(email);
      setInfo('A new code has been sent to your email.');
    } catch (e: any) {
      setError(e?.message ?? 'Could not resend the code.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to {email}. Enter it below to activate your account.
        </Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="6-digit code"
          keyboardType="numeric"
          maxLength={6}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <TouchableOpacity style={[styles.button, busy && styles.buttonDisabled]} onPress={verify} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? 'Verifying…' : 'Verify'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={resend} style={styles.resendBtn}>
          <Text style={styles.resendText}>Didn't get it? Resend code</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 20,
    backgroundColor: '#fff',
    textAlign: 'center',
    letterSpacing: 8,
  },
  error: { color: '#c62828', marginTop: 14, textAlign: 'center' },
  info: { color: '#2e7d32', marginTop: 14, textAlign: 'center' },
  button: {
    backgroundColor: '#2e7d32',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  resendBtn: { marginTop: 16, alignItems: 'center' },
  resendText: { color: '#4338ca', fontSize: 14 },
});