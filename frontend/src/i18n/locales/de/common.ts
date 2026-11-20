/**
 * Gemeinsame Texte — Aktionen, Fehler-Fallbacks, Validierungsmeldungen,
 * Theme-Umschalter und relative Zeitangaben (utils/format.ts).
 *
 * Die App duzt (informelle Anrede).
 */

const common = {
  actions: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    confirm: 'Bestätigen',
    close: 'Schließen',
    logout: 'Abmelden',
    logIn: 'Anmelden',
    register: 'Registrieren',
    loggingIn: 'Anmeldung…',
    creatingAccount: 'Konto wird erstellt…',
    deleting: 'Wird gelöscht…',
  },
  states: {
    loading: 'Wird geladen…',
  },
  errors: {
    generic: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    incorrectCredentials: 'E-Mail oder Passwort ist falsch.',
    registrationFailed: 'Registrierung fehlgeschlagen.',
  },
  validation: {
    invalidEmail: 'Bitte gib eine gültige E-Mail-Adresse ein',
    passwordRequired: 'Passwort ist erforderlich',
    passwordMinLength: 'Das Passwort muss mindestens 8 Zeichen lang sein',
    passwordsDoNotMatch: 'Passwörter stimmen nicht überein',
  },
  theme: {
    toDark: 'Zum dunklen Modus wechseln',
    toLight: 'Zum hellen Modus wechseln',
  },
  time: {
    justNow: 'gerade eben',
    minutesAgo_one: 'vor {{count}} Min.',
    minutesAgo_other: 'vor {{count}} Min.',
    hoursAgo_one: 'vor {{count}} Std.',
    hoursAgo_other: 'vor {{count}} Std.',
    yesterday: 'gestern, {{time}}',
    daysAgo_one: 'vor {{count}} Tag',
    daysAgo_other: 'vor {{count}} Tagen',
  },
};

export default common;
