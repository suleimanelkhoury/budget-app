/**
 * Shared chart theme — colors and Recharts styling used across
 * ChartsPage, DashboardSummary, and CategorySpendingModal.
 */

/** Palette used to color pie slices (cycled).
 *
 * Muted, warm-leaning categorical colors — dusty earth tones chosen to
 * suit the terracotta theme (low chroma, mid luminance, so slices don't
 * scream next to the UI). Deliberately disjoint from SERIES_COLORS: the
 * pie legend sits next to the SOLL/IST bar legend on the Monthly tab,
 * and identical colors in both made the legends look like one shared
 * mapping.
 */
export const PIE_COLORS = [
  '#b0684d', // clay
  '#8d5a74', // plum
  '#c2a04c', // ochre
  '#6b8cae', // dusty blue
  '#7f9a6d', // sage
  '#c87f4f', // burnt orange
  '#7d89a8', // slate
  '#b5738a', // dusty rose
  '#8a8f4a', // olive
  '#9b7f9e', // mauve
  '#a9846b', // camel
  '#5f9490', // muted teal
];

/** Named series colors (stat cards + line charts).
 *
 * Income = teal, Expenses = burgundy (deliberately darker than the
 * old red so the two don't read as "AI default red/green").
 * Projected/Invested/Balance follow the brand terracotta (see @theme
 * in index.css); Balance never shares a chart with Projected, so the
 * reuse is safe. Plan stays neutral gray — both plan lines (expenses
 * and balance) use it, so dashed gray consistently means "plan".
 */
export const SERIES_COLORS = {
  Gehalt: '#10b981',
  Income: '#0d9488',
  Extra: '#f59e0b',
  Expenses: '#9f1239',
  Balance: '#b8492c',
  Invested: '#b8492c',
  Projected: '#b8492c',
  Actual: '#10b981',
  Plan: '#9ca3af',
};

/** Consistent tooltip styling for all charts. */
export const CHART_TOOLTIP_STYLE = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
} as const;
