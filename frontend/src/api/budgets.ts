/**
 * Budget API service — CRUD, summary, chart-data, comparison, and import.
 */

import { api } from './client';
import type {
  Budget,
  BudgetClone,
  BudgetComparison,
  BudgetCreate,
  BudgetDetail,
  BudgetSummary,
  ChartData,
  ExcelImportResponse,
  YearlyComparison,
} from '../types';

export const budgetsApi = {
  /** List all budgets for the logged-in user. */
  list: async (): Promise<Budget[]> => {
    const response = await api.get<Budget[]>('/budgets/');
    return response.data;
  },

  /** Create a new monthly budget. */
  create: async (data: BudgetCreate): Promise<Budget> => {
    const response = await api.post<Budget>('/budgets/', data);
    return response.data;
  },

  /** Get a budget with all categories, items, and income. */
  get: async (id: number): Promise<BudgetDetail> => {
    const response = await api.get<BudgetDetail>(`/budgets/${id}`);
    return response.data;
  },

  /** Delete a budget and all related data. */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/budgets/${id}`);
  },

  /** Get the grand totals (SOLL/IST/UNTERSCHIED) for a budget. */
  getSummary: async (id: number): Promise<BudgetSummary> => {
    const response = await api.get<BudgetSummary>(`/budgets/${id}/summary`);
    return response.data;
  },

  /** Get data structured for frontend charts. */
  getChartData: async (id: number): Promise<ChartData> => {
    const response = await api.get<ChartData>(`/budgets/${id}/chart-data`);
    return response.data;
  },

  /** Compare all budgets across months (multi-month comparison). */
  compare: async (): Promise<BudgetComparison> => {
    const response = await api.get<BudgetComparison>('/budgets/compare');
    return response.data;
  },

  /** Compare all budgets aggregated by year (yearly comparison). */
  compareYearly: async (): Promise<YearlyComparison> => {
    const response = await api.get<YearlyComparison>('/budgets/compare-yearly');
    return response.data;
  },

  /** Clone a budget for a new month (recurring expense templates). */
  clone: async (
    id: number,
    data: BudgetClone,
  ): Promise<Budget> => {
    const response = await api.post<Budget>(`/budgets/${id}/clone`, data);
    return response.data;
  },

  /**
   * Export a budget to an Excel file (same format as the import template).
   *
   * Fetches the binary .xlsx blob with the auth token attached and triggers
   * a browser download of it.
   */
  exportExcel: async (id: number): Promise<void> => {
    const response = await api.get<Blob>(`/budgets/${id}/export`, {
      responseType: 'blob',
    });

    // Extract the filename from the Content-Disposition header if present.
    let filename = `budget-${id}.xlsx`;
    const disposition = response.headers['content-disposition'];
    if (typeof disposition === 'string') {
      const match = /filename="?([^"]+)"?/.exec(disposition);
      if (match?.[1]) filename = match[1];
    }

    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /** Import a budget from an Excel file. */
  importExcel: async (file: File): Promise<ExcelImportResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ExcelImportResponse>(
      '/budgets/import',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};
