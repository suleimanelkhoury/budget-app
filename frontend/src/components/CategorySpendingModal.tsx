/**
 * CategorySpendingModal — per-year category spending breakdown.
 *
 * Shows the year's actual (IST) spending per category as a horizontal
 * bar chart (categories sorted by amount, all labels visible) and a
 * matching table, with an optional year-over-year comparison mode
 * (current year vs. previous year, grouped bars + a Δ column in the
 * table). Data comes from the compare-yearly endpoint, which returns
 * every year in one payload — the comparison needs no extra request.
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { budgetsApi } from '../api';
import { Modal } from './Modal';
import { formatCurrency, toNumber } from '../utils/format';
import { CHART_TOOLTIP_STYLE, SERIES_COLORS } from '../utils/chartTheme';
import { queryKeys } from '../utils/queryKeys';
import { pillButtonClass } from '../utils/ui';

interface CategorySpendingModalProps {
  year: number;
  onClose: () => void;
}

export function CategorySpendingModal({
  year,
  onClose,
}: CategorySpendingModalProps) {
  // Year-over-year comparison is off by default — the plain year view
  // is what the button promises; the toggle is for digging deeper.
  const [compare, setCompare] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.yearlyComparison,
    queryFn: budgetsApi.compareYearly,
  });

  const active = data?.years.find((y) => y.year === year);
  const previous = data?.years.find((y) => y.year === year - 1);

  // Sorted by current-year amount descending; horizontal layout keeps
  // all category labels visible and unambiguous. In comparison mode,
  // categories from either year are included (missing amounts = 0).
  const chartData = [...(active?.categories ?? [])]
    .sort((a, b) => toNumber(b.total) - toNumber(a.total))
    .map((c) => ({
      Category: c.name,
      Spent: toNumber(c.total),
      Prev: 0,
    }));
  if (compare && previous) {
    for (const c of previous.categories) {
      const existing = chartData.find((d) => d.Category === c.name);
      if (existing) {
        existing.Prev = toNumber(c.total);
      } else {
        chartData.push({ Category: c.name, Spent: 0, Prev: toNumber(c.total) });
      }
    }
    // Re-sort by current-year spending so categories that only
    // existed last year sink to the bottom
    chartData.sort((a, b) => b.Spent - a.Spent);
  }

  const delta = (d: { Spent: number; Prev: number }) => d.Spent - d.Prev;

  return (
    <Modal
      title={`Category Spending ${year} (IST)`}
      onClose={onClose}
      widthClassName="max-w-2xl"
    >
      {isLoading || !active ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-500">
          Loading…
        </p>
      ) : chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-500">
          No expense categories recorded for this year.
        </p>
      ) : (
        <>
          {/* ── Single year / YoY toggle ─────────── */}
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              className={pillButtonClass(!compare)}
              onClick={() => setCompare(false)}
            >
              {year} only
            </button>
            <button
              type="button"
              className={pillButtonClass(compare)}
              onClick={() => setCompare(true)}
              disabled={!previous}
              title={
                previous
                  ? `Compare with ${year - 1}`
                  : `No data for ${year - 1} to compare with`
              }
            >
              vs. {year - 1}
            </button>
          </div>

          <ResponsiveContainer
            width="100%"
            height={Math.max(300, chartData.length * 34 + 60)}
          >
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 8, right: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" fontSize={11} />
              <YAxis
                type="category"
                dataKey="Category"
                width={130}
                fontSize={11}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                cursor={{ fill: 'rgba(184, 73, 44, 0.08)' }}
                contentStyle={CHART_TOOLTIP_STYLE}
              />
              {compare && previous ? (
                <>
                  <Legend />
                  <Bar
                    dataKey="Spent"
                    name={`${year} (IST)`}
                    fill={SERIES_COLORS.Projected}
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="Prev"
                    name={`${year - 1} (IST)`}
                    fill={SERIES_COLORS.Plan}
                    radius={[0, 4, 4, 0]}
                  />
                </>
              ) : (
                <Bar
                  dataKey="Spent"
                  name="Spent"
                  fill={SERIES_COLORS.Invested}
                  radius={[0, 4, 4, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>

          {/* ── Per-category table ──────────────── */}
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-500">
                <th className="py-2">Category</th>
                <th className="py-2 text-right">Total (IST)</th>
                {compare && previous && (
                  <th className="py-2 text-right">Δ vs. {year - 1}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {chartData.map((c) => (
                <tr
                  key={c.Category}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                >
                  <td className="py-2 text-gray-900 dark:text-gray-100">
                    {c.Category}
                  </td>
                  <td className="py-2 text-right text-gray-700 dark:text-gray-300">
                    {formatCurrency(c.Spent)}
                  </td>
                  {compare && previous && (
                    <td
                      className={`py-2 text-right font-medium ${
                        delta(c) > 0
                          ? 'text-red-600 dark:text-red-400'
                          : delta(c) < 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-gray-500 dark:text-gray-500'
                      }`}
                    >
                      {delta(c) > 0 ? '+' : ''}
                      {formatCurrency(delta(c))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
