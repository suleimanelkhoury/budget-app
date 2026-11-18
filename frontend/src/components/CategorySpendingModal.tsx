/**
 * CategorySpendingModal — per-year category spending breakdown.
 *
 * Shows the year's actual (IST) spending per category as a horizontal
 * bar chart (categories sorted by amount, all labels visible) and a
 * matching table. Replaces the old yearly comparison tab; data comes
 * from the compare-yearly endpoint (cached, shared with the dashboard
 * summary).
 */

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
import { Modal } from './Modal';
import { formatCurrency, toNumber } from '../utils/format';
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

  const active = data?.years.find((y) => y.year === year);

  // Sorted by amount descending; horizontal layout keeps all category
  // labels visible and unambiguous.
  const chartData = [...(active?.categories ?? [])]
    .sort((a, b) => toNumber(b.total) - toNumber(a.total))
    .map((c) => ({
      Category: c.name,
      Spent: toNumber(c.total),
    }));

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
    </Modal>
  );
}
