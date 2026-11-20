/**
 * Common strings — actions, error fallbacks, validation messages,
 * theme toggle, and relative time (used by utils/format.ts).
 */

const common = {
  actions: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirm: 'Confirm',
    close: 'Close',
    logout: 'Logout',
    logIn: 'Log in',
    register: 'Register',
    loggingIn: 'Logging in…',
    creatingAccount: 'Creating account…',
    deleting: 'Deleting…',
  },
  states: {
    loading: 'Loading…',
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
    incorrectCredentials: 'Incorrect email or password.',
    registrationFailed: 'Registration failed.',
  },
  validation: {
    invalidEmail: 'Please enter a valid email',
    passwordRequired: 'Password is required',
    passwordMinLength: 'Password must be at least 8 characters',
    passwordsDoNotMatch: 'Passwords do not match',
  },
  theme: {
    toDark: 'Switch to dark mode',
    toLight: 'Switch to light mode',
  },
  time: {
    justNow: 'just now',
    minutesAgo_one: '{{count}} min ago',
    minutesAgo_other: '{{count}} min ago',
    hoursAgo_one: '{{count}} h ago',
    hoursAgo_other: '{{count}} h ago',
    yesterday: 'yesterday, {{time}}',
    daysAgo_one: '{{count}} day ago',
    daysAgo_other: '{{count}} days ago',
  },
};

export default common;
