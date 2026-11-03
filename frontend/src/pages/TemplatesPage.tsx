/**
 * Templates Page — manage reusable budget templates.
 *
 * A template is a named set of categories and items (no amounts) that can
 * be applied to a new budget to pre-fill its structure. Users can:
 * - Create a template (name + categories with items)
 * - View / delete templates
 * - Create a new budget from a template
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { templatesApi } from '../api';
import { Spinner } from '../components/Spinner';
import { emptyBudgetDraft } from '../utils/budgetForm';
import { queryKeys } from '../utils/queryKeys';
import type { TemplateCategoryCreate } from '../types';

interface CategoryDraft {
  name: string;
  items: string; // newline-separated labels while editing
}

function emptyCategoryDraft(): CategoryDraft {
  return { name: '', items: '' };
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.templates,
    queryFn: templatesApi.list,
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [categoryDrafts, setCategoryDrafts] = useState<CategoryDraft[]>([
    emptyCategoryDraft(),
  ]);

  // ── Create template ────────────────────────
  const createMutation = useMutation({
    mutationFn: templatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates });
      setShowCreateForm(false);
      setTemplateName('');
      setCategoryDrafts([emptyCategoryDraft()]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: templatesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates });
    },
  });

  // ── Create budget from template ────────────
  const [applyTemplateId, setApplyTemplateId] = useState<number | null>(null);
  const [newBudget, setNewBudget] = useState(emptyBudgetDraft);

  const createFromTemplateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { title: string; month: number; year: number };
    }) => templatesApi.createBudgetFromTemplate(id, data),
    onSuccess: (budget) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
      setApplyTemplateId(null);
      setNewBudget(emptyBudgetDraft());
      navigate(`/budgets/${budget.id}`);
    },
  });

  // ── Form helpers ───────────────────────────
  const handleAddCategory = () => {
    setCategoryDrafts([...categoryDrafts, emptyCategoryDraft()]);
  };

  const handleCategoryChange = (index: number, field: 'name' | 'items', value: string) => {
    const updated = [...categoryDrafts];
    updated[index] = { ...updated[index], [field]: value };
    setCategoryDrafts(updated);
  };

  const handleRemoveCategory = (index: number) => {
    setCategoryDrafts(categoryDrafts.filter((_, i) => i !== index));
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const categories: TemplateCategoryCreate[] = categoryDrafts
      .filter((c) => c.name.trim() !== '')
      .map((c, i) => ({
        name: c.name.trim(),
        sort_order: i,
        items: c.items
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l !== '')
          .map((label) => ({ label })),
      }));

    createMutation.mutate({ name: templateName.trim(), categories });
  };

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Budget Templates
        </h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + New Template
        </button>
      </div>

      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Templates pre-fill a new budget with categories and items (amounts
        start at zero). Useful for recurring monthly structures.
      </p>

      {/* ── Create template form ─────────────── */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateTemplate}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Create New Template
          </h2>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Template name
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Standard Month"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          {categoryDrafts.map((cat, index) => (
            <div
              key={index}
              className="mb-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
            >
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="text"
                  value={cat.name}
                  onChange={(e) =>
                    handleCategoryChange(index, 'name', e.target.value)
                  }
                  placeholder="Category name (e.g. Wohnen)"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                {categoryDrafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(index)}
                    className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                    title="Remove category"
                  >
                    ✕
                  </button>
                )}
              </div>
              <textarea
                value={cat.items}
                onChange={(e) =>
                  handleCategoryChange(index, 'items', e.target.value)
                }
                placeholder={'Item labels, one per line\nMiete\nStrom\nInternet'}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddCategory}
            className="mb-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            + Add Category
          </button>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Template'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Templates list ───────────────────── */}
      {templates && templates.length === 0 && !showCreateForm && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-500">
            No templates yet. Create one to pre-fill new budgets.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {templates?.map((template) => (
          <div
            key={template.id}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {template.name}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setApplyTemplateId(
                      applyTemplateId === template.id ? null : template.id,
                    );
                    setNewBudget({
                      ...emptyBudgetDraft(),
                      title: template.name,
                    });
                  }}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Use Template
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Delete template "${template.name}"? This cannot be undone.`,
                      )
                    ) {
                      deleteMutation.mutate(template.id);
                    }
                  }}
                  className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
                  title="Delete template"
                >
                  🗑
                </button>
              </div>
            </div>

            {/* ── Apply template form ──────────── */}
            {applyTemplateId === template.id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createFromTemplateMutation.mutate({
                    id: template.id,
                    data: newBudget,
                  });
                }}
                className="mb-3 flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900"
              >
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    New budget title
                  </label>
                  <input
                    type="text"
                    value={newBudget.title}
                    onChange={(e) =>
                      setNewBudget({ ...newBudget, title: e.target.value })
                    }
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Month
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={newBudget.month}
                    onChange={(e) =>
                      setNewBudget({
                        ...newBudget,
                        month: parseInt(e.target.value),
                      })
                    }
                    required
                    className="w-20 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Year
                  </label>
                  <input
                    type="number"
                    min={1900}
                    max={2100}
                    value={newBudget.year}
                    onChange={(e) =>
                      setNewBudget({
                        ...newBudget,
                        year: parseInt(e.target.value),
                      })
                    }
                    required
                    className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={createFromTemplateMutation.isPending}
                  className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {createFromTemplateMutation.isPending
                    ? 'Creating…'
                    : 'Create Budget'}
                </button>
              </form>
            )}

            {/* ── Category summary ─────────────── */}
            <div className="flex flex-wrap gap-2">
              {template.categories.map((cat) => (
                <span
                  key={cat.id}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  title={cat.items.map((i) => i.label).join(', ')}
                >
                  {cat.name} ({cat.items.length})
                </span>
              ))}
              {template.categories.length === 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-500">
                  No categories
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
