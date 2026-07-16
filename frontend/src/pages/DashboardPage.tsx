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
import { ExcelImportModal } from '../components/ExcelImportModal';

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBudget, setNewBudget] = useState({
    title: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: budgetsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: budgetsApi.create,
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setShowCreateForm(false);
      setNewBudget({
        title: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      });
      navigate(`/budgets/${budget.id}`);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newBudget);
  };

  const handleImportSuccess = (budgetId: number) => {
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    setShowImportModal(false);
    navigate(`/budgets/${budgetId}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400" />
      </div>
    );
  }

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

      {/* ── Budget grid ───────────────────────── */}
      {budgets && budgets.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} />
          ))}
        </div>
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
