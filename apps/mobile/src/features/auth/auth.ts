// Thin wrappers around Amplify Auth so the screens don't call Amplify directly.
import {
  signUp,
  confirmSignUp,
  signIn,
  signOut,
  getCurrentUser,
  resendSignUpCode,
} from 'aws-amplify/auth';

// Create an account. Cognito emails a verification code after this.
export async function registerUser(email: string, password: string) {
  const result = await signUp({
    username: email,
    password,
    options: {
      userAttributes: { email },
    },
  });
  return result; // isSignUpComplete=false until the code is confirmed
}

// Confirm the account with the 6-digit code Cognito emailed.
export async function confirmUser(email: string, code: string) {
  return confirmSignUp({ username: email, confirmationCode: code });
}

// Resend the verification code if they didn't get it.
export async function resendCode(email: string) {
  return resendSignUpCode({ username: email });
}

// Sign in an existing, verified user. Signs out any lingering session first
// so we never hit the "already a signed in user" error.
export async function loginUser(email: string, password: string) {
  try {
    await signOut();
  } catch {
    // no existing session — fine
  }
  return signIn({ username: email, password });
}

// Sign out the current user.
export async function logoutUser() {
  return signOut();
}

// Check if someone is already signed in (for skipping onboarding on launch).
export async function getSignedInUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null; // not signed in
  }
}

// Get the signed-in user's unique Cognito ID (the stable identifier for
// keying their data). Returns null if not signed in.
export async function getUserId(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    return user.userId; // Cognito's stable unique id for this user
  } catch {
    return null;
  }
}