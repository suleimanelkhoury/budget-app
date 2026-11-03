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
import type { Budget } from '../types';

export function BudgetCard({ budget }: { budget: Budget }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch summary for quick stats
  const { data: summary } = useQuery({
    queryKey: ['budget-summary', budget.id],
    queryFn: () => budgetsApi.getSummary(budget.id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => budgetsApi.delete(budget.id),
    onSuccess: () => {
      // Refresh the dashboard list; the deleted card unmounts, which
      // inactivates its summary query. We don't removeQueries on the
      // summary query because this card actively observes it (removing
      // an observed query triggers a refetch → 404).
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  const balance = summary ? parseFloat(summary.actual_balance) : 0;
  const balanceColor =
    balance >= 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';

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
          <p className={`font-semibold ${balanceColor}`}>
            {summary ? formatCurrency(summary.actual_balance) : '—'}
          </p>
        </div>
      </div>

      {/* ── Delete confirmation modal ─────────── */}
      {showDeleteConfirm && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Delete Budget
            </h2>
            <p className="mb-1 text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to delete{' '}
              <span className="font-semibold">{budget.title}</span>?
            </p>
            <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
              This will permanently remove all categories, expense items, and
              income entries. This action cannot be undone.
            </p>
            {deleteMutation.isError && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                Failed to delete budget. Please try again.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete Budget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
