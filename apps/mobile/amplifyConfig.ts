import { Amplify } from 'aws-amplify';

// Cognito configuration for the Trackify user pool (us-west-2).
// These are public identifiers — safe to have in the app (the app client has
// no secret, which is correct for a mobile "public client").
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-west-2_nqyLGuNcM',
      userPoolClientId: '533g6i6teneo7h78fpk5d62sdh',
    },
  },
});