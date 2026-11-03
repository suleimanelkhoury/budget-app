/**
 * ExcelImportModal — file upload dialog for importing .xlsx budgets.
 *
 * Three-step flow:
 * 1. Select file — file picker accepting .xlsx files
 * 2. Preview — client-side parse showing detected categories, income, and items
 * 3. Upload — sends to POST /api/budgets/import, shows loading state
 *
 * On success, calls onSuccess with the new budget ID.
 * On error, shows the structured validation error message from the API.
 */

import { useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import * as XLSX from 'xlsx';
import { budgetsApi } from '../api';
import type { ApiError, ExcelImportResponse } from '../types';

// Known category names — must match the backend parser
const KNOWN_CATEGORIES = [
  'Wohnen',
  'Transport',
  'Essen',
  'Entertainment',
  'Versicherung',
  'Investitionen',
  'Haustiere',
  'Geschenke',
  'Persönliche Pflege',
  'Personal Care',
  'Legal',
  'Bank Konto',
  'Bank',
  'Steuer',
  'Steuern',
];

const INCOME_LABELS = new Set([
  'Einkommen',
  'Extra',
  'Gehalt',
  'Salary',
  'Nebeneinkunft',
]);

interface ParsedPreview {
  title: string;
  incomes: { label: string; projected: string; actual: string }[];
  categories: {
    name: string;
    items: { label: string; projected: string; actual: string }[];
  }[];
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (budgetId: number) => void;
}

export function ExcelImportModal({
  isOpen,
  onClose,
  onSuccess,
}: ExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      setError('Please select an .xlsx file.');
      return;
    }

    setFile(selected);
    setError('');

    // Parse the file client-side for preview
    try {
      const buf = await selected.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      // Prefer the "BUDGET" sheet over whichever sheet happens to be first.
      // The personal template stores its data on "BUDGET" while a chart sheet
      // may be "DIAGRAMME" — if that one is first, previewing it yields zeros.
      const budgetSheet =
        wb.SheetNames.find((name) =>
          name.toUpperCase().includes('BUDGET'),
        ) ?? wb.SheetNames[0];

      const ws = wb.Sheets[budgetSheet];
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
        header: 1,
        blankrows: false,
      });

      const parsed = parseRows(rows, budgetSheet);
      setPreview(parsed);
    } catch {
      setError('Could not read the Excel file. Please check the format.');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setIsUploading(true);
    setError('');
    try {
      const result: ExcelImportResponse = await budgetsApi.importExcel(file);
      onSuccess(result.budget_id);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<ApiError>;
      const apiMessage = axiosError.response?.data?.error?.message;
      const apiDetail = axiosError.response?.data?.error?.detail;
      setError(
        apiMessage ??
          (typeof apiDetail === 'string' ? apiDetail : null) ??
          'Import failed. Please try again.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Import Budget from Excel
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        )}

        {/* ── Step 1: File picker ─────────────── */}
        {!preview && (
          <>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mb-4 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center hover:border-indigo-400 dark:border-gray-700 dark:hover:border-indigo-500"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {file.name}
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Click to select an Excel file
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    .xlsx format
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleClose}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Preview ─────────────────── */}
        {preview && (
          <>
            <div className="mb-4">
              <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">
                Preview: {preview.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {preview.incomes.length} income entries,{' '}
                {preview.categories.length} categories,{' '}
                {preview.categories.reduce((sum, c) => sum + c.items.length, 0)}{' '}
                expense items
              </p>
            </div>

            {/* Income preview */}
            {preview.incomes.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Income
                </h4>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700">
                  {preview.incomes.map((inc, i) => (
                    <div
                      key={i}
                      className="flex justify-between border-b border-gray-100 px-3 py-2 text-sm last:border-0 dark:border-gray-700"
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        {inc.label}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        SOLL: {inc.projected} € | IST: {inc.actual} €
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Categories preview */}
            {preview.categories.length > 0 && (
              <div className="mb-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Categories
                </h4>
                <div className="space-y-2">
                  {preview.categories.map((cat, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                        {cat.name} ({cat.items.length} items)
                      </div>
                      {cat.items.map((item, j) => (
                        <div
                          key={j}
                          className="flex justify-between px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400"
                        >
                          <span>{item.label}</span>
                          <span>
                            {item.projected} € / {item.actual} €
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setPreview(null);
                  setFile(null);
                }}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Choose different file
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isUploading ? 'Uploading…' : 'Confirm Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Client-side parser for preview ───────────
//
// Mirrors the backend parser (app/services/excel_import.py) so the preview
// reflects what the server will actually import.

// Known category names from the backend — used to detect category header rows.
// Matching is case-insensitive. Item labels (e.g. "Lebensmittel") are NOT here.
const KNOWN_CATEGORY_SET = new Set(
  KNOWN_CATEGORIES.map((name) => name.toLowerCase()),
);

const SUBTOTAL_LABELS = new Set([
  'zwischensumme',
  'gesamt',
  'gesamtkosten',
  'total',
  'summe',
  'subtotal',
  'balance',
  'bilanz',
  'ergebnis',
  'überschuss',
  'defizit',
  'monatliches gsmt.einkommen',
  'monatliches gesamt.einkommen',
  'monatliches gesamteinkommen',
]);

const SUB_HEADER_LABELS = new Set([
  'geschätzte kosten',
  'tatsächl. kosten',
  'tatsächliche kosten',
  'unterschied',
  'estimated cost',
  'actual cost',
  'difference',
]);

const SKIP_LABELS = new Set([
  'label',
  'bezeichnung',
  'name',
  'kategorie',
  'item',
  'soll',
  'ist',
  'beschreibung',
  'posten',
  'soll monatliches einkommen',
  'ist monatliches einkommen',
  'soll balance',
  'ist balance',
  'unterschied',
  'soll gesamtkosten',
  'ist gesamtkosten',
  'gesamtunterschied',
]);

function toDecimal(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value
      .trim()
      .replace(/\./g, '')
      .replace(/,/g, '.')
      .replace(/€/g, '')
      .replace(/EUR/gi, '')
      .trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isCategoryHeader(
  label: string,
  budgetTitle: string,
  row: (string | number)[] = [],
  sollCol = -1,
  istCol = -1,
): boolean {
  const lower = label.trim().toLowerCase();
  if (KNOWN_CATEGORY_SET.has(lower)) return true;
  // Uppercase labels with no numbers are category headers (WOHNEN, TRANSPORT…).
  // (Mirrors the backend's `_row_has_numbers` check — a row with numeric
  // SOLL/IST values is an expense item, not a category header.)
  if (
    label === label.toUpperCase() &&
    label.length <= 40 &&
    /[a-zA-ZäöüÄÖÜ]/.test(label) &&
    label.toUpperCase() !== budgetTitle.toUpperCase() &&
    !/BUDGET/i.test(label)
  ) {
    const hasNumbers =
      (sollCol >= 0 && toDecimal(row[sollCol]) !== 0) ||
      (istCol >= 0 && toDecimal(row[istCol]) !== 0);
    if (!hasNumbers) return true;
  }
  return false;
}

function isSubtotal(label: string): boolean {
  return SUBTOTAL_LABELS.has(label.trim().toLowerCase());
}

function isSubHeader(label: string): boolean {
  return SUB_HEADER_LABELS.has(label.trim().toLowerCase());
}

function isSkipLabel(label: string): boolean {
  const lower = label.trim().toLowerCase();
  if (SKIP_LABELS.has(lower)) return true;
  if (label.length > 60) return true;
  if (label.includes('\n')) return true;
  return false;
}

function isIncomeLabel(label: string): boolean {
  return INCOME_LABELS.has(label.toLowerCase());
}

function parseRows(
  rows: (string | number)[][],
  sheetName: string,
): ParsedPreview {
  const title = sheetName || 'Imported Budget';
  const incomes: ParsedPreview['incomes'] = [];
  const categories: ParsedPreview['categories'] = [];

  // Detect the budget title from the first rows (e.g. "OKTOBER 2025 BUDGET").
  let budgetTitle = '';
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    for (let c = 0; c < Math.min(rows[r].length, 6); c++) {
      const raw = rows[r][c];
      if (typeof raw !== 'string') continue;
      const val = raw.trim();
      if (!val || isSkipLabel(val) || isCategoryHeader(val, '')) continue;
      const hasBudgetWord = /BUDGET/i.test(val) && val.length < 60;
      const hasYear = val
        .split(/\s+/)
        .some((w) => /^\d+$/.test(w) && Number(w) >= 1900 && Number(w) <= 2100);
      if (hasBudgetWord || hasYear) {
        budgetTitle = val;
        break;
      }
    }
    if (budgetTitle) break;
  }

  // Detect column blocks: label/SOLL/IST triples, mirroring the backend.
  //
  // The personal template has two side-by-side blocks. Headers appear as a
  // ("Geschätzte Kosten", "Tatsächl. Kosten") pair; the label column is one to
  // the left of the SOLL column. E.g. rows like ["", "WOHNEN", "Geschätzte
  // Kosten", "Tatsächl. Kosten", "Unterschied", "", "ENTERTAINMENT", ...].
  type Block = [number, number, number];
  const blocks: Block[] = [];
  const scanLimit = Math.min(rows.length, 15);
  for (let r = 0; r < scanLimit; r++) {
    for (let c = 0; c < (rows[r]?.length ?? 0); c++) {
      const val = String(rows[r]?.[c] ?? '').trim().toLowerCase();
      if (
        ['geschätzte kosten', 'estimated cost', 'soll', 'projected'].includes(
          val,
        )
      ) {
        const nextVal = String(rows[r]?.[c + 1] ?? '')
          .trim()
          .toLowerCase();
        if (
          [
            'tatsächl. kosten',
            'tatsächliche kosten',
            'ist',
            'actual',
          ].includes(nextVal)
        ) {
          const labelCol = c - 1;
          if (labelCol >= 0) {
            const existing = blocks.some(
              (b) => b[0] === labelCol && b[1] === c && b[2] === c + 1,
            );
            if (!existing) blocks.push([labelCol, c, c + 1]);
          }
        }
      }
    }
  }
  if (blocks.length === 0) blocks.push([0, 1, 2]);

  // Detect the income layout: label in one column, value a few columns right,
  // split into a SOLL block followed by an IST block. (Template: label col C,
  // value col E, SOLL rows around 4-5 and IST rows around 8-9.)
  interface IncomeLayout {
    labelCol: number;
    valueCol: number;
    sollStart: number;
    istStart: number;
  }
  let incomeLayout: IncomeLayout | null = null;
  const valueCols = new Set(blocks.flatMap((b) => [b[1], b[2]]));
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    for (let c = 0; c < Math.min(rows[r]?.length ?? 0, 6); c++) {
      const val = String(rows[r]?.[c] ?? '').trim().toLowerCase();
      if (val !== 'einkommen') continue;
      for (let vc = c + 2; vc < Math.min(c + 5, rows[r]?.length ?? 0); vc++) {
        const cellVal = rows[r]?.[vc];
        if (typeof cellVal === 'number' && cellVal !== 0) {
          // Find a second "Einkommen" label below in the same column = IST block.
          for (let r2 = r + 1; r2 < Math.min(rows.length, r + 11); r2++) {
            const val2 = String(rows[r2]?.[c] ?? '').trim().toLowerCase();
            if (val2 === 'einkommen') {
              incomeLayout = { labelCol: c, valueCol: vc, sollStart: r, istStart: r2 };
              break;
            }
          }
          if (incomeLayout) break;
        }
      }
      if (incomeLayout) break;
    }
    if (incomeLayout) break;
  }

  // ── Parse income ───────────────────────────
  if (incomeLayout && !valueCols.has(incomeLayout.valueCol)) {
    // Template-style layout with a distinct income value column (label col C,
    // values in col E, SOLL and IST blocks both read from the same value col).
    const { labelCol, valueCol, sollStart, istStart } = incomeLayout;
    const addIncome = (r: number, isSoll: boolean) => {
      const label = String(rows[r]?.[labelCol] ?? '').trim();
      if (!label || isSubtotal(label) || isSkipLabel(label)) return;
      if (!isIncomeLabel(label)) return;
      const amount = String(toDecimal(rows[r]?.[valueCol] ?? '0'));
      let entry = incomes.find((i) => i.label === label);
      if (!entry) {
        entry = { label, projected: '0', actual: '0' };
        incomes.push(entry);
      }
      if (isSoll) entry.projected = amount;
      else entry.actual = amount;
    };
    for (let r = sollStart; r < Math.min(sollStart + 5, rows.length); r++)
      addIncome(r, true);
    for (let r = istStart; r < Math.min(istStart + 5, rows.length); r++)
      addIncome(r, false);
  } else {
    // Fallback: income label/value in the first block's column positions
    // (label in labelCol, SOLL/IST in the block's soll/ist columns).
    incomeLayout = null;
    const labelCol = blocks[0][0];
    const sollCol = blocks[0][1];
    const istCol = blocks[0][2];
    for (const row of rows) {
      const label = String(row[labelCol] ?? '').trim();
      if (!label || isSkipLabel(label) || isSubtotal(label)) continue;
      if (!isIncomeLabel(label)) continue;
      if (!incomes.some((i) => i.label === label)) {
        incomes.push({
          label,
          projected: String(toDecimal(row[sollCol] ?? '0')),
          actual: String(toDecimal(row[istCol] ?? '0')),
        });
      }
    }
  }

  // ── Parse categories and items ─────────────
  for (const [labelCol, sollCol, istCol] of blocks) {
    let currentCat: ParsedPreview['categories'][number] | null = null;
    for (const row of rows) {
      const label = String(row[labelCol] ?? '').trim();
      if (!label) continue;
      if (isSkipLabel(label)) continue;
      if (isSubtotal(label)) continue;
      if (isSubHeader(label)) continue;
      if (isIncomeLabel(label)) continue;

      // Category header?
      if (isCategoryHeader(label, budgetTitle, row, sollCol, istCol)) {
        let existing = categories.find(
          (cat) => cat.name.toLowerCase() === label.toLowerCase(),
        );
        if (!existing) {
          existing = { name: label, items: [] };
          categories.push(existing);
        }
        currentCat = existing;
        continue;
      }

      // Expense item under the current category.
      if (currentCat) {
        const projected = toDecimal(row[sollCol] ?? '0');
        const actual = toDecimal(row[istCol] ?? '0');
        if (projected !== 0 || actual !== 0) {
          currentCat.items.push({ label, projected: String(projected), actual: String(actual) });
        }
      }
    }
  }

  return { title, incomes, categories };
}
