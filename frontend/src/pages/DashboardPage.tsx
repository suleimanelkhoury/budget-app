/**
 * Dashboard Page — overview of all budgets.
 *
 * Shows a grid of budget cards with quick stats, a button to create a
 * new budget, and a button to import an Excel file.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetsApi } from '../api';
import { BudgetCard } from '../components/BudgetCard';
import { DashboardSummary } from '../components/DashboardSummary';
import { ExcelImportModal } from '../components/ExcelImportModal';
import { Spinner } from '../components/Spinner';
import { emptyBudgetDraft } from '../utils/budgetForm';
import { queryKeys } from '../utils/queryKeys';

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBudget, setNewBudget] = useState(emptyBudgetDraft);

  const { data: budgets, isLoading } = useQuery({
    queryKey: queryKeys.budgets,
    queryFn: budgetsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: budgetsApi.create,
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
      queryClient.invalidateQueries({ queryKey: queryKeys.comparison });
      queryClient.invalidateQueries({ queryKey: queryKeys.yearlyComparison });
      setShowCreateForm(false);
      setNewBudget(emptyBudgetDraft());
      navigate(`/budgets/${budget.id}`);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newBudget);
  };

  const handleImportSuccess = (budgetId: number) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
    queryClient.invalidateQueries({ queryKey: queryKeys.comparison });
    queryClient.invalidateQueries({ queryKey: queryKeys.yearlyComparison });
    setShowImportModal(false);
    navigate(`/budgets/${budgetId}`);
  };

  if (isLoading) {
    return <Spinner />;
  }

  // ── Current/latest budget ───────────────────
  // This month's budget if one exists, otherwise the most recent one.
  // The backend returns budgets sorted by (year, month) ascending, so
  // the last element is the latest.
  const now = new Date();
  const currentBudget = budgets
    ? budgets.find(
        (b) => b.month === now.getMonth() + 1 && b.year === now.getFullYear(),
      ) ?? budgets[budgets.length - 1]
    : undefined;

  // ── Year-grouped archive ────────────────────
  // All budgets grouped by year (newest year first, newest month
  // first within a year). Sections are collapsible; by default the
  // newest year is expanded and older years are collapsed. Explicit
  // toggles win over the default. The current/latest budget appears
  // in its year section, highlighted.
  const archiveBudgets = budgets ?? [];
  const archiveYears = [...new Set(archiveBudgets.map((b) => b.year))].sort(
    (a, b) => b - a,
  );
  const [collapsedOverrides, setCollapsedOverrides] = useState<
    Record<number, boolean>
  >({});
  const isCollapsed = (year: number) =>
    collapsedOverrides[year] ?? year !== archiveYears[0];
  const toggleYear = (year: number) =>
    setCollapsedOverrides((prev) => ({ ...prev, [year]: !isCollapsed(year) }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Your Budgets
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            📥 Import Excel
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + New Budget
          </button>
        </div>
      </div>

      {/* ── Create budget form ────────────────── */}
      {showCreateForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Create New Budget
          </h2>
          <form onSubmit={handleCreate} className="flex flex-wrap gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Title
              </label>
              <input
                type="text"
                value={newBudget.title}
                onChange={(e) =>
                  setNewBudget({ ...newBudget, title: e.target.value })
                }
                placeholder="e.g. Juli 2026"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Month
              </label>
              <select
                value={newBudget.month}
                onChange={(e) =>
                  setNewBudget({
                    ...newBudget,
                    month: parseInt(e.target.value),
                  })
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Year
              </label>
              <input
                type="number"
                value={newBudget.year}
                onChange={(e) =>
                  setNewBudget({ ...newBudget, year: parseInt(e.target.value) })
                }
                min="2000"
                max="2100"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Year-to-date summary strip ─────────── */}
      <DashboardSummary />

      {/* ── Budget grid ───────────────────────── */}
      {archiveBudgets.length > 0 ? (
        archiveYears.map((year) => {
          const yearBudgets = archiveBudgets
            .filter((b) => b.year === year)
            .sort((a, b) => b.month - a.month); // newest month first
          const collapsed = isCollapsed(year);
          return (
            <section key={year} className="mb-6">
              <button
                type="button"
                onClick={() => toggleYear(year)}
                aria-expanded={!collapsed}
                className="mb-3 flex w-full items-center gap-2 text-left"
              >
                <span
                  className={`text-sm text-gray-500 transition-transform dark:text-gray-400 ${
                    collapsed ? '' : 'rotate-90'
                  }`}
                >
                  ▶
                </span>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {year}
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-500">
                  {yearBudgets.length}{' '}
                  {yearBudgets.length === 1 ? 'budget' : 'budgets'}
                </span>
              </button>
              {!collapsed && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {yearBudgets.map((budget) => (
                    <BudgetCard
                      key={budget.id}
                      budget={budget}
                      isCurrent={budget.id === currentBudget?.id}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-500">
            No budgets yet. Create a new budget or import from Excel to get
            started.
          </p>
        </div>
      )}

      {/* ── Import modal ──────────────────────── */}
      <ExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
