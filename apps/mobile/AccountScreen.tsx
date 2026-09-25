import { useState } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet,
} from 'react-native';
import { deleteUser } from 'aws-amplify/auth';
import { UserProfile } from './goals';
import { deleteAccountData } from './accountApi';
import { Platform } from 'react-native';
type Props = {
  profile: UserProfile | null;
  userId: string | null;
  onBack: () => void;
  onAccountDeleted: () => void; // parent resets to sign-in
};

export default function AccountScreen({ profile, userId, onBack, onAccountDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);

 const confirmDelete = () => {
    console.log('DELETE: button pressed');
    const message =
      'This permanently deletes your account and all your food logs, goals, tables, and history. This cannot be undone.';

    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(message)) runDelete();
    } else {
      Alert.alert('Delete Account', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: runDelete },
      ]);
    }
  };

  const runDelete = async () => {
    if (!userId) return;
    setDeleting(true);
    try {
      // 1. Aurora data first — abort if this fails.
      const dataDeleted = await deleteAccountData(userId);
      if (!dataDeleted) {
        Alert.alert('Error', 'Could not delete your data. Please try again.');
        setDeleting(false);
        return;
      }
      // 2. Cognito user (this also revokes the session).
      await deleteUser();
      // 3. Hand off to parent to clear state and return to sign-in.
      onAccountDeleted();
    } catch (err) {
      console.log('Account deletion failed:', String(err));
      Alert.alert('Error', 'Could not delete your account. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Account</Text>
          <View style={{ width: 60 }} />
        </View>

        {profile && (
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{profile.name}</Text>
            {profile.email ? (
              <>
                <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
                <Text style={styles.value}>{profile.email}</Text>
              </>
            ) : null}
          </View>
        )}

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Delete Account</Text>
          <Text style={styles.dangerBody}>
            Permanently remove your account and all associated data. This cannot be undone.
          </Text>
          <TouchableOpacity
            style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
            onPress={confirmDelete}
            disabled={deleting}
          >
            <Text style={styles.deleteText}>
              {deleting ? 'Deleting…' : 'Delete My Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  scroll: { padding: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 20 },
  backBtn: { paddingVertical: 8, width: 60 },
  backText: { color: '#4338ca', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#eee' },
  label: { fontSize: 13, color: '#888', fontWeight: '600' },
  value: { fontSize: 16, color: '#1a1a1a', marginTop: 2 },
  dangerCard: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#fecaca' },
  dangerTitle: { fontSize: 16, fontWeight: 'bold', color: '#b91c1c', marginBottom: 6 },
  dangerBody: { fontSize: 14, color: '#7f1d1d', marginBottom: 16, lineHeight: 20 },
  deleteBtn: { backgroundColor: '#dc2626', borderRadius: 10, padding: 14, alignItems: 'center' },
  deleteBtnDisabled: { opacity: 0.6 },
  deleteText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});