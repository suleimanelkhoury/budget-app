/**
 * Charts Page — visualizations using Recharts.
 *
 * Shows:
 * - Bar chart: expenses by category (projected vs. actual)
 * - Pie chart: expense distribution (actual)
 * - Budget selector to choose which budget to visualize
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { budgetsApi } from '../api';
import { ChartContainer } from '../components/ChartContainer';
import { formatCurrency } from '../utils/format';

const PIE_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#3b82f6',
  '#a855f7',
  '#22c55e',
  '#eab308',
];

export function ChartsPage() {
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(null);

  const { data: budgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: budgetsApi.list,
  });

  // Auto-select the latest budget (list is sorted chronologically ascending,
  // so the most recent budget is the last entry)
  const budgetId =
    selectedBudgetId ?? budgets?.[budgets.length - 1]?.id ?? null;

  const { data: chartData, isLoading } = useQuery({
    queryKey: ['chart-data', budgetId],
    queryFn: () => budgetsApi.getChartData(budgetId!),
    enabled: !!budgetId,
  });

  // Prepare data for pie chart (actual expenses by category)
  const pieData =
    chartData?.expenses_by_category.map((c) => ({
      name: c.label,
      value: parseFloat(c.actual),
    })) ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Charts
      </h1>

      {/* ── Budget selector ───────────────────── */}
      {budgets && budgets.length > 0 && (
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Select Budget
          </label>
          <select
            value={budgetId ?? ''}
            onChange={(e) => setSelectedBudgetId(parseInt(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {budgets && budgets.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-500">
            No budgets available. Create a budget first to see charts.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400" />
        </div>
      )}

      {chartData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ── Bar chart: expenses by category ─── */}
          <ChartContainer title="Expenses by Category (SOLL vs IST)">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData.expenses_by_category}>
                <XAxis
                  dataKey="label"
                  angle={-20}
                  textAnchor="end"
                  height={70}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="projected"
                  name="SOLL"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="actual"
                  name="IST"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* ── Pie chart: expense distribution ─── */}
          <ChartContainer title="Expense Distribution (IST)">
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={(entry) => `${entry.name}: ${entry.value}€`}
                  fontSize={11}
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* ── Income vs Expenses summary ──────── */}
          <ChartContainer title="Income vs Expenses" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-lg bg-indigo-50 p-4 dark:bg-indigo-900/30">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Projected Balance (SOLL)
                </p>
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                  {formatCurrency(chartData.income_vs_expenses.projected)}
                </p>
              </div>
              <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/30">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Actual Balance (IST)
                </p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(chartData.income_vs_expenses.actual)}
                </p>
              </div>
            </div>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
