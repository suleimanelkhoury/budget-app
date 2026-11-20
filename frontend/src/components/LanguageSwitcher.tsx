/**
 * LanguageSwitcher — select for the UI language (English / Deutsch).
 *
 * The choice takes effect immediately (react-i18next re-renders every
 * translated component) and is persisted to localStorage — see
 * src/i18n/index.ts.
 */

import { useTranslation } from 'react-i18next';
import { changeLanguage, LANGUAGES, type LanguageCode } from '../i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <div>
      <label
        htmlFor="language"
        className="text-sm font-medium text-gray-500 dark:text-gray-500"
      >
        {t('settings.language.title')}
      </label>
      <select
        id="language"
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value as LanguageCode)}
        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        {t('settings.language.hint')}
      </p>
    </div>
  );
}
