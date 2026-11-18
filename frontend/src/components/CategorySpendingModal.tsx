/**
 * CategorySpendingModal — per-year category spending breakdown.
 *
 * Shows the year's actual (IST) spending per category as a horizontal
 * bar chart (categories sorted by amount, all labels visible) and a
 * matching table. Replaces the old yearly comparison tab; data comes
 * from the compare-yearly endpoint (cached, shared with the dashboard
 * summary).
 */

import { useEffect } from 'react';
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
import { formatCurrency } from '../utils/format';
import { CHART_TOOLTIP_STYLE, SERIES_COLORS } from '../utils/chartTheme';
import { queryKeys } from '../utils/queryKeys';

interface CategorySpendingModalProps {
  year: number;
  onClose: () => void;
}

export function CategorySpendingModal({
  year,
  onClose,
}: CategorySpendingModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.yearlyComparison,
    queryFn: budgetsApi.compareYearly,
  });

  // Close with the Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const active = data?.years.find((y) => y.year === year);

  // Sorted by amount descending; horizontal layout keeps all category
  // labels visible and unambiguous.
  const chartData = [...(active?.categories ?? [])]
    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
    .map((c) => ({
      Category: c.name,
      Spent: parseFloat(c.total),
    }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Category Spending {year} (IST)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close category spending"
          >
            ✕
          </button>
        </div>

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
                  cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                />
                <Bar
                  dataKey="Spent"
                  name="Spent"
                  fill={SERIES_COLORS.Invested}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* ── Per-category table ──────────────── */}
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-500">
                  <th className="py-2">Category</th>
                  <th className="py-2 text-right">Total (IST)</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
