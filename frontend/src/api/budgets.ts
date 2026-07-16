/**
 * Budget API service — CRUD, summary, category-summary, chart-data, and import.
 */

import api from './client';
import type {
  Budget,
  BudgetClone,
  BudgetComparison,
  BudgetCreate,
  BudgetDetail,
  BudgetSummary,
  BudgetUpdate,
  CategorySummary,
  ChartData,
  ExcelImportResponse,
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

  /** Update a budget's title, month, or year. */
  update: async (id: number, data: BudgetUpdate): Promise<Budget> => {
    const response = await api.put<Budget>(`/budgets/${id}`, data);
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

  /** Get per-category subtotals (Zwischensumme). */
  getCategorySummary: async (id: number): Promise<CategorySummary> => {
    const response = await api.get<CategorySummary>(
      `/budgets/${id}/category-summary`,
    );
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

  /** Clone a budget for a new month (recurring expense templates). */
  clone: async (
    id: number,
    data: BudgetClone,
  ): Promise<Budget> => {
    const response = await api.post<Budget>(`/budgets/${id}/clone`, data);
    return response.data;
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
