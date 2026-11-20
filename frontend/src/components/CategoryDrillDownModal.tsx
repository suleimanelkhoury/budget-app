/**
 * CategoryDrillDownModal — items of one category plus its 12-month
 * SOLL/IST trend. Opened by clicking a category bar/slice on the
 * Charts page's Monthly tab.
 *
 * Fetches the budget detail (cached, shared with the budget detail
 * page) and the category trend itself.
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { budgetsApi } from '../api';
import { Modal } from './Modal';
import { Spinner } from './Spinner';
import { balanceColor } from '../utils/balance';
import { formatCurrency, formatMonthShort, toNumber } from '../utils/format';
import { CHART_TOOLTIP_STYLE, SERIES_COLORS } from '../utils/chartTheme';
import { queryKeys } from '../utils/queryKeys';

interface CategoryDrillDownModalProps {
  budgetId: number;
  categoryName: string;
  onClose: () => void;
}

export function CategoryDrillDownModal({
  budgetId,
  categoryName,
  onClose,
}: CategoryDrillDownModalProps) {
  const { t } = useTranslation();

  // Detail (categories + items) — cached under the same key the budget
  // detail page uses.
  const { data: detail } = useQuery({
    queryKey: queryKeys.budget.detail(budgetId),
    queryFn: () => budgetsApi.get(budgetId),
    enabled: !!budgetId,
  });

  const category = detail?.categories.find((c) => c.name === categoryName);

  // ── Category trend (last 12 months) ─────────
  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: queryKeys.budget.categoryTrend(categoryName),
    queryFn: () => budgetsApi.getCategoryTrend(categoryName),
  });

  const trendSeries =
    trendData?.months.map((m) => ({
      name:
        m.month && m.year
          ? formatMonthShort(m.month, m.year)
          : m.label,
      projected: toNumber(m.projected),
      actual: toNumber(m.actual),
    })) ?? [];

  return (
    <Modal
      title={t('detail.drillDown.title', { name: categoryName })}
      onClose={onClose}
      widthClassName="max-w-2xl"
    >
      {!category ? (
        <p className="text-sm text-gray-500 dark:text-gray-500">
          {t('detail.drillDown.loading')}
        </p>
      ) : category.items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-500">
          {t('detail.drillDown.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="py-2 pr-4 font-medium">{t('detail.drillDown.item')}</th>
                <th className="py-2 font-medium text-right">SOLL</th>
                <th className="py-2 font-medium text-right">IST</th>
                <th className="py-2 font-medium text-right">{t('detail.drillDown.difference')}</th>
              </tr>
            </thead>
            <tbody>
              {category.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">
                    {item.label}
                  </td>
                  <td className="py-2 text-right text-gray-700 dark:text-gray-300">
                    {formatCurrency(item.projected_cost)}
                  </td>
                  <td className="py-2 text-right text-gray-700 dark:text-gray-300">
                    {formatCurrency(item.actual_cost)}
                  </td>
                  <td
                    className={`py-2 text-right font-medium ${balanceColor(toNumber(item.difference))}`}
                  >
                    {formatCurrency(item.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 12-month trend for this category ── */}
      <div className="mt-5">
        <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('detail.drillDown.trendHeading')}
        </h4>
        {trendLoading ? (
          <Spinner />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendSeries} margin={{ left: 8, right: 24 }}>
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={CHART_TOOLTIP_STYLE}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="projected"
                name="SOLL"
                stroke={SERIES_COLORS.Projected}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="IST"
                stroke={SERIES_COLORS.Actual}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Modal>
  );
}
