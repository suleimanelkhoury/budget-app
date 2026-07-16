/**
 * SummaryBar — sticky bar at bottom showing grand totals.
 *
 * Displays SOLL GESAMTKOSTEN, IST GESAMTKOSTEN, GESAMTUNTERSCHIED,
 * SOLL BALANCE, IST BALANCE, and UNTERSCHIED.
 */

import { formatCurrency, formatDifference } from '../utils/format';
import type { BudgetSummary } from '../types';

interface SummaryBarProps {
  summary: BudgetSummary | undefined;
}

export function SummaryBar({ summary }: SummaryBarProps) {
  if (!summary) return null;

  const expenseDiff = parseFloat(summary.expense_difference);
  const balanceDiff = parseFloat(summary.balance_difference);

  return (
    <div className="sticky bottom-0 z-30 border-t border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 lg:grid-cols-6">
        {/* SOLL GESAMTKOSTEN */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            SOLL GESAMTKOSTEN
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(summary.total_projected_expenses)}
          </p>
        </div>
        {/* IST GESAMTKOSTEN */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            IST GESAMTKOSTEN
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(summary.total_actual_expenses)}
          </p>
        </div>
        {/* GESAMTUNTERSCHIED */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            GESAMTUNTERSCHIED
          </p>
          <p
            className={`text-sm font-semibold ${expenseDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {formatDifference(summary.expense_difference)}
          </p>
        </div>
        {/* SOLL BALANCE */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            SOLL BALANCE
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(summary.projected_balance)}
          </p>
        </div>
        {/* IST BALANCE */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            IST BALANCE
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(summary.actual_balance)}
          </p>
        </div>
        {/* UNTERSCHIED */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            UNTERSCHIED
          </p>
          <p
            className={`text-sm font-semibold ${balanceDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {formatDifference(summary.balance_difference)}
          </p>
        </div>
      </div>
    </div>
  );
}
