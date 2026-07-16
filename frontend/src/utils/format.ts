/**
 * Formatting utilities — currency and date formatting with German locale.
 *
 * German number format: 1.234,56 €
 * German date format: "Juli 2026", "14. Juli 2026"
 */

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
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0,00 €';

  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a number with German number formatting (no currency symbol).
 *
 * @example
 * formatNumber(1234.56)  // "1.234,56"
 */
export function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0,00';

  return new Intl.NumberFormat('de-DE', {
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

/**
 * Format a difference value with a + sign for positive numbers.
 *
 * @example
 * formatDifference("50.00")   // "+50,00 €"
 * formatDifference("-30.00")  // "-30,00 €"
 */
export function formatDifference(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  const formatted = formatCurrency(num);
  return num > 0 ? `+${formatted}` : formatted;
}
