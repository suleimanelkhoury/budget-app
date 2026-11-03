/**
 * Comparison Page — multi-month comparison view.
 *
 * Shows trends across all of the user's budgets:
 * - Line chart: actual income vs. actual expenses over time
 * - Line chart: actual balance over time
 * - A table with per-month totals
 *
 * Data comes from GET /api/budgets/compare, which returns totals for
 * every budget belonging to the user, sorted chronologically.
 */

import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { budgetsApi } from '../api';
import { ChartContainer } from '../components/ChartContainer';
import { formatCurrency, formatMonthYear } from '../utils/format';

export function ComparisonPage() {
  const { data: comparison, isLoading } = useQuery({
    queryKey: ['budget-comparison'],
    queryFn: budgetsApi.compare,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400" />
      </div>
    );
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

  // Shape data for Recharts: one row per budget, labeled "Mon YYYY"
  const chartData = entries.map((e) => ({
    label: formatMonthYear(e.month, e.year),
    gehalt: parseFloat(e.total_actual_gehalt),
    expenses: parseFloat(e.total_actual_expenses),
    balance: parseFloat(e.actual_balance),
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Multi-Month Comparison
      </h1>

      <div className="grid grid-cols-1 gap-6">
        {/* ── Gehalt vs Expenses over time ─────── */}
        <ChartContainer title="Gehalt vs Expenses (IST)">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="gehalt"
                name="Gehalt"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* ── Balance over time ────────────────── */}
        <ChartContainer title="Balance Over Time (IST)">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="balance"
                name="IST Balance"
                stroke="#14b8a6"
                strokeWidth={2}
                dot={{ r: 4 }}
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
                const balanceColor =
                  balance >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400';
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
                      className={`px-5 py-3 text-right text-sm font-semibold ${balanceColor}`}
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
    </div>
  );
}
