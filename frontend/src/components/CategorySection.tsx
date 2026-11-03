/**
 * CategorySection — a category block with its expense items and subtotal.
 *
 * Shows the category name, a table of expense items, the Zwischensumme
 * (subtotal), and buttons to add items or delete the category.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { categoriesApi, expenseItemsApi } from '../api';
import { invalidateBudgetData } from '../utils/queryKeys';
import { balanceColor } from '../utils/balance';
import { formatCurrency, formatDifference } from '../utils/format';
import { ExpenseItemRow } from './ExpenseItemRow';
import type { Category } from '../types';

interface CategorySectionProps {
  category: Category;
  budgetId: number;
}

export function CategorySection({ category, budgetId }: CategorySectionProps) {
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    label: '',
    projected_cost: '0',
    actual_cost: '0',
  });

  // Calculate subtotal (Zwischensumme)
  const projectedSubtotal = category.items.reduce(
    (sum, item) => sum + parseFloat(item.projected_cost),
    0,
  );
  const actualSubtotal = category.items.reduce(
    (sum, item) => sum + parseFloat(item.actual_cost),
    0,
  );
  const difference = projectedSubtotal - actualSubtotal;

  const addItemMutation = useMutation({
    mutationFn: (data: {
      label: string;
      projected_cost: string;
      actual_cost: string;
    }) => expenseItemsApi.create(category.id, data),
    onSuccess: () => {
      invalidateBudgetData(queryClient, budgetId);
      setShowAddItem(false);
      setNewItem({ label: '', projected_cost: '0', actual_cost: '0' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: () => categoriesApi.delete(category.id),
    onSuccess: () => {
      invalidateBudgetData(queryClient, budgetId);
    },
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    addItemMutation.mutate(newItem);
  };

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* ── Category header ───────────────────── */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          {category.name}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddItem(!showAddItem)}
            className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            + Add Item
          </button>
          <button
            onClick={() => deleteCategoryMutation.mutate()}
            className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
            title="Delete category"
          >
            🗑
          </button>
        </div>
      </div>

      {/* ── Add item form ─────────────────────── */}
      {showAddItem && (
        <form
          onSubmit={handleAddItem}
          className="flex flex-wrap gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-900"
        >
          <input
            type="text"
            value={newItem.label}
            onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
            placeholder="Item name"
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <input
            type="number"
            value={newItem.projected_cost}
            onChange={(e) =>
              setNewItem({ ...newItem, projected_cost: e.target.value })
            }
            placeholder="SOLL"
            step="0.01"
            className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <input
            type="number"
            value={newItem.actual_cost}
            onChange={(e) =>
              setNewItem({ ...newItem, actual_cost: e.target.value })
            }
            placeholder="IST"
            step="0.01"
            className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={addItemMutation.isPending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}

      {/* ── Items table ───────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[450px]">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-500">
              <th className="px-5 py-2">Label</th>
              <th className="px-5 py-2 text-right">SOLL</th>
              <th className="px-5 py-2 text-right">IST</th>
              <th className="px-5 py-2 text-right">Diff</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {category.items.map((item) => (
              <ExpenseItemRow key={item.id} item={item} budgetId={budgetId} />
            ))}
            {category.items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-3 text-center text-sm text-gray-400 dark:text-gray-500"
                >
                  No items in this category.
                </td>
              </tr>
            )}
          </tbody>
          {/* ── Subtotal (Zwischensumme) ─────────── */}
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-800">
              <td className="px-5 py-2 text-sm text-gray-700 dark:text-gray-300">
                Zwischensumme
              </td>
              <td className="px-5 py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                {formatCurrency(projectedSubtotal)}
              </td>
              <td className="px-5 py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                {formatCurrency(actualSubtotal)}
              </td>
              <td className={`px-5 py-2 text-right text-sm ${balanceColor(difference)}`}>
                {formatDifference(difference)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
