/**
 * Spinner — a centered loading spinner used across pages.
 */

import { useTranslation } from 'react-i18next';

export function Spinner() {
  const { t } = useTranslation();
  return (
    <div className="flex h-64 items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-brand-600 dark:border-gray-700 dark:border-t-brand-400"
        role="status"
        aria-label={t('common.states.loading')}
      />
    </div>
  );
}
