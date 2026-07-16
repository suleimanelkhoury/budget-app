/**
 * Category API service — add, update, and delete categories.
 */

import api from './client';
import type { Category, CategoryCreate, CategoryUpdate } from '../types';

export const categoriesApi = {
  /** Add a category to a budget. */
  create: async (budgetId: number, data: CategoryCreate): Promise<Category> => {
    const response = await api.post<Category>(
      `/budgets/${budgetId}/categories`,
      data,
    );
    return response.data;
  },

  /** Update a category's name or sort order. */
  update: async (id: number, data: CategoryUpdate): Promise<Category> => {
    const response = await api.put<Category>(`/categories/${id}`, data);
    return response.data;
  },

  /** Delete a category and its items. */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
};
