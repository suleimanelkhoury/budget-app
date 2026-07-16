/**
 * Export utilities — export budget data to Excel.
 *
 * Uses SheetJS (xlsx) to generate an .xlsx file that mirrors the
 * budget structure: income rows, category headers, and expense items
 * with SOLL (projected) and IST (actual) columns.
 */

import * as XLSX from 'xlsx';
import type { BudgetDetail } from '../types';

/**
 * Export a budget to an Excel file.
 *
 * @param budget The budget detail data to export.
 */
export function exportBudgetToExcel(budget: BudgetDetail): void {
  const rows: (string | number)[][] = [];

  // Header row
  rows.push(['Label', 'SOLL', 'IST']);

  // Income entries
  for (const income of budget.incomes) {
    rows.push([
      income.label,
      parseFloat(income.projected_amount),
      parseFloat(income.actual_amount),
    ]);
  }

  // Categories with items
  for (const category of budget.categories) {
    rows.push([category.name, '', '']);
    for (const item of category.items) {
      rows.push([
        item.label,
        parseFloat(item.projected_cost),
        parseFloat(item.actual_cost),
      ]);
    }
  }

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, budget.title);

  // Download the file
  XLSX.writeFile(wb, `${budget.title}.xlsx`);
}

/**
 * Open the browser's print dialog for the current page.
 * This effectively creates a PDF via the browser's "Save as PDF" option.
 */
export function printBudget(): void {
  window.print();
}
