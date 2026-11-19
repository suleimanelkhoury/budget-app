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
      ? 'bg-brand-600 text-white hover:bg-brand-700'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
  }`;
}

/**
 * Tailwind classes for secondary ("neutral") action buttons — the
 * gray-filled style used across the app (calculator keypad, cancel
 * buttons, toolbar actions like Import Excel). Use instead of the old
 * bordered-white style so all neutral buttons look and hover alike.
 */
export const neutralButtonClass =
  'rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700';
