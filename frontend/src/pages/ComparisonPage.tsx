/**
 * Comparison Page — multi-month and yearly comparison views.
 *
 * Two tabs:
 *  - Multi-Month: line charts and a table of per-month totals.
 *  - Yearly: aggregates all budgets by calendar year, with a bar chart of
 *    per-category actual spending (e.g. how much invested, how much for
 *    Wohnen) and a summary table.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { budgetsApi } from '../api';
import { ChartContainer } from '../components/ChartContainer';
import { Spinner } from '../components/Spinner';
import { YearlyComparisonView } from '../components/YearlyComparisonView';
import { formatCurrency, formatMonthYear } from '../utils/format';
import { balanceColor } from '../utils/balance';
import { CHART_TOOLTIP_STYLE, SERIES_COLORS } from '../utils/chartTheme';
import { queryKeys } from '../utils/queryKeys';

type Tab = 'monthly' | 'yearly';

export function ComparisonPage() {
  const [tab, setTab] = useState<Tab>('monthly');
  const { data: comparison, isLoading } = useQuery({
    queryKey: queryKeys.comparison,
    queryFn: budgetsApi.compare,
  });

  if (isLoading) {
    return <Spinner />;
  }

  const entries = comparison?.budgets ?? [];

  if (entries.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
          Comparison
        </h1>
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-500">
            No budgets available. Create at least one budget to see a
            comparison.
          </p>
        </div>
      </div>
    );
  }

  const tabButton = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-indigo-600 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
    }`;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Comparison
      </h1>

      {/* ── Tabs ──────────────────────────────── */}
      <div className="mb-6 flex gap-2">
        <button className={tabButton(tab === 'monthly')} onClick={() => setTab('monthly')}>
          Multi-Month
        </button>
        <button className={tabButton(tab === 'yearly')} onClick={() => setTab('yearly')}>
          Yearly
        </button>
      </div>

      {tab === 'monthly' ? (
        <MonthlyView entries={entries} />
      ) : (
        <YearlyComparisonView />
      )}    </div>
  );
}

/** Multi-month view — line charts and per-month table. */
function MonthlyView({ entries }: { entries: ComparisonEntry[] }) {
  // Shape data for Recharts: one row per budget, labeled "Mon YYYY".
  // Income is the total (Gehalt + Extra) — Extra often contains the
  // previous month's carryover plus additional income, so showing only
  // Gehalt would understate income in months with big carryovers.
  const chartData = entries.map((e) => ({
    label: formatMonthYear(e.month, e.year),
    income:
      parseFloat(e.total_actual_gehalt) + parseFloat(e.total_actual_extra),
    expenses: parseFloat(e.total_actual_expenses),
    plannedExpenses: parseFloat(e.total_projected_expenses),
    balance: parseFloat(e.actual_balance),
    plannedBalance: parseFloat(e.projected_balance),
  }));

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* ── Income vs Expenses over time ─────── */}
      <ChartContainer title="Income vs Expenses (IST, plan dashed)">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={CHART_TOOLTIP_STYLE}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="income"
              name="Income (Gehalt + Extra)"
              stroke={SERIES_COLORS.Income}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              name="Expenses (actual)"
              stroke={SERIES_COLORS.Expenses}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="plannedExpenses"
              name="Expenses (plan)"
              stroke={SERIES_COLORS.Plan}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* ── Balance over time ────────────────── */}
      {/* Note: with the carryover model (each month's balance becomes
          next month's SOLL Extra), the balance IS the cumulative cash
          pile — this line already is the savings trajectory. The
          dashed plan line shows how the SOLL forecast tracked it. */}
      <ChartContainer title="Cash Balance Over Time (savings trajectory, plan dashed)">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={CHART_TOOLTIP_STYLE}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="balance"
              name="Balance (actual)"
              stroke={SERIES_COLORS.Balance}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="plannedBalance"
              name="Balance (plan)"
              stroke={SERIES_COLORS.Plan}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* ── Per-month table ──────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-500">
              <th className="px-5 py-3">Month</th>
              <th className="px-5 py-3 text-right">Gehalt</th>
              <th className="px-5 py-3 text-right">Extra</th>
              <th className="px-5 py-3 text-right">Expenses</th>
              <th className="px-5 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const balance = parseFloat(e.actual_balance);
              return (
                <tr
                  key={e.budget_id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-700"
                >
                  <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatMonthYear(e.month, e.year)}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                    {formatCurrency(e.total_actual_gehalt)}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                    {formatCurrency(e.total_actual_extra)}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                    {formatCurrency(e.total_actual_expenses)}
                  </td>
                  <td
                    className={`px-5 py-3 text-right text-sm font-semibold ${balanceColor(balance)}`}
                  >
                    {formatCurrency(e.actual_balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ComparisonEntry = {
  budget_id: number;
  month: number;
  year: number;
  total_actual_gehalt: string;
  total_actual_extra: string;
  total_projected_expenses: string;
  total_actual_expenses: string;
  projected_balance: string;
  actual_balance: string;
};
