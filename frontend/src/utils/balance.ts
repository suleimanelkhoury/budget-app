/**
 * Balance/difference color helper — green for non-negative, red for negative.
 *
 * Shared by BudgetCard, CategorySection, SummaryBar, and ComparisonPage,
 * which previously repeated the same Tailwind class ternaries.
 */

/** Tailwind classes for a value that is >= 0 (green) vs < 0 (red). */
export function balanceColor(value: number): string {
  return value >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
}
