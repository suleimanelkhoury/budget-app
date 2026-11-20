/**
 * DashboardSummary — stat strips above the budget grid, with a year
 * selector so the numbers can be viewed for any year with budgets.
 *
 * Row 1: money-flow overview for the selected year. "Expenses" tiles
 * show consumption only (investments excluded — see the Investing row).
 *
 * Row 2: investing — total invested in the selected year, monthly
 * average, and the investing rate (share of new income that went into
 * investments).
 *
 * Note on the money model: each month's remaining balance is carried
 * into the next month as its SOLL Extra, so monthly balances and Extra
 * income must NOT be summed across months (the same money would be
 * counted repeatedly). Instead:
 *
 *   - Overall Income        = overall expenses + end-of-year balance
 *                             − January carryover (new money in =
 *                             money out + pile growth; "expenses"
 *                             includes investing)
 *   - End-of-Year Balance   = the latest month's IST balance in the year
 *
 * Renders nothing while loading or when no budgets exist.
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { budgetsApi } from '../api';
import { balanceColor } from '../utils/balance';
import { formatCurrency, toNumber } from '../utils/format';
import { queryKeys } from '../utils/queryKeys';
import { neutralButtonClass, pillButtonClass } from '../utils/ui';
import { lazy, Suspense } from 'react';
// Lazy: the modal is the only reason the dashboard pulls in Recharts
// (~370 kB chunk). Loading it on first open keeps the initial
// dashboard chunk small.
const CategorySpendingModal = lazy(() =>
  import('./CategorySpendingModal').then((m) => ({
    default: m.CategorySpendingModal,
  })),
);
import type { BudgetComparisonEntry } from '../types';
import { ChartPieIcon } from './Icons';

interface StatTileProps {
  label: string;
  value: string;
  valueClassName?: string;
  title?: string;
}

function StatTile({ label, value, valueClassName, title }: StatTileProps) {
  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      title={title}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-lg font-semibold ${
          valueClassName ?? 'text-gray-900 dark:text-gray-100'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function DashboardSummary() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  // null = automatic: current year if it has budgets, else the newest
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showCategorySpending, setShowCategorySpending] = useState(false);

  const { data: comparison, isLoading: comparisonLoading } = useQuery({
    queryKey: queryKeys.comparison,
    queryFn: budgetsApi.compare,
  });
  const { data: yearly, isLoading: yearlyLoading } = useQuery({
    queryKey: queryKeys.yearlyComparison,
    queryFn: budgetsApi.compareYearly,
  });

  if (comparisonLoading || yearlyLoading) return null;

  const availableYears = [
    ...new Set(comparison?.budgets.map((b) => b.year) ?? []),
  ].sort((a, b) => b - a); // newest first
  if (availableYears.length === 0) return null;

  const activeYear =
    selectedYear ??
    (availableYears.includes(currentYear) ? currentYear : availableYears[0]);

  // Entries are sorted by (year, month) ascending — filter to the
  // selected year and keep that order.
  const entries: BudgetComparisonEntry[] =
    comparison?.budgets.filter((b) => b.year === activeYear) ?? [];
  if (entries.length === 0) return null;

  // ── Raw money-flow sums ─────────────────────
  const ytdExpenses = entries.reduce(
    (sum, e) => sum + toNumber(e.total_actual_expenses),
    0,
  );

  const latest = entries[entries.length - 1];
  const currentBalance = toNumber(latest.actual_balance);

  // The carryover written into the year's first budget (SOLL Extra) —
  // money earned last year, i.e. not new income this year.
  const startCarryover = toNumber(entries[0].total_projected_extra);

  const ytdSavings = currentBalance - startCarryover;
  const ytdIncome = ytdSavings + ytdExpenses;

  // ── Investing ───────────────────────────────
  // invested is already computed per year by the backend (sum of the
  // Investitionen category's actual costs).
  const yearEntry = yearly?.years.find((y) => y.year === activeYear);
  const invested = yearEntry ? toNumber(yearEntry.invested) : 0;
  const avgInvested = invested / entries.length;
  // Share of new income that went into investments. On average this is
  // the same per month, so one rate covers both views.
  const investingRate = ytdIncome > 0 ? (invested / ytdIncome) * 100 : null;

  // ── Consumption (investments excluded) ──────
  const ytdConsumption = ytdExpenses - invested;
  const avgConsumption = ytdConsumption / entries.length;

  return (
    <div className="mb-6">
      {/* ── Year selector + category spending ──── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {availableYears.map((year) => (
          <button
            key={year}
            type="button"
            onClick={() => setSelectedYear(year)}
            className={pillButtonClass(year === activeYear)}
          >
            {year}
          </button>
        ))}
        <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">
          |
        </span>
        <button
          type="button"
          onClick={() => setShowCategorySpending(true)}
          className={`${neutralButtonClass} inline-flex items-center gap-2`}
          title={t('dashboard.summary.categorySpendingTitle', {
            year: activeYear,
          })}
        >
          <ChartPieIcon size={14} /> {t('dashboard.summary.categorySpending')}
        </button>
      </div>

      {/* ── Row 1: money-flow overview ──────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label={t('dashboard.summary.overallIncome')}
          value={formatCurrency(ytdIncome)}
          title={t('dashboard.summary.overallIncomeTitle', {
            year: activeYear,
            carryover: formatCurrency(startCarryover),
          })}
        />
        <StatTile
          label={t('dashboard.summary.overallExpenses')}
          value={formatCurrency(ytdConsumption)}
          title={t('dashboard.summary.overallExpensesTitle', {
            amount: formatCurrency(invested),
          })}
        />
        <StatTile
          label={t('dashboard.summary.avgMonthlyExpenses')}
          value={formatCurrency(avgConsumption)}
          title={t('dashboard.summary.avgExpensesTitle', {
            count: entries.length,
            year: activeYear,
          })}
        />
        <StatTile
          label={t('dashboard.summary.endOfYearBalance')}
          value={formatCurrency(currentBalance)}
          valueClassName={balanceColor(currentBalance)}
          title={t('dashboard.summary.balanceTitle', { title: latest.title })}
        />
      </div>

      {/* ── Row 2: investing ────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatTile
          label={t('dashboard.summary.overallInvested')}
          value={formatCurrency(invested)}
          valueClassName="text-teal-600 dark:text-teal-400"
          title={t('dashboard.summary.overallInvestedTitle', {
            year: activeYear,
          })}
        />
        <StatTile
          label={t('dashboard.summary.avgMonthlyInvesting')}
          value={formatCurrency(avgInvested)}
          title={t('dashboard.summary.avgInvestingTitle', {
            count: entries.length,
            year: activeYear,
          })}
        />
        <StatTile
          label={t('dashboard.summary.investingRate')}
          value={investingRate === null ? '—' : `${investingRate.toFixed(1)} %`}
          valueClassName={
            investingRate === null
              ? undefined
              : 'text-teal-600 dark:text-teal-400'
          }
          title={t('dashboard.summary.investingRateTitle')}
        />
      </div>

      {/* ── Category spending popup ─────────────── */}
      {showCategorySpending && (
        <Suspense fallback={null}>
          <CategorySpendingModal
            year={activeYear}
            onClose={() => setShowCategorySpending(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
