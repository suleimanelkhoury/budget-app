/**
 * i18n — react-i18next setup.
 *
 * Two languages: English (fallback) and German. The language is detected
 * once at startup: saved preference (localStorage) first, then the
 * browser language. The choice is persisted on change via changeLanguage.
 *
 * The same language is sent to the backend as the Accept-Language header
 * (see api/client.ts), so API error messages come back in the matching
 * language — the backend already carries bilingual error texts.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';
import de from './locales/de';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

/** localStorage key for the saved language preference. */
export const LANGUAGE_STORAGE_KEY = 'frekl.language';

/** Detect the initial language: saved preference, else browser language. */
function detectLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'en' || stored === 'de') return stored;
  } catch {
    // localStorage unavailable (e.g. blocked) — fall through to the browser language
  }
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: detectLanguage(),
  fallbackLng: 'en',
  // React already escapes rendered strings — disabling i18next's own
  // escaping avoids double-escaping (e.g. &amp; in texts)
  interpolation: { escapeValue: false },
});

// Keep <html lang> in sync for accessibility and browser tooling
document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

/** Switch the UI language and persist the choice. */
export function changeLanguage(lang: LanguageCode): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // localStorage unavailable — the choice applies for this session only
  }
  void i18n.changeLanguage(lang);
}

export default i18n;
