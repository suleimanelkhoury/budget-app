/**
 * Shared chart theme — colors and Recharts styling used across
 * ChartsPage, DashboardSummary, and CategorySpendingModal.
 */

/** Palette used to color pie slices (cycled).
 *
 * Deliberately disjoint from SERIES_COLORS: the pie legend sits next to
 * the SOLL/IST bar legend on the Monthly tab, and identical colors in
 * both (e.g. indigo #6366f1 = SOLL *and* a category) made the legends
 * look like one shared mapping.
 */
export const PIE_COLORS = [
  '#a855f7',
  '#ec4899',
  '#f97316',
  '#06b6d4',
  '#84cc16',
  '#eab308',
  '#8b5cf6',
  '#d946ef',
  '#3b82f6',
  '#0ea5e9',
  '#78716c',
  '#64748b',
];

/** Named series colors (stat cards + line charts). */
export const SERIES_COLORS = {
  Gehalt: '#10b981',
  Income: '#10b981',
  Extra: '#f59e0b',
  Expenses: '#ef4444',
  Balance: '#14b8a6',
  Invested: '#6366f1',
  Projected: '#6366f1',
  Actual: '#10b981',
  Plan: '#9ca3af',
};

/** Consistent tooltip styling for all charts. */
export const CHART_TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
} as const;
