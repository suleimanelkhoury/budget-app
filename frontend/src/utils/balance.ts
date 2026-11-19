/**
 * Balance/difference color helper — teal for non-negative, burgundy
 * for negative.
 *
 * Teal matches the income series color in the charts (#0d9488 =
 * teal-600), burgundy matches the expenses series (#9f1239 = rose-800),
 * so "money in / money out" reads the same color everywhere.
 * Shared by BudgetCard, CategorySection, SummaryBar, and ChartsPage,
 * which previously repeated the same Tailwind class ternaries.
 */

/** Tailwind classes for a value that is >= 0 (teal) vs < 0 (burgundy). */
export function balanceColor(value: number): string {
  return value >= 0
    ? 'text-teal-600 dark:text-teal-400'
    : 'text-rose-800 dark:text-rose-400';
}
