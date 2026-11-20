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
import { useTranslation, Trans } from 'react-i18next';
import { formatCurrency, formatMonthYear } from '../utils/format';
import { toNumber } from '../utils/format';
import { balanceColor } from '../utils/balance';
import { queryKeys } from '../utils/queryKeys';
import { ConfirmDialog } from './ConfirmDialog';
import type { Budget } from '../types';
import { DownloadIcon, Trash2Icon } from './Icons';

export function BudgetCard({
  budget,
  isCurrent = false,
}: {
  budget: Budget;
  isCurrent?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch summary for quick stats
  const { data: summary } = useQuery({
    queryKey: queryKeys.budget.summary(budget.id),
    queryFn: () => budgetsApi.getSummary(budget.id),
  });

  // ── Clone quick action (current card only) ──
  // Clones this budget into the next month: projected (SOLL) amounts
  // are copied, actual (IST) amounts start at zero.
  const nextMonth = budget.month === 12 ? 1 : budget.month + 1;
  const nextYear = budget.month === 12 ? budget.year + 1 : budget.year;
  const nextTitle = formatMonthYear(nextMonth, nextYear);

  const cloneMutation = useMutation({
    mutationFn: () =>
      budgetsApi.clone(budget.id, {
        title: nextTitle,
        month: nextMonth,
        year: nextYear,
      }),
    onSuccess: (newBudget) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
      queryClient.invalidateQueries({ queryKey: queryKeys.comparison });
      queryClient.invalidateQueries({ queryKey: queryKeys.yearlyComparison });
      navigate(`/budgets/${newBudget.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => budgetsApi.delete(budget.id),
    onSuccess: () => {
      // Refresh the dashboard list; the deleted card unmounts, which
      // inactivates its summary query. We don't removeQueries on the
      // summary query because this card actively observes it (removing
      // an observed query triggers a refetch → 404).
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
      // The comparison strips aggregate budget data — refresh them too
      queryClient.invalidateQueries({ queryKey: queryKeys.comparison });
      queryClient.invalidateQueries({ queryKey: queryKeys.yearlyComparison });
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => budgetsApi.exportExcel(budget.id),
  });

  const balance = summary ? toNumber(summary.actual_balance) : 0;

  return (
    <div
      onClick={() => navigate(`/budgets/${budget.id}`)}
      className={`cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 ${
        isCurrent
          ? 'border-brand-400 ring-1 ring-brand-400 dark:border-brand-500 dark:ring-brand-500'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {budget.title}
          </h3>
          {isCurrent && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
              {t('dashboard.card.current')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-500">
            {formatMonthYear(budget.month, budget.year)}
          </span>
          {isCurrent && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                cloneMutation.mutate();
              }}
              disabled={cloneMutation.isPending}
              className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950 disabled:opacity-50"
              title={t('dashboard.card.cloneTitle', { month: nextTitle })}
            >
              +
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              exportMutation.mutate();
            }}
            disabled={exportMutation.isPending}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950 dark:hover:text-brand-400 disabled:opacity-50"
            title={t('dashboard.card.exportTitle')}
            aria-label={t('dashboard.card.exportAriaLabel', {
              title: budget.title,
            })}
          >
            <DownloadIcon size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
            title={t('dashboard.card.deleteTitle')}
            aria-label={t('dashboard.card.deleteAriaLabel', {
              title: budget.title,
            })}
          >
            <Trash2Icon size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-gray-500 dark:text-gray-500">
            {t('dashboard.card.labels.gehalt')}
          </p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {summary ? formatCurrency(summary.total_actual_gehalt) : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-500">
            {t('dashboard.card.labels.extra')}
          </p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {summary ? formatCurrency(summary.total_actual_extra) : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-500">
            {t('dashboard.card.labels.expenses')}
          </p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {summary ? formatCurrency(summary.total_actual_expenses) : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-500">
            {t('dashboard.card.labels.balance')}
          </p>
          <p className={`font-semibold ${balanceColor(balance)}`}>
            {summary ? formatCurrency(summary.actual_balance) : '—'}
          </p>
        </div>
      </div>

      {/* ── Delete confirmation modal ─────────── */}
      {showDeleteConfirm && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            title={t('dashboard.card.deleteConfirm.title')}
            message={
              <Trans
                i18nKey="dashboard.card.deleteConfirm.message"
                values={{ title: budget.title }}
                components={{ bold: <span className="font-semibold" /> }}
              />
            }
            confirmLabel={t('dashboard.card.deleteConfirm.confirmLabel')}
            isPending={deleteMutation.isPending}
            errorMessage={
              deleteMutation.isError
                ? t('dashboard.card.deleteConfirm.error')
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
