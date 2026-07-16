/**
 * Templates API service — CRUD for reusable budget templates,
 * and creating a budget from a template.
 */

import api from './client';
import type {
  Budget,
  BudgetTemplate,
  BudgetTemplateCreate,
  BudgetTemplateUpdate,
  CreateBudgetFromTemplate,
} from '../types';

export const templatesApi = {
  /** List all templates for the logged-in user. */
  list: async (): Promise<BudgetTemplate[]> => {
    const response = await api.get<BudgetTemplate[]>('/templates/');
    return response.data;
  },

  /** Get a single template with its categories and items. */
  get: async (id: number): Promise<BudgetTemplate> => {
    const response = await api.get<BudgetTemplate>(`/templates/${id}`);
    return response.data;
  },

  /** Create a new budget template with categories and items. */
  create: async (data: BudgetTemplateCreate): Promise<BudgetTemplate> => {
    const response = await api.post<BudgetTemplate>('/templates/', data);
    return response.data;
  },

  /** Update a template's name. */
  update: async (
    id: number,
    data: BudgetTemplateUpdate,
  ): Promise<BudgetTemplate> => {
    const response = await api.put<BudgetTemplate>(`/templates/${id}`, data);
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
