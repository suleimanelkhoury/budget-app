/**
 * Formatting utilities — currency and date formatting with German locale.
 *
 * German number format: 1.234,56 €
 * German date format: "Juli 2026", "14. Juli 2026"
 */

/**
 * Parse a backend decimal string ("1234.56") to a number.
 * Returns 0 for NaN so downstream arithmetic never poisons charts.
 *
 * @example
 * toNumber("900.00")   // 900
 * toNumber("n/a")      // 0
 */
export function toNumber(value: string | number): number {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Format a number as a German currency string.
 *
 * @param value - The number or string to format (e.g. 1234.56 or "1234.56")
 * @returns Formatted string like "1.234,56 €"
 *
 * @example
 * formatCurrency(1234.56)    // "1.234,56 €"
 * formatCurrency("900.00")   // "900,00 €"
 * formatCurrency(-50.25)     // "-50,25 €"
 */
export function formatCurrency(value: string | number): string {
  const num = toNumber(value);

  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a month + year as a German date string.
 *
 * @example
 * formatMonthYear(7, 2026)  // "Juli 2026"
 */
export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Format a month + year as a compact German axis label (for charts
 * with many points).
 *
 * @example
 * formatMonthShort(9, 2026)  // "Sep 26"
 */
export function formatMonthShort(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    year: '2-digit',
  }).format(date);
}

/**
 * Format an ISO date string as a German long date.
 *
 * @example
 * formatDate("2026-07-14T10:00:00")  // "14. Juli 2026"
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Format a date as a German short time, e.g. "16:05". */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format an ISO date string as a German date with time.
 *
 * @example
 * formatDateTime("2026-07-14T16:05:00")  // "14. Juli 2026, 16:05"
 */
export function formatDateTime(isoDate: string): string {
  return `${formatDate(isoDate)}, ${formatTime(new Date(isoDate))}`;
}

/**
 * Format an ISO date string relative to now, in English (the UI's
 * language). Falls back to the German long date for anything older
 * than a week.
 *
 * @example
 * formatRelativeTime("2026-11-20T16:04:00")  // "just now" / "5 min ago"
 * formatRelativeTime("2026-11-19T09:00:00")  // "yesterday, 09:00"
 * formatRelativeTime("2026-07-14T10:00:00")  // "14. Juli 2026"
 */
export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h ago`;
  if (diffHours < 48) return `yesterday, ${formatTime(date)}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(isoDate);
}

/**
 * Format a difference value with a + sign for positive numbers.
 *
 * @example
 * formatDifference("50.00")   // "+50,00 €"
 * formatDifference("-30.00")  // "-30,00 €"
 */
export function formatDifference(value: string | number): string {
  const num = toNumber(value);
  const formatted = formatCurrency(num);
  return num > 0 ? `+${formatted}` : formatted;
}
