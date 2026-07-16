/**
 * Budget Detail Page — the main view that mirrors the Excel sheet.
 *
 * Shows income section, category sections with items, subtotals,
 * grand totals (SummaryBar), and buttons to add income/categories.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { budgetsApi, categoriesApi, incomeApi } from '../api';
import { CategorySection } from '../components/CategorySection';
import { IncomeTable } from '../components/IncomeTable';
import { SummaryBar } from '../components/SummaryBar';
import type { Category } from '../types';

export function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const budgetId = parseInt(id ?? '0');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', sort_order: 0 });
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [newIncome, setNewIncome] = useState({
    label: '',
    projected_amount: '0',
    actual_amount: '0',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedCategoryId, setDraggedCategoryId] = useState<number | null>(
    null,
  );
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [cloneData, setCloneData] = useState({
    title: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    copy_actuals: false,
  });

  const { data: budget, isLoading } = useQuery({
    queryKey: ['budget', budgetId],
    queryFn: () => budgetsApi.get(budgetId),
    enabled: !!budgetId,
  });

  const { data: summary } = useQuery({
    queryKey: ['budget-summary', budgetId],
    queryFn: () => budgetsApi.getSummary(budgetId),
    enabled: !!budgetId,
    refetchInterval: 5000, // Refresh summary every 5s to reflect edits
  });

  const addCategoryMutation = useMutation({
    mutationFn: (data: { name: string; sort_order: number }) =>
      categoriesApi.create(budgetId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget', budgetId] });
      setShowAddCategory(false);
      setNewCategory({ name: '', sort_order: 0 });
    },
  });

  const addIncomeMutation = useMutation({
    mutationFn: (data: {
      label: string;
      projected_amount: string;
      actual_amount: string;
    }) => incomeApi.create(budgetId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary', budgetId] });
      setShowAddIncome(false);
      setNewIncome({ label: '', projected_amount: '0', actual_amount: '0' });
    },
  });

  // ── Drag-and-drop category reordering ──────
  const reorderMutation = useMutation({
    mutationFn: async (reordered: Category[]) => {
      // Update sort_order for each moved category
      await Promise.all(
        reordered.map((cat, index) =>
          categoriesApi.update(cat.id, { sort_order: index }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget', budgetId] });
    },
  });

  const handleDragStart = (categoryId: number) => {
    setDraggedCategoryId(categoryId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
  };

  const handleDrop = (targetCategoryId: number) => {
    if (
      draggedCategoryId === null ||
      draggedCategoryId === targetCategoryId ||
      !budget
    ) {
      setDraggedCategoryId(null);
      return;
    }

    const cats = [...budget.categories];
    const fromIndex = cats.findIndex((c) => c.id === draggedCategoryId);
    const toIndex = cats.findIndex((c) => c.id === targetCategoryId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedCategoryId(null);
      return;
    }

    // Reorder
    const [moved] = cats.splice(fromIndex, 1);
    cats.splice(toIndex, 0, moved);
    reorderMutation.mutate(cats);
    setDraggedCategoryId(null);
  };

  // ── Clone budget (recurring templates) ─────
  const cloneMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { title: string; month: number; year: number; copy_actuals: boolean };
    }) => budgetsApi.clone(id, data),
    onSuccess: (newBudget) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setShowCloneForm(false);
      navigate(`/budgets/${newBudget.id}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400" />
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="text-center">
        <p className="text-gray-500 dark:text-gray-500">Budget not found.</p>
        <Link
          to="/"
          className="text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* ── Header ─────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            to="/"
            className="mb-1 inline-block text-sm text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {budget.title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* ── Clone to new month (recurring templates) ── */}
          <button
            onClick={() => {
              // Default the clone to the next month
              const nextMonth = budget.month === 12 ? 1 : budget.month + 1;
              const nextYear = budget.month === 12 ? budget.year + 1 : budget.year;
              setCloneData({
                title: `${nextMonth}.${nextYear}`,
                month: nextMonth,
                year: nextYear,
                copy_actuals: false,
              });
              setShowCloneForm(!showCloneForm);
            }}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Clone this budget for a new month (recurring expenses)"
          >
            📅 Clone to New Month
          </button>
          {/* ── Search bar ─────────────────────────── */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items…"
              className="w-48 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none sm:w-64 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500">
              🔍
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Clone form ──────────────────────────── */}
      {showCloneForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            cloneMutation.mutate({ id: budgetId, data: cloneData });
          }}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Clone Budget for a New Month
          </h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Copies all categories, items, and income. Actual amounts are zeroed
            out by default so you can fill them in for the new month.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                New budget title
              </label>
              <input
                type="text"
                value={cloneData.title}
                onChange={(e) =>
                  setCloneData({ ...cloneData, title: e.target.value })
                }
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Month
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={cloneData.month}
                onChange={(e) =>
                  setCloneData({
                    ...cloneData,
                    month: parseInt(e.target.value),
                  })
                }
                required
                className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Year
              </label>
              <input
                type="number"
                min={1900}
                max={2100}
                value={cloneData.year}
                onChange={(e) =>
                  setCloneData({
                    ...cloneData,
                    year: parseInt(e.target.value),
                  })
                }
                required
                className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={cloneData.copy_actuals}
                onChange={(e) =>
                  setCloneData({
                    ...cloneData,
                    copy_actuals: e.target.checked,
                  })
                }
              />
              Copy actual amounts too
            </label>
            <button
              type="submit"
              disabled={cloneMutation.isPending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {cloneMutation.isPending ? 'Cloning…' : 'Clone Budget'}
            </button>
            <button
              type="button"
              onClick={() => setShowCloneForm(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Filter data based on search ────────── */}
      {(() => {
        const query = searchQuery.toLowerCase().trim();
        const filteredIncomes = query
          ? budget.incomes.filter((i) => i.label.toLowerCase().includes(query))
          : budget.incomes;
        const filteredCategories = query
          ? budget.categories
              .map((cat) => ({
                ...cat,
                items: cat.items.filter(
                  (item) =>
                    item.label.toLowerCase().includes(query) ||
                    cat.name.toLowerCase().includes(query),
                ),
              }))
              .filter(
                (cat) =>
                  cat.name.toLowerCase().includes(query) ||
                  cat.items.length > 0,
              )
          : budget.categories;

        return (
          <>
            {/* ── Income section ─────────────────────── */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <button
                  onClick={() => setShowAddIncome(!showAddIncome)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  + Add Income
                </button>
              </div>
              {showAddIncome && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addIncomeMutation.mutate(newIncome);
                  }}
                  className="mb-4 flex gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                >
                  <input
                    type="text"
                    value={newIncome.label}
                    onChange={(e) =>
                      setNewIncome({ ...newIncome, label: e.target.value })
                    }
                    placeholder="Income label (e.g. Einkommen)"
                    required
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="number"
                    value={newIncome.projected_amount}
                    onChange={(e) =>
                      setNewIncome({
                        ...newIncome,
                        projected_amount: e.target.value,
                      })
                    }
                    placeholder="SOLL"
                    step="0.01"
                    className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <input
                    type="number"
                    value={newIncome.actual_amount}
                    onChange={(e) =>
                      setNewIncome({
                        ...newIncome,
                        actual_amount: e.target.value,
                      })
                    }
                    placeholder="IST"
                    step="0.01"
                    className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={addIncomeMutation.isPending}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>
              )}
              <IncomeTable budgetId={budgetId} incomes={filteredIncomes} />
            </div>

            {/* ── Categories ─────────────────────────── */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Categories
                </h2>
                <button
                  onClick={() => setShowAddCategory(!showAddCategory)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  + Add Category
                </button>
              </div>
              {showAddCategory && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addCategoryMutation.mutate(newCategory);
                  }}
                  className="mb-4 flex gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                >
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) =>
                      setNewCategory({ ...newCategory, name: e.target.value })
                    }
                    placeholder="Category name (e.g. Wohnen)"
                    required
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="submit"
                    disabled={addCategoryMutation.isPending}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>
              )}
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  draggable={!searchQuery}
                  onDragStart={() => handleDragStart(category.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(category.id)}
                  className={
                    draggedCategoryId === category.id
                      ? 'opacity-50'
                      : 'opacity-100'
                  }
                >
                  <CategorySection category={category} budgetId={budgetId} />
                </div>
              ))}
              {filteredCategories.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
                  <p className="text-gray-500 dark:text-gray-500">
                    {searchQuery
                      ? `No items found matching "${searchQuery}".`
                      : 'No categories yet. Add a category to start tracking expenses.'}
                  </p>
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* ── Sticky summary bar ─────────────────── */}
      <SummaryBar summary={summary} />
    </div>
  );
}
