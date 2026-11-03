/**
 * BudgetCard — card showing a budget summary on the dashboard.
 *
 * Displays the budget title, month/year, and quick stats (income, expenses,
 * balance). Clicking the card navigates to the budget detail page.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetsApi } from '../api';
import { formatCurrency, formatMonthYear } from '../utils/format';
import { balanceColor } from '../utils/balance';
import { queryKeys } from '../utils/queryKeys';
import { ConfirmDialog } from './ConfirmDialog';
import type { Budget } from '../types';

export function BudgetCard({ budget }: { budget: Budget }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch summary for quick stats
  const { data: summary } = useQuery({
    queryKey: queryKeys.budget.summary(budget.id),
    queryFn: () => budgetsApi.getSummary(budget.id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => budgetsApi.delete(budget.id),
    onSuccess: () => {
      // Refresh the dashboard list; the deleted card unmounts, which
      // inactivates its summary query. We don't removeQueries on the
      // summary query because this card actively observes it (removing
      // an observed query triggers a refetch → 404).
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
    },
  });

  const balance = summary ? parseFloat(summary.actual_balance) : 0;

  return (
    <div
      onClick={() => navigate(`/budgets/${budget.id}`)}
      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {budget.title}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-500">
            {formatMonthYear(budget.month, budget.year)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
            title="Delete budget"
            aria-label={`Delete budget ${budget.title}`}
          >
            🗑
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-gray-500 dark:text-gray-500">Gehalt</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {summary ? formatCurrency(summary.total_actual_gehalt) : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-500">Extra</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {summary ? formatCurrency(summary.total_actual_extra) : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-500">Expenses</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {summary ? formatCurrency(summary.total_actual_expenses) : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-500">Balance</p>
          <p className={`font-semibold ${balanceColor(balance)}`}>
            {summary ? formatCurrency(summary.actual_balance) : '—'}
          </p>
        </div>
      </div>

      {/* ── Delete confirmation modal ─────────── */}
      {showDeleteConfirm && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            title="Delete Budget"
            message={
              <>
                Are you sure you want to delete{' '}
                <span className="font-semibold">{budget.title}</span>? This
                will permanently remove all categories, expense items, and
                income entries. This action cannot be undone.
              </>
            }
            confirmLabel="Delete Budget"
            isPending={deleteMutation.isPending}
            errorMessage={
              deleteMutation.isError
                ? 'Failed to delete budget. Please try again.'
                : null
            }
            onConfirm={() => deleteMutation.mutate()}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        </div>
      )}
    </div>
  );
}
