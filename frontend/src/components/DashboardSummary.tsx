/**
 * DashboardSummary — stat strips above the budget grid.
 *
 * Row 1: year-to-date money-flow overview. "Expenses" tiles show
 * consumption only (investments excluded — see the Investing row).
 *
 * Row 2: investing — total invested YTD, monthly average, and the
 * investing rate (share of new income that went into investments).
 *
 * Note on the money model: each month's remaining balance is carried
 * into the next month as its SOLL Extra, so monthly balances and Extra
 * income must NOT be summed across months (the same money would be
 * counted repeatedly). Instead:
 *
 *   - YTD Income       = YTD expenses + current balance − January
 *                        carryover (new money in = money out + pile
 *                        growth; "expenses" includes investing)
 *   - Current Balance  = the latest month's IST balance
 *
 * Renders nothing while loading or when no budgets exist for the
 * current year.
 */

import { useQuery } from '@tanstack/react-query';
import { budgetsApi } from '../api';
import { balanceColor } from '../utils/balance';
import { formatCurrency } from '../utils/format';
import { queryKeys } from '../utils/queryKeys';
import type { BudgetComparisonEntry } from '../types';

interface StatTileProps {
  label: string;
  value: string;
  valueClassName?: string;
  title?: string;
}

function StatTile({ label, value, valueClassName, title }: StatTileProps) {
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
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
  const year = new Date().getFullYear();
  const { data: comparison, isLoading: comparisonLoading } = useQuery({
    queryKey: queryKeys.comparison,
    queryFn: budgetsApi.compare,
  });
  const { data: yearly, isLoading: yearlyLoading } = useQuery({
    queryKey: queryKeys.yearlyComparison,
    queryFn: budgetsApi.compareYearly,
  });

  if (comparisonLoading || yearlyLoading) return null;

  // Entries are sorted by (year, month) ascending — filter to this year
  // and keep that order.
  const entries: BudgetComparisonEntry[] =
    comparison?.budgets.filter((b) => b.year === year) ?? [];
  if (entries.length === 0) return null;

  const toNumber = (value: string) => parseFloat(value);

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
  const currentYearEntry = yearly?.years.find((y) => y.year === year);
  const invested = currentYearEntry ? toNumber(currentYearEntry.invested) : 0;
  const avgInvested = invested / entries.length;
  // Share of new income that went into investments. On average this is
  // the same per month, so one rate covers both views.
  const investingRate = ytdIncome > 0 ? (invested / ytdIncome) * 100 : null;

  // ── Consumption (investments excluded) ──────
  const ytdConsumption = ytdExpenses - invested;
  const avgConsumption = ytdConsumption / entries.length;

  return (
    <div className="mb-6">
      {/* ── Row 1: money-flow overview ──────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="YTD Income"
          value={formatCurrency(ytdIncome)}
          title={`New money this year, carryover excluded:\nYTD expenses + current balance − January carryover (${formatCurrency(startCarryover)})`}
        />
        <StatTile
          label="YTD Expenses (w/o investing)"
          value={formatCurrency(ytdConsumption)}
          title={`Consumption only — excludes ${formatCurrency(
            invested,
          )} transferred into investments (see the Investing row)`}
        />
        <StatTile
          label="Avg. Monthly Expenses (w/o investing)"
          value={formatCurrency(avgConsumption)}
          title={`Average consumption across ${entries.length} budget${
            entries.length === 1 ? '' : 's'
          } in ${year} — investments excluded`}
        />
        <StatTile
          label="Current Balance"
          value={formatCurrency(currentBalance)}
          valueClassName={balanceColor(currentBalance)}
          title={`Remaining cash as of ${latest.title}`}
        />
      </div>

      {/* ── Row 2: investing ────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatTile
          label="YTD Invested"
          value={formatCurrency(invested)}
          valueClassName="text-emerald-600 dark:text-emerald-400"
          title={`Total transferred into investments (Investitionen category) in ${year}`}
        />
        <StatTile
          label="Avg. Monthly Investing"
          value={formatCurrency(avgInvested)}
          title={`Average across ${entries.length} budget${
            entries.length === 1 ? '' : 's'
          } in ${year}`}
        />
        <StatTile
          label="Investing Rate"
          value={investingRate === null ? '—' : `${investingRate.toFixed(1)} %`}
          valueClassName={
            investingRate === null ? undefined : 'text-emerald-600 dark:text-emerald-400'
          }
          title={`Invested ÷ YTD income (new money, carryover excluded). On average the same for every month.`}
        />
      </div>
    </div>
  );
}
