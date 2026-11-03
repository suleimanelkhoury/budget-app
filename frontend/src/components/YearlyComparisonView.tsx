/**
 * YearlyComparisonView — aggregates budgets by year.
 *
 * Shows for the selected year:
 *  - Summary stats (income, gehalt, extra, expenses, balance, invested)
 *  - A bar chart of actual (IST) spending per category (e.g. how much was
 *    invested in 2025, how much was spent on Wohnen)
 *  - A per-year table of category totals
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { budgetsApi } from '../api';
import { ChartContainer } from './ChartContainer';
import { formatCurrency } from '../utils/format';
import type { YearlyComparisonEntry } from '../types';

const STAT_COLORS = {
  Gehalt: '#10b981',
  Extra: '#f59e0b',
  Expenses: '#ef4444',
  Balance: '#14b8a6',
  Invested: '#6366f1',
};

export function YearlyComparisonView() {
  const { data, isLoading } = useQuery({
    queryKey: ['budget-comparison-yearly'],
    queryFn: budgetsApi.compareYearly,
  });

  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400" />
      </div>
    );
  }

  const years = data?.years ?? [];
  if (years.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-500 dark:text-gray-500">
          No budgets available. Create at least one budget to see a yearly
          comparison.
        </p>
      </div>
    );
  }

  // Default to the most recent year
  const activeYear = selectedYear ?? years[years.length - 1].year;
  const active = years.find((y) => y.year === activeYear) as YearlyComparisonEntry;

  // Bar chart data: one row per category, sorted by total descending
  const chartData = [...active.categories]
    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
    .map((c) => ({
      Category: c.name,
      Spent: parseFloat(c.total),
    }));

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* ── Year selector ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          Year:
        </span>
        {years.map((y) => (
          <button
            key={y.year}
            onClick={() => setSelectedYear(y.year)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              y.year === activeYear
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {y.year}
          </button>
        ))}
      </div>

      {/* ── Summary stats ─────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Income" value={active.total_income} color={STAT_COLORS.Gehalt} />
        <StatCard label="Gehalt" value={active.total_gehalt} color={STAT_COLORS.Gehalt} />
        <StatCard label="Extra" value={active.total_extra} color={STAT_COLORS.Extra} />
        <StatCard label="Expenses" value={active.total_expenses} color={STAT_COLORS.Expenses} />
        <StatCard label="Balance" value={active.total_balance} color={STAT_COLORS.Balance} />
        <StatCard label="Invested" value={active.invested} color={STAT_COLORS.Invested} />
      </div>

      {/* ── Category bar chart ────────────────── */}
      <ChartContainer title={`Category Spending ${activeYear} (IST)`}>
        {chartData.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500 dark:text-gray-500">
            No expense categories recorded for this year.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="Category" fontSize={12} tick={{ fontSize: 11 }} />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                }}
              />
              <Bar dataKey="Spent" name="Spent" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartContainer>

      {/* ── Per-category table ────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-500">
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3 text-right">Total (IST)</th>
            </tr>
          </thead>
          <tbody>
            {[...active.categories]
              .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
              .map((c) => (
                <tr
                  key={c.name}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-700"
                >
                  <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {c.name}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                    {formatCurrency(c.total)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Small stat card showing a formatted amount. */
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs text-gray-500 dark:text-gray-500">{label}</p>
      <p className="text-sm font-semibold" style={{ color }}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}
