/**
 * CloneBudgetForm — inline form on the budget detail page to clone the
 * budget into a new month (recurring expenses). Copies all categories,
 * items, and income; actual (IST) amounts are zeroed unless
 * "copy actuals" is checked.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { budgetsApi } from '../api';
import { formatMonthYear } from '../utils/format';
import { queryKeys } from '../utils/queryKeys';
import { neutralButtonClass } from '../utils/ui';
import type { Budget } from '../types';

interface CloneBudgetFormProps {
  budgetId: number;
  /** Used to default the clone to the next month. */
  budget: Budget;
  onClose: () => void;
}

export function CloneBudgetForm({
  budgetId,
  budget,
  onClose,
}: CloneBudgetFormProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Default the clone to the next month
  const nextMonth = budget.month === 12 ? 1 : budget.month + 1;
  const nextYear = budget.month === 12 ? budget.year + 1 : budget.year;

  const [cloneData, setCloneData] = useState({
    title: formatMonthYear(nextMonth, nextYear),
    month: nextMonth,
    year: nextYear,
    copy_actuals: false,
  });

  const cloneMutation = useMutation({
    mutationFn: () => budgetsApi.clone(budgetId, cloneData),
    onSuccess: (newBudget) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
      queryClient.invalidateQueries({ queryKey: queryKeys.comparison });
      queryClient.invalidateQueries({ queryKey: queryKeys.yearlyComparison });
      onClose();
      navigate(`/budgets/${newBudget.id}`);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        cloneMutation.mutate();
      }}
      className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        {t('detail.clone.heading')}
      </h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        {t('detail.clone.description')}
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('detail.clone.titleLabel')}
          </label>
          <input
            type="text"
            value={cloneData.title}
            onChange={(e) =>
              setCloneData({ ...cloneData, title: e.target.value })
            }
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('detail.clone.monthLabel')}
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
            className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('detail.clone.yearLabel')}
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
            className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
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
          {t('detail.clone.copyActuals')}
        </label>
        <button
          type="submit"
          disabled={cloneMutation.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {cloneMutation.isPending
            ? t('detail.clone.cloning')
            : t('detail.clone.submit')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={neutralButtonClass}
        >
          {t('common.actions.cancel')}
        </button>
      </div>
    </form>
  );
}
