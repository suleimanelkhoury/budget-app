/**
 * Templates API service — CRUD for reusable budget templates,
 * and creating a budget from a template.
 */

import { api } from './client';
import type {
  Budget,
  BudgetTemplate,
  BudgetTemplateCreate,
  CreateBudgetFromTemplate,
} from '../types';

export const templatesApi = {
  /** List all templates for the logged-in user. */
  list: async (): Promise<BudgetTemplate[]> => {
    const response = await api.get<BudgetTemplate[]>('/templates/');
    return response.data;
  },

  /** Create a new budget template with categories and items. */
  create: async (data: BudgetTemplateCreate): Promise<BudgetTemplate> => {
    const response = await api.post<BudgetTemplate>('/templates/', data);
    return response.data;
  },

  /** Delete a template and all its categories and items. */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/templates/${id}`);
  },

  /** Create a new budget pre-filled from a template. */
  createBudgetFromTemplate: async (
    id: number,
    data: CreateBudgetFromTemplate,
  ): Promise<Budget> => {
    const response = await api.post<Budget>(`/templates/${id}/create-budget`, data);
    return response.data;
  },
};
