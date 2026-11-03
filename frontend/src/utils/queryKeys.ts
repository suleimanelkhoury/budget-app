/**
 * Centralized React Query key factories and invalidation helpers.
 *
 * All query keys used across the app live here as magic-string-free factories.
 * The `invalidateBudgetData` helper is the single place that knows which
 * queries a budget-editing mutation must refresh — call it instead of
 * duplicating invalidateQueries calls in every mutation's onSuccess.
 */

import type { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  budgets: ['budgets'] as const,
  budget: {
    detail: (id: number) => ['budget', id] as const,
    summary: (id: number) => ['budget-summary', id] as const,
    chartData: (id: number) => ['chart-data', id] as const,
  },
  comparison: ['budget-comparison'] as const,
  yearlyComparison: ['budget-comparison-yearly'] as const,
  templates: ['templates'] as const,
};

/**
 * Invalidate every query that reflects a budget's edited data.
 *
 * Safe to call after any mutation that adds, updates, or deletes income,
 * categories, or expense items inside a budget.
 */
export function invalidateBudgetData(
  queryClient: QueryClient,
  budgetId: number,
): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.budget.detail(budgetId) });
  queryClient.invalidateQueries({
    queryKey: queryKeys.budget.summary(budgetId),
  });
}
