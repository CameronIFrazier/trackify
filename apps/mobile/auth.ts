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

// Sign in an existing, verified user.
export async function loginUser(email: string, password: string) {
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