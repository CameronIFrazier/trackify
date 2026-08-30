import './amplifyConfig'; // must run first to configure Amplify
import { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import TablesManager from './TablesManager';
import NutrientProgress from './NutrientProgress';
import Onboarding from './Onboarding';
import LoadingScreen from './LoadingScreen';
import GoalsModal from './GoalsModal';
import FoodLog from './FoodLog';
import SignIn from './SignIn';
import VerifyEmail from './VerifyEmail';
import { NutrientValues } from './nutrients';
import { UserProfile, computeGoals, computeComparators, detectTimezone } from './goals';
import { Comparator } from './goalComparators';
import { loadGoals, saveGoals } from './nutrientGoalsApi';
import { getSignedInUser, loginUser, logoutUser, getUserId } from './auth';
import { loadProfile, saveProfile } from './profileApi';
import { runDailySnapshot } from './dailyLog';

// ---- DEV MODE ----
// Set to true to skip auth entirely and boot straight into the app with a
// hardcoded profile. Flip to false to restore the real Cognito login flow
// (which needs a development build to work — Expo Go can't run Amplify auth).
const DEV_MODE = false;
const DEV_PROFILE: UserProfile = {
  name: 'Cameron',
  email: 'cameronifrazier1@gmail.com',
  age: 25,
  sex: 'male',
  heightCm: 178,
  weightKg: 80,
  activity: 'moderate',
};

// Which screen the user is on.
type Screen = 'loading' | 'signIn' | 'signUp' | 'verify' | 'app' | 'foodLog';

export default function App() {
  const [screen, setScreen] = useState<Screen>(DEV_MODE ? 'app' : 'loading');
  const [profile, setProfile] = useState<UserProfile | null>(DEV_MODE ? DEV_PROFILE : null);
  const [goals, setGoals] = useState<Record<string, number>>(
    DEV_MODE ? computeGoals(DEV_PROFILE) : {}
  );
  const [comparators, setComparators] = useState<Record<string, Comparator>>(
    DEV_MODE ? computeComparators() : {}
  );
  const [totals, setTotals] = useState<NutrientValues>({});
  // Ref mirror of totals so the snapshot always reads the freshest value,
  // avoiding a one-render lag between foodsLoaded flipping and totals committing.
  const totalsRef = useRef<NutrientValues>({});
  const handleTotalsChange = (t: NutrientValues) => {
    totalsRef.current = t;
    setTotals(t);
  };
  // Bumped to signal TrackerTable to uncheck everything (new-day plate clear).
  const [clearChecksSignal, setClearChecksSignal] = useState(0);
  // Flips true once TrackerTable has loaded foods from the DB (so totals are real).
  const [foodsLoaded, setFoodsLoaded] = useState(false);
  // Guards so the daily snapshot runs at most once per app entry.
  const snapshotRanRef = useRef(false);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading…');

  // Holds signup details between signup → verify → auto sign-in.
  const pendingAuth = useRef<{ email: string; password: string; profile: UserProfile } | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const infographicY = useRef(0);

  // On launch, check if someone is already signed in (persisted session).
  // If so, skip the sign-in screen and load their profile directly.
  useEffect(() => {
    if (DEV_MODE) return; // skip auth entirely in dev mode
    (async () => {
      const user = await getSignedInUser();
      if (user) {
        // Already signed in from a previous session — go straight to loading.
        await enterAppForSignedInUser();
      } else {
        setScreen('signIn');
      }
    })();
  }, []);

  // Shared logic: for an already-authenticated user, load profile and route.
  const enterAppForSignedInUser = async () => {
    setLoadingMessage('Loading your data…');
    setScreen('loading');
    const uid = await getUserId();
    if (!uid) {
      setScreen('signIn');
      return;
    }
    setUserId(uid);
    const saved = await loadProfile(uid);
    if (saved) {
      // Re-check timezone on every open — if the user has traveled, update it.
      const currentTz = detectTimezone();
      let profileToUse = saved;
      if (saved.timezone !== currentTz) {
        profileToUse = { ...saved, timezone: currentTz };
        saveProfile(uid, profileToUse); // persist the change (fire-and-forget)
      }
      setProfile(profileToUse);
      setGoals(computeGoals(profileToUse));
      setComparators(computeComparators());
      setScreen('app');
    } else {
      setScreen('signUp'); // authed but no profile yet -> onboarding
    }
  };

  // When we enter the app with a profile, load any saved goals from the DB
  // and merge them over the computed defaults (saved values win). Retries
  // internally to cover Aurora's cold-start wake.
  useEffect(() => {
    if (screen !== 'app' || !profile) return;
    (async () => {
      if (!userId) return;
      const saved = await loadGoals(userId);
      // null = load failed after retries; only merge on a real result.
      if (saved) {
        if (Object.keys(saved.goals).length > 0) {
          setGoals((prev) => ({ ...prev, ...saved.goals }));
        }
        if (Object.keys(saved.comparators).length > 0) {
          setComparators((prev) => ({ ...prev, ...saved.comparators }));
        }
      }
    })();
  }, [screen, profile, userId]);

  // Daily-log snapshot on app entry. Runs once foods have loaded (so `totals`
  // reflects yesterday's checked plate, not an empty pre-load state). If the day
  // rolled over since the last logged day, snapshot the completed day(s) and
  // clear the plate's checks.
  useEffect(() => {
    if (screen !== 'app' || !profile || !userId) return;
    if (!foodsLoaded) return;          // wait until the table has loaded foods
    if (snapshotRanRef.current) return;
    snapshotRanRef.current = true;

    (async () => {
      // Let the totals from the just-loaded foods settle for a tick.
      await new Promise((r) => setTimeout(r, 400));
      const tz = profile.timezone ?? detectTimezone();
      const result = await runDailySnapshot(userId, {
        timezone: tz,
        lastLoggedDate: profile.lastLoggedDate,
        checkedTotals: totalsRef.current,   // freshest checked totals (via ref)
        goals,
        comparators,
      });

      // Update the in-memory marker so we don't re-log this session.
      setProfile((prev) => (prev ? { ...prev, lastLoggedDate: result.newLastLogged } : prev));

      // A rollover means a new day began → clear the checks on the plate.
      if (result.rolledOver) {
        setClearChecksSignal((n) => n + 1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, profile, userId, foodsLoaded]);
  const handleSignUp = (p: UserProfile, email: string, password: string) => {
    pendingAuth.current = { email, password, profile: p };
    setScreen('verify');
  };

  // After the emailed code is confirmed → sign them in and enter the app.
  const handleVerified = async () => {
    const pending = pendingAuth.current;
    if (!pending) return;
    setLoadingMessage('Creating your account…');
    setScreen('loading');
    try {
      await loginUser(pending.email, pending.password);
    } catch {
      setScreen('signIn');
      return;
    }
    // Now signed in — get the real Cognito user id and save the new profile.
    const uid = await getUserId();
    if (uid) {
      setUserId(uid);
      await saveProfile(uid, pending.profile); // persist onboarding data
    }
    setProfile(pending.profile);
    setGoals(computeGoals(pending.profile));
    setComparators(computeComparators());
    pendingAuth.current = null;
    setScreen('app');
  };

  // Returning user signs in -> load profile and route (reuses shared logic).
  const handleSignedIn = async () => {
    await enterAppForSignedInUser();
  };

  const resetGoalsToComputed = () => {
    if (profile) {
      setGoals(computeGoals(profile));
      setComparators(computeComparators());
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setProfile(null);
    setGoals({});
    setComparators({});
    setTotals({});
    setFoodsLoaded(false);
    snapshotRanRef.current = false;
    setUserId(null);
    pendingAuth.current = null;
    setScreen('signIn');
  };

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });
  const scrollToInfographic = () =>
    scrollRef.current?.scrollTo({ y: infographicY.current, animated: true });

  // ---- Screen routing ----

  if (screen === 'loading') {
    return <LoadingScreen message={loadingMessage} />;
  }

  if (screen === 'signIn') {
    return (
      <SignIn onSignedIn={handleSignedIn} onGoToSignUp={() => setScreen('signUp')} />
    );
  }

  if (screen === 'signUp') {
    return <Onboarding onComplete={handleSignUp} onBack={() => setScreen('signIn')} />;
  }

  if (screen === 'verify' && pendingAuth.current) {
    return <VerifyEmail email={pendingAuth.current.email} onVerified={handleVerified} />;
  }

  if (screen === 'foodLog') {
    return <FoodLog userId={userId} onBack={() => setScreen('app')} />;
  }

  // Main app (screen === 'app')
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <View>
            <Image
              source={require('./assets/wordmark.png')}
              style={styles.wordmark}
              resizeMode="contain"
            />
            {profile && <Text style={styles.greeting}>Hi {profile.name} 👋</Text>}
          </View>
          <View style={styles.topBarButtons}>
            <TouchableOpacity onPress={() => setScreen('foodLog')} style={styles.foodLogBtn}>
              <Text style={styles.foodLogText}>📅 Food Log</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.jumpButton} onPress={scrollToInfographic}>
          <Text style={styles.jumpButtonText}>↓ Jump to Nutrients</Text>
        </TouchableOpacity>

        <TablesManager
          userId={userId}
          onTotalsChange={handleTotalsChange}
          clearChecksSignal={clearChecksSignal}
          onLoaded={() => setFoodsLoaded(true)}
        />

        <View
          onLayout={(e) => {
            infographicY.current = e.nativeEvent.layout.y;
          }}
        >
          <NutrientProgress
            totals={totals}
            goals={goals}
            comparators={comparators}
            onEditGoals={() => setGoalsModalOpen(true)}
          />

          <TouchableOpacity style={styles.topButton} onPress={scrollToTop}>
            <Text style={styles.topButtonText}>↑ Back to Top</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <GoalsModal
        visible={goalsModalOpen}
        goals={goals}
        comparators={comparators}
        onClose={() => setGoalsModalOpen(false)}
        onSave={(newGoals, newComparators) => {
          setGoals(newGoals);              // update UI immediately
          setComparators(newComparators);
          if (userId) saveGoals(userId, newGoals, newComparators); // persist
        }}
        onResetToComputed={resetGoalsToComputed}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' },
  loadingText: { fontSize: 16, color: '#666' },
  scroll: { padding: 16 },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8, marginBottom: 16 },
  appTitle: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a' },
  wordmark: { width: 150, height: 40 },
  greeting: { fontSize: 15, color: '#666', marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  logoutText: { color: '#555', fontSize: 13, fontWeight: '600' },
  topBarButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  foodLogBtn: {
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  foodLogText: { color: '#4338ca', fontSize: 13, fontWeight: '600' },

  jumpButton: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  jumpButtonText: { color: '#4338ca', fontSize: 14, fontWeight: '600' },
  topButton: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  topButtonText: { color: '#4338ca', fontSize: 15, fontWeight: '600' },
});