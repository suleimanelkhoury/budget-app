/**
 * Shared chart theme — colors and Recharts styling used across
 * ChartsPage, ComparisonPage, and YearlyComparisonView.
 */

/** Palette used to color pie slices (cycled). */
export const PIE_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#3b82f6',
  '#a855f7',
  '#22c55e',
  '#eab308',
];

/** Named series colors (stat cards + line charts). */
export const SERIES_COLORS = {
  Gehalt: '#10b981',
  Extra: '#f59e0b',
  Expenses: '#ef4444',
  Balance: '#14b8a6',
  Invested: '#6366f1',
  Projected: '#6366f1',
  Actual: '#10b981',
};

/** Consistent tooltip styling for all charts. */
export const CHART_TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
} as const;
