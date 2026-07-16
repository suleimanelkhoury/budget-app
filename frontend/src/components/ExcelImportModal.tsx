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
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
        header: 1,
        blankrows: false,
      });

      const parsed = parseRows(rows, wb.SheetNames[0]);
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
function parseRows(
  rows: (string | number)[][],
  sheetName: string,
): ParsedPreview {
  const title = sheetName || 'Imported Budget';
  const incomes: ParsedPreview['incomes'] = [];
  const categories: ParsedPreview['categories'] = [];

  // Detect columns (default: 0=label, 1=SOLL, 2=IST)
  let labelCol = 0;
  let sollCol = 1;
  let istCol = 2;

  // Check first few rows for header keywords
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const val = String(rows[r][c] ?? '')
        .toLowerCase()
        .trim();
      if (['soll', 'projected', 'geplant', 'budget'].includes(val)) sollCol = c;
      else if (['ist', 'actual', 'tatsächlich', 'real'].includes(val))
        istCol = c;
      else if (
        ['label', 'bezeichnung', 'name', 'kategorie', 'item'].includes(val)
      )
        labelCol = c;
    }
  }

  let currentCat: ParsedPreview['categories'][number] | null = null;

  for (const row of rows) {
    const label = String(row[labelCol] ?? '').trim();
    if (!label) continue;

    // Skip header rows
    if (
      ['soll', 'ist', 'label', 'bezeichnung', 'name'].includes(
        label.toLowerCase(),
      )
    )
      continue;

    const projected = String(row[sollCol] ?? '0');
    const actual = String(row[istCol] ?? '0');

    // Income row?
    if (INCOME_LABELS.has(label)) {
      incomes.push({ label, projected, actual });
      currentCat = null;
      continue;
    }

    // Category header?
    if (KNOWN_CATEGORIES.includes(label)) {
      currentCat = { name: label, items: [] };
      categories.push(currentCat);
      continue;
    }

    // Expense item?
    if (currentCat) {
      currentCat.items.push({ label, projected, actual });
    }
  }

  return { title, incomes, categories };
}
