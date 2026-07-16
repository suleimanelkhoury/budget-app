/**
 * DifferenceBadge — shows a difference value with color coding.
 *
 * Green if positive (under budget / earned more), red if negative
 * (over budget / earned less), gray if zero.
 */

import { formatCurrency } from '../utils/format';

interface DifferenceBadgeProps {
  /** The difference value as a string (e.g. "50.00" or "-30.00"). */
  value: string;
  /** Whether to show a + sign for positive values. */
  showSign?: boolean;
}

export function DifferenceBadge({
  value,
  showSign = true,
}: DifferenceBadgeProps) {
  const num = parseFloat(value);
  const isPositive = num > 0;
  const isNegative = num < 0;

  const className = isPositive
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : isNegative
      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {showSign && isPositive ? '+' : ''}{formatCurrency(value)}
    </span>
  );
}
