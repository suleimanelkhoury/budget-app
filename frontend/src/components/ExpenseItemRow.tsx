/**
 * ExpenseItemRow — single expense item row with inline-editable fields.
 *
 * Shows label, projected cost, actual cost, and the calculated difference.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseItemsApi } from '../api';
import { DifferenceBadge } from './DifferenceBadge';
import { EditableCell } from './EditableCell';
import type { ExpenseItem } from '../types';

interface ExpenseItemRowProps {
  item: ExpenseItem;
  budgetId: number;
}

export function ExpenseItemRow({ item, budgetId }: ExpenseItemRowProps) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { label?: string; projected_cost?: string; actual_cost?: string };
    }) => expenseItemsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary', budgetId] });
      queryClient.invalidateQueries({
        queryKey: ['budget-category-summary', budgetId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: expenseItemsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget', budgetId] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary', budgetId] });
    },
  });

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-5 py-2">
        <EditableCell
          value={item.label}
          onSave={(v) =>
            updateMutation.mutate({ id: item.id, data: { label: v } })
          }
        />
      </td>
      <td className="px-5 py-2 text-right">
        <EditableCell
          value={item.projected_cost}
          type="number"
          onSave={(v) =>
            updateMutation.mutate({
              id: item.id,
              data: { projected_cost: v },
            })
          }
        />
      </td>
      <td className="px-5 py-2 text-right">
        <EditableCell
          value={item.actual_cost}
          type="number"
          onSave={(v) =>
            updateMutation.mutate({
              id: item.id,
              data: { actual_cost: v },
            })
          }
        />
      </td>
      <td className="px-5 py-2 text-right">
        <DifferenceBadge value={item.difference} />
      </td>
      <td className="px-5 py-2 text-right">
        <button
          onClick={() => deleteMutation.mutate(item.id)}
          className="text-gray-400 hover:text-red-600"
          title="Delete"
        >
          🗑
        </button>
      </td>
    </tr>
  );
}
