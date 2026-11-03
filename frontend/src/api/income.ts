/**
 * Income API service — add, update, and delete income entries.
 */

import { api } from './client';
import type { Income, IncomeCreate, IncomeUpdate } from '../types';

export const incomeApi = {
  /** Add an income entry to a budget. */
  create: async (budgetId: number, data: IncomeCreate): Promise<Income> => {
    const response = await api.post<Income>(
      `/budgets/${budgetId}/income`,
      data,
    );
    return response.data;
  },

  /** Update an income entry. */
  update: async (id: number, data: IncomeUpdate): Promise<Income> => {
    const response = await api.put<Income>(`/income/${id}`, data);
    return response.data;
  },

  /** Delete an income entry. */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/income/${id}`);
  },
};
