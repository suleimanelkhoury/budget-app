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
import { Modal } from './Modal';
import { parseExcelPreview } from '../utils/excelPreview';
import type { ParsedPreview } from '../utils/excelPreview';
import type { ApiError, ExcelImportResponse } from '../types';

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

      const parsed = parseExcelPreview(rows, budgetSheet);
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
    <Modal
      title="Import Budget from Excel"
      onClose={handleClose}
      widthClassName="max-w-2xl"
    >
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
              className="mb-4 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center hover:border-brand-400 dark:border-gray-700 dark:hover:border-brand-500"
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
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {isUploading ? 'Uploading…' : 'Confirm Import'}
              </button>
            </div>
          </>
        )}
    </Modal>
  );
}
