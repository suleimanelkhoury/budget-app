/**
 * Charts Page — visualizations using Recharts.
 *
 * Two tabs:
 * - Overall: income vs. expenses and the cash balance (savings
 *   trajectory) over time, with the SOLL plan as dashed lines
 *   (moved here from the former Comparison page).
 * - Monthly: single-budget charts — expenses by category (SOLL vs
 *   IST) and the expense distribution pie, with click-to-drill-down
 *   into a category's items and its 12-month trend.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { budgetsApi } from '../api';
import { CategoryDrillDownModal } from '../components/CategoryDrillDownModal';
import { ChartContainer } from '../components/ChartContainer';
import { Spinner } from '../components/Spinner';
import { formatCurrency, formatMonthYear, toNumber } from '../utils/format';
import { pillButtonClass } from '../utils/ui';
import { queryKeys } from '../utils/queryKeys';
import {
  CHART_TOOLTIP_STYLE,
  PIE_COLORS,
  SERIES_COLORS,
} from '../utils/chartTheme';

type ChartTab = 'overall' | 'monthly';

export function ChartsPage() {
  const [tab, setTab] = useState<ChartTab>('overall');
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: budgets } = useQuery({
    queryKey: queryKeys.budgets,
    queryFn: budgetsApi.list,
  });

  // Auto-select the latest budget (list is sorted chronologically ascending,
  // so the most recent budget is the last entry)
  const budgetId =
    selectedBudgetId ?? budgets?.[budgets.length - 1]?.id ?? null;

  // ── Overall tab data ─────────────────────────
  const { data: comparison, isLoading: comparisonLoading } = useQuery({
    queryKey: queryKeys.comparison,
    queryFn: budgetsApi.compare,
  });

  const overallData =
    comparison?.budgets.map((e) => ({
      label: formatMonthYear(e.month, e.year),
      // Total income (Gehalt + Extra) — Extra often contains the
      // previous month's carryover, so showing only Gehalt would
      // understate income in months with big carryovers.
      income:
        toNumber(e.total_actual_gehalt) + toNumber(e.total_actual_extra),
      expenses: toNumber(e.total_actual_expenses),
      plannedExpenses: toNumber(e.total_projected_expenses),
      balance: toNumber(e.actual_balance),
      plannedBalance: toNumber(e.projected_balance),
    })) ?? [];

  // Reset the drill-down when a different budget is selected
  useEffect(() => {
    setSelectedCategory(null);
  }, [budgetId]);

  // ── Monthly tab data ─────────────────────────
  const { data: chartData, isLoading } = useQuery({
    queryKey: queryKeys.budget.chartData(budgetId!),
    queryFn: () => budgetsApi.getChartData(budgetId!),
    enabled: tab === 'monthly' && !!budgetId,
  });

  // Prepare data for pie chart (actual expenses by category)
  const pieData =
    chartData?.expenses_by_category.map((c) => ({
      name: c.label,
      value: toNumber(c.actual),
    })) ?? [];

  const selectCategory = (name: string | undefined) => {
    if (!name) return;
    setSelectedCategory((prev) => (prev === name ? null : name));
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Charts
      </h1>

      {/* ── Tabs ──────────────────────────────── */}
      <div className="mb-6 flex gap-2">
        <button
          type="button"
          className={pillButtonClass(tab === 'overall')}
          onClick={() => setTab('overall')}
        >
          Overall
        </button>
        <button
          type="button"
          className={pillButtonClass(tab === 'monthly')}
          onClick={() => setTab('monthly')}
        >
          Monthly
        </button>
      </div>

      {tab === 'overall' ? (
        /* ── Overall tab ─────────────────────── */
        comparisonLoading ? (
          <Spinner />
        ) : overallData.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-500 dark:text-gray-500">
              No budgets available. Create at least one budget to see
              charts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {/* ── Income vs Expenses over time ────── */}
            <ChartContainer title="Income vs Expenses (IST, plan dashed)">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={overallData}>
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
            {/* Note: with the carryover model (each month's balance
                becomes next month's SOLL Extra), the balance IS the
                cumulative cash pile — this line already is the savings
                trajectory. The dashed plan line shows how the SOLL
                forecast tracked it. */}
            <ChartContainer title="Cash Balance Over Time (savings trajectory, plan dashed)">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={overallData}>
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
          </div>
        )
      ) : (
        /* ── Monthly tab ─────────────────────── */
        <>
          {/* ── Budget selector ─────────────────── */}
          {budgets && budgets.length > 0 && (
            <div className="mb-6">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Budget
              </label>
              <select
                value={budgetId ?? ''}
                onChange={(e) =>
                  setSelectedBudgetId(parseInt(e.target.value))
                }
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

          {isLoading && <Spinner />}

          {chartData && (
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-500">
              Tip: click a bar or pie slice to see that category's items.
            </p>
          )}

          {chartData && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* ── Bar chart: expenses by category ─── */}
              {/* Horizontal layout: with ~12 categories, rotated
                  x-axis labels visually shift one bar to the left
                  (Recharts rotation + auto-hidden ticks), making bars
                  appear misattributed. Y-axis category names are
                  always unambiguous. */}
              <ChartContainer title="Expenses by Category (SOLL vs IST)">
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(
                    350,
                    chartData.expenses_by_category.length * 34 + 60,
                  )}
                >
                  <BarChart
                    data={chartData.expenses_by_category}
                    layout="vertical"
                    margin={{ left: 8, right: 24 }}
                  >
                    <XAxis type="number" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={130}
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      contentStyle={CHART_TOOLTIP_STYLE}
                    />
                    <Legend />
                    <Bar
                      dataKey="projected"
                      name="SOLL"
                      fill={SERIES_COLORS.Projected}
                      radius={[0, 4, 4, 0]}
                      onClick={(data) =>
                        selectCategory((data as { label?: string })?.label)
                      }
                      className="cursor-pointer"
                    />
                    <Bar
                      dataKey="actual"
                      name="IST"
                      fill={SERIES_COLORS.Actual}
                      radius={[0, 4, 4, 0]}
                      onClick={(data) =>
                        selectCategory((data as { label?: string })?.label)
                      }
                      className="cursor-pointer"
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
                      onClick={(entry) =>
                        selectCategory((entry as { name?: string })?.name)
                      }
                      className="cursor-pointer"
                    >
                      {pieData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>

              {/* ── Income vs Expenses summary ──────── */}
              <ChartContainer
                title="Income vs Expenses"
                className="lg:col-span-2"
              >
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
        </>
      )}

      {/* ── Category drill-down modal (monthly tab) */}
      {tab === 'monthly' && selectedCategory && budgetId && (
        <CategoryDrillDownModal
          budgetId={budgetId}
          categoryName={selectedCategory}
          onClose={() => setSelectedCategory(null)}
        />
      )}
    </div>
  );
}
