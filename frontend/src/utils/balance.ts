/**
 * Balance/difference color helper — teal for non-negative, red for
 * negative.
 *
 * Teal matches the income series color in the charts (#0d9488 =
 * teal-600), so "positive money" reads the same color everywhere.
 * Shared by BudgetCard, CategorySection, SummaryBar, and ChartsPage,
 * which previously repeated the same Tailwind class ternaries.
 */

/** Tailwind classes for a value that is >= 0 (teal) vs < 0 (red). */
export function balanceColor(value: number): string {
  return value >= 0
    ? 'text-teal-600 dark:text-teal-400'
    : 'text-red-600 dark:text-red-400';
}
