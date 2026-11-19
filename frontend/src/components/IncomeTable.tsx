/**
 * IncomeTable — editable income table (projected, actual, difference).
 *
 * Shows all income entries for a budget with inline-editable amounts.
 * The difference is auto-calculated and shown with a DifferenceBadge.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { incomeApi } from '../api';
import { invalidateBudgetData } from '../utils/queryKeys';
import { DifferenceBadge } from './DifferenceBadge';
import { EditableCell } from './EditableCell';
import type { Income } from '../types';
import { Trash2Icon } from './Icons';

interface IncomeTableProps {
  budgetId: number;
  incomes: Income[];
}

export function IncomeTable({ budgetId, incomes }: IncomeTableProps) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: {
        label?: string;
        projected_amount?: string;
        actual_amount?: string;
      };
    }) => incomeApi.update(id, data),
    onSuccess: () => {
      invalidateBudgetData(queryClient, budgetId);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: incomeApi.delete,
    onSuccess: () => {
      invalidateBudgetData(queryClient, budgetId);
    },
  });

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
        Income / Einkommen
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-500">
              <th className="py-2 pl-0 pr-4">Label</th>
              <th className="py-2 pr-4 text-right">SOLL (Projected)</th>
              <th className="py-2 pr-4 text-right">IST (Actual)</th>
              <th className="py-2 pr-4 text-right">Difference</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {incomes.map((income) => (
              <tr
                key={income.id}
                className="border-b border-gray-100 last:border-0 dark:border-gray-700"
              >
                <td className="py-2 pl-0 pr-4">
                  <EditableCell
                    value={income.label}
                    onSave={(v) =>
                      updateMutation.mutate({
                        id: income.id,
                        data: { label: v },
                      })
                    }
                  />
                </td>
                <td className="py-2 pr-4 text-right">
                  <EditableCell
                    value={income.projected_amount}
                    type="number"
                    onSave={(v) =>
                      updateMutation.mutate({
                        id: income.id,
                        data: { projected_amount: v },
                      })
                    }
                  />
                </td>
                <td className="py-2 pr-4 text-right">
                  <EditableCell
                    value={income.actual_amount}
                    type="number"
                    onSave={(v) =>
                      updateMutation.mutate({
                        id: income.id,
                        data: { actual_amount: v },
                      })
                    }
                  />
                </td>
                <td className="py-2 pr-4 text-right">
                  <DifferenceBadge value={income.difference} />
                </td>
                <td className="py-2 pr-4 text-right">
                  <button
                    onClick={() => deleteMutation.mutate(income.id)}
                    className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2Icon size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {incomes.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-4 pl-0 text-center text-sm text-gray-400 dark:text-gray-500"
                >
                  No income entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
