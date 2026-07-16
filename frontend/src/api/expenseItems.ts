/**
 * Expense item API service — add, update, and delete expense items.
 */

import api from './client';
import type {
  ExpenseItem,
  ExpenseItemCreate,
  ExpenseItemUpdate,
} from '../types';

export const expenseItemsApi = {
  /** Add an expense item to a category. */
  create: async (
    categoryId: number,
    data: ExpenseItemCreate,
  ): Promise<ExpenseItem> => {
    const response = await api.post<ExpenseItem>(
      `/categories/${categoryId}/items`,
      data,
    );
    return response.data;
  },

  /** Update an expense item. */
  update: async (id: number, data: ExpenseItemUpdate): Promise<ExpenseItem> => {
    const response = await api.put<ExpenseItem>(`/items/${id}`, data);
    return response.data;
  },

  /** Delete an expense item. */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/items/${id}`);
  },
};
