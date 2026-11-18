/**
 * Shared UI helpers — class-name builders for common interactive styles.
 */

/**
 * Tailwind classes for pill/tab toggle buttons (e.g. the Overall/Monthly
 * tabs on the Charts page and the year pills on the dashboard).
 */
export function pillButtonClass(active: boolean): string {
  return `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
    active
      ? 'bg-indigo-600 text-white'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
  }`;
}
