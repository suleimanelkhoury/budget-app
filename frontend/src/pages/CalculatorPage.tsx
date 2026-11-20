/**
 * Calculator Page — enter amounts into the active budget.
 *
 * Layout: the whole chosen budget (incomes, categories, items) on the
 * left two-thirds; the calculator (keypad, display) in the right third.
 * Pick the row by clicking it in the overview (expense items and income
 * rows both work); the "＋" next to a category opens an inline name
 * field in that section — Enter creates the row there with 0/0 values,
 * ready to be filled in with the calculator. The IST/SOLL tag in the
 * display picks which of the row's values is edited — that value
 * becomes the calculator's first argument: "+ 5" then Enter adds 5, "− 5"
 * subtracts, "× 2" doubles it, and typing a plain number then Enter
 * replaces the value outright. "=" evaluates in place so results can
 * be committed step by step. The "Round up" toggle keeps the applied
 * amount exact on the working row and adds the round-ups of every
 * typed number (1 → 1.00, 0.5 → 0.50) to the "MSCI World" row in
 * "Investitionen" — subtracting removes them from there again (× and
 * ÷ don't touch MSCI World). If that row is missing (or is the working
 * row itself), the rounded total lands on the working row instead.
 * Double-clicking a row renames it (Enter saves, Escape cancels); the
 * selected expense row can be deleted with the "−" next to it (income
 * rows can't be deleted). Escape clears the calculator and, when it's
 * already empty, deselects the row; clicking any empty spot on the
 * page also deselects it. Under the budget selector, the page shows
 * when the active budget was last edited (backend `updated_at` stamp,
 * bumped by every mutating endpoint — budget rename, categories, rows,
 * income, amounts committed here). The overview column shows the
 * budget's balance above the Income section — grand totals from the
 * summary endpoint, refreshed after every committed amount.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { budgetsApi, expenseItemsApi, incomeApi } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import { evaluateExpression, isOperatorChar } from '../utils/calculator';
import { formatCurrency, formatDateTime, formatDifference, formatRelativeTime, toNumber } from '../utils/format';
import { balanceColor } from '../utils/balance';
import { queryKeys, invalidateBudgetData } from '../utils/queryKeys';
import type {
  BudgetDetail,
  BudgetSummary,
  Category,
  ExpenseItem,
  Income,
} from '../types';

type Op = '+' | '-' | '*' | '/';

/** Round to 2 decimals to avoid float drift from repeated additions. */
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Round up to the next full euro — whole euros still go up by one
 * (14.51 → 15.00, 3.00 → 4.00). The +1e-9 guards against float noise
 * just below a whole euro (e.g. 14.999999999). */
const roundUpToEuro = (v: number) => Math.floor(v + 1e-9) + 1;

/** The round-up beneficiary: the "MSCI World" row in the
 * "Investitionen" category (matched case-insensitively). The round-up
 * difference is added there automatically. */
function findRoundUpRow(budget: BudgetDetail): ExpenseItem | null {
  const category = budget.categories.find(
    (c) => c.name.trim().toLowerCase() === 'investitionen',
  );
  return (
    category?.items.find(
      (i) => i.label.trim().toLowerCase() === 'msci world',
    ) ?? null
  );
}

/** Total round-up of every number typed into `expr`: each number is
 * rounded up to the next full euro (1 → 1.00, 0.5 → 0.50, 14.51 →
 * 0.49) and the differences are summed. */
function typedRoundUpDiff(expr: string): number {
  let total = 0;
  for (const match of expr.matchAll(/\d+(\.\d+)?/g)) {
    const n = Number(match[0]);
    total += roundUpToEuro(n) - n;
  }
  return round2(total);
}

/** Extract the backend error envelope's message from an axios error. */
function apiErrorMessage(err: unknown): string {
  const message = (
    err as { response?: { data?: { error?: { message?: string } } } }
  )?.response?.data?.error?.message;
  return message ?? 'Something went wrong. Please try again.';
}

const OP_SYMBOL: Record<Op, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

/** The row the calculator operates on: an expense item or an income. */
type Target =
  | { kind: 'item'; item: ExpenseItem }
  | { kind: 'income'; income: Income };

/** The expense row pending deletion (incomes can't be deleted here). */
type DeleteTarget = {
  id: number;
  label: string;
  /** Human context, e.g. "category Lebensmittel". */
  context: string;
};

export function CalculatorPage() {
  const queryClient = useQueryClient();
  // ── Budget selection ─────────────────────────
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(
    null,
  );
  const [selectedRow, setSelectedRow] = useState<string>('');
  // Category currently receiving a new row (via its "＋" button); the
  // row name is typed inline in that category's section
  const [newRowCategoryId, setNewRowCategoryId] = useState<number | ''>('');
  const [newRowLabel, setNewRowLabel] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: budgets } = useQuery({
    queryKey: queryKeys.budgets,
    queryFn: budgetsApi.list,
  });
  // Auto-select the latest budget (list is sorted chronologically
  // ascending, so the most recent budget is the last entry)
  const budgetId =
    selectedBudgetId ?? budgets?.[budgets.length - 1]?.id ?? null;

  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: queryKeys.budget.detail(budgetId!),
    queryFn: () => budgetsApi.get(budgetId!),
    enabled: !!budgetId,
  });

  // Grand totals for the active budget — the IST BALANCE block in the
  // calculator panel reads from this. invalidateBudgetData already
  // invalidates the summary after every mutation, so the balance is
  // fresh after every committed amount.
  const { data: summary } = useQuery({
    queryKey: queryKeys.budget.summary(budgetId!),
    queryFn: () => budgetsApi.getSummary(budgetId!),
    enabled: !!budgetId,
  });

  // New rows start at 0/0 — values are assigned later with the
  // calculator. The created row is selected right away.
  const createItemMutation = useMutation({
    mutationFn: ({
      categoryId,
      label,
    }: {
      categoryId: number;
      label: string;
    }) => expenseItemsApi.create(categoryId, { label }),
    onSuccess: (item) => {
      if (budgetId) invalidateBudgetData(queryClient, budgetId);
      setSelectedRow(`item:${item.id}`);
      setNewRowCategoryId('');
      setNewRowLabel('');
      setCreateError(null);
    },
    onError: (err) => setCreateError(apiErrorMessage(err)),
  });

  const handleCreateRow = (categoryId: number, label: string) => {
    if (!label) {
      setCreateError('Enter a name for the new row.');
      return;
    }
    createItemMutation.mutate({ categoryId, label });
  };

  return (
    <div
      onClick={(e) => {
        // Clicking any non-interactive spot on the page deselects the
        // row (buttons, inputs, selects, and links keep working)
        const el = e.target as HTMLElement;
        if (el.closest('button, input, select, a, label, [role="button"]')) {
          return;
        }
        setSelectedRow('');
      }}
    >
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Calculator
      </h1>

      {/* ── Budget selector ─────────────────────── */}
      <div className="mb-6">
        <label
          htmlFor="calc-budget"
          className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Active Budget
        </label>
        <select
          id="calc-budget"
          value={budgetId ?? ''}
          onChange={(e) => {
            setSelectedBudgetId(parseInt(e.target.value));
            // The selected row belongs to the old budget
            setSelectedRow('');
            setNewRowCategoryId('');
          }}
          className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          {(budgets ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        {budget && (
          <p
            className="mt-1.5 text-xs text-gray-500 dark:text-gray-400"
            title={`Last edited ${formatDateTime(budget.updated_at)}`}
          >
            Last edited: {formatRelativeTime(budget.updated_at)}
          </p>
        )}
      </div>

      {budgetLoading && <Spinner />}

      {createError && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
          {createError}
        </p>
      )}

      {budget && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ── Left ⅔: the whole budget ─────────── */}
          <div className="lg:col-span-2">
            <BudgetOverview
              budget={budget}
              summary={summary}
              selectedItemId={selectedRow}
              newRowCategoryId={newRowCategoryId}
              newRowLabel={newRowLabel}
              onSelectItem={setSelectedRow}
              onAddRow={setNewRowCategoryId}
              onNewRowLabel={setNewRowLabel}
              onCreateRow={handleCreateRow}
              onCancelNewRow={() => {
                setNewRowCategoryId('');
                setNewRowLabel('');
                setCreateError(null);
              }}
            />
          </div>

          {/* ── Right ⅓: calculator ──────────────── */}
          <div>
            <CalculatorPanel
              budget={budget}
              selectedRow={selectedRow}
              onDeselectRow={() => setSelectedRow('')}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Budget overview (left column)
// ─────────────────────────────────────────────────────────────

function BudgetOverview({
  budget,
  summary,
  selectedItemId,
  newRowCategoryId,
  newRowLabel,
  onSelectItem,
  onAddRow,
  onNewRowLabel,
  onCreateRow,
  onCancelNewRow,
}: {
  budget: BudgetDetail;
  summary: BudgetSummary | undefined;
  selectedItemId: string;
  newRowCategoryId: number | '';
  newRowLabel: string;
  onSelectItem: (itemId: string) => void;
  onAddRow: (categoryId: number) => void;
  onNewRowLabel: (label: string) => void;
  onCreateRow: (categoryId: number, label: string) => void;
  onCancelNewRow: () => void;
}) {
  const queryClient = useQueryClient();
  // Row deletion (the "−" next to the selected row), with confirm
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteRowMutation = useMutation({
    mutationFn: (t: DeleteTarget) => expenseItemsApi.delete(t.id),
    onSuccess: (_result, t) => {
      invalidateBudgetData(queryClient, budget.id);
      // The deleted row can no longer be the entry target
      if (selectedItemId === `item:${t.id}`) onSelectItem('');
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err) => setDeleteError(apiErrorMessage(err)),
  });

  // ── Row renaming (double-click on a row) ─────
  const [renaming, setRenaming] = useState<{
    kind: 'item' | 'income';
    id: number;
  } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const renameRowMutation = useMutation({
    mutationFn: async ({
      kind,
      id,
      label,
    }: {
      kind: 'item' | 'income';
      id: number;
      label: string;
    }) => {
      if (kind === 'item') await expenseItemsApi.update(id, { label });
      else await incomeApi.update(id, { label });
    },
    onSuccess: () => {
      invalidateBudgetData(queryClient, budget.id);
      setRenaming(null);
      setRenameError(null);
    },
    onError: (err) => setRenameError(apiErrorMessage(err)),
  });

  const startRename = (
    kind: 'item' | 'income',
    id: number,
    label: string,
  ) => {
    setRenaming({ kind, id });
    setRenameValue(label);
    setRenameError(null);
  };

  const submitRename = () => {
    if (!renaming) return;
    const label = renameValue.trim();
    if (!label) {
      setRenameError('Enter a name.');
      return;
    }
    renameRowMutation.mutate({ ...renaming, label });
  };

  const cancelRename = () => {
    setRenaming(null);
    setRenameError(null);
  };

  return (
    <div className="space-y-4">
      {/* ── Balance — the budget's running result ──
          Updates after every committed amount (the summary
          query is invalidated by each mutation). */}
      {summary && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Balance
            </h2>
            <span className="text-right">
              <span
                data-testid="calculator-balance"
                className={`text-sm font-semibold ${balanceColor(
                  toNumber(summary.actual_balance),
                )}`}
              >
                {formatCurrency(summary.actual_balance)}
              </span>
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                ≠ from SOLL{' '}
                <span
                  className={balanceColor(
                    toNumber(summary.balance_difference),
                  )}
                >
                  {formatDifference(summary.balance_difference)}
                </span>
              </span>
            </span>
          </div>
        </section>
      )}

      {/* ── Incomes ───────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Income
        </h2>
        {budget.incomes.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
            No income rows.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {budget.incomes.map((income) => {
              const rowId = `income:${income.id}`;
              const isSelected = rowId === selectedItemId;
              const isRenaming =
                renaming?.kind === 'income' && renaming.id === income.id;
              return (
                <li key={income.id} className="flex items-center gap-1">
                  {isRenaming ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitRename();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                        onBlur={cancelRename}
                        className="min-w-0 flex-1 rounded-lg border border-brand-400 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none dark:bg-gray-900 dark:text-gray-100"
                      />
                      <span className="text-right text-sm">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(toNumber(income.actual_amount))}
                        </span>
                        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                          SOLL{' '}
                          {formatCurrency(toNumber(income.projected_amount))}
                        </span>
                      </span>
                      {renameError && (
                        <span className="text-xs text-red-600 dark:text-red-300">
                          {renameError}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelectItem(rowId)}
                        onDoubleClick={() =>
                          startRename('income', income.id, income.label)
                        }
                        title="Click to select — double-click to rename"
                        className={`flex flex-1 items-baseline justify-between rounded-lg px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                          isSelected
                            ? 'bg-brand-100 ring-1 ring-brand-400 dark:bg-brand-900/50 dark:ring-brand-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`text-left ${
                            isSelected
                              ? 'font-semibold text-brand-700 dark:text-brand-200'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {income.label}
                        </span>
                        <span className="text-right">
                          <span
                            className={`font-semibold ${
                              isSelected
                                ? 'text-brand-700 dark:text-brand-200'
                                : 'text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            {formatCurrency(toNumber(income.actual_amount))}
                          </span>
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                            SOLL{' '}
                            {formatCurrency(toNumber(income.projected_amount))}
                          </span>
                        </span>
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Categories with items ─────────────── */}
      {budget.categories.map((category) => (
        <CategoryOverviewCard
          key={category.id}
          category={category}
          selectedItemId={selectedItemId}
          isPendingNewTarget={newRowCategoryId === category.id}
          onSelectItem={onSelectItem}
          onAddRow={onAddRow}
          newRowLabel={newRowLabel}
          onNewRowLabel={onNewRowLabel}
          onCreateRow={onCreateRow}
          onCancelNewRow={onCancelNewRow}
          renamingId={
            renaming ? `${renaming.kind}:${renaming.id}` : null
          }
          renameValue={renameValue}
          onRenameValue={setRenameValue}
          onRenameStart={(item) =>
            startRename('item', item.id, item.label)
          }
          onRenameSubmit={submitRename}
          onRenameCancel={cancelRename}
          renameError={renameError}
          onRequestDelete={(item) =>
            setDeleteTarget({
              id: item.id,
              label: item.label,
              context: `category ${category.name}`,
            })
          }
        />
      ))}

      {/* ── Delete-row confirmation ───────────── */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete row"
          message={
            <>
              Delete <strong>{deleteTarget.label}</strong> (
              {deleteTarget.context})? Its amounts will be removed from the
              budget.
            </>
          }
          confirmLabel="Delete"
          isPending={deleteRowMutation.isPending}
          errorMessage={deleteError}
          onConfirm={() => deleteRowMutation.mutate(deleteTarget)}
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryOverviewCard({
  category,
  selectedItemId,
  isPendingNewTarget,
  onSelectItem,
  onAddRow,
  newRowLabel,
  onNewRowLabel,
  onCreateRow,
  onCancelNewRow,
  renamingId,
  renameValue,
  onRenameValue,
  onRenameStart,
  onRenameSubmit,
  onRenameCancel,
  renameError,
  onRequestDelete,
}: {
  category: Category;
  selectedItemId: string;
  isPendingNewTarget: boolean;
  onSelectItem: (itemId: string) => void;
  onAddRow: (categoryId: number) => void;
  newRowLabel: string;
  onNewRowLabel: (label: string) => void;
  onCreateRow: (categoryId: number, label: string) => void;
  onCancelNewRow: () => void;
  /** Namespaced id of the row currently being renamed, if any. */
  renamingId: string | null;
  renameValue: string;
  onRenameValue: (value: string) => void;
  onRenameStart: (item: ExpenseItem) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  renameError: string | null;
  onRequestDelete: (item: ExpenseItem) => void;
}) {
  return (
    <section
      className={`rounded-2xl border bg-white p-4 dark:bg-gray-800 ${
        isPendingNewTarget
          ? 'border-brand-400 ring-1 ring-brand-400 dark:border-brand-500'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {category.name}
        </h2>
        <button
          type="button"
          onClick={() => onAddRow(category.id)}
          title={`Add a row to ${category.name}`}
          className="rounded-lg bg-brand-50 px-2 py-0.5 text-sm font-semibold leading-5 text-brand-600 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-300 dark:hover:bg-brand-900/60"
        >
          ＋
        </button>
      </div>
      {category.items.length === 0 && !isPendingNewTarget ? (
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
          No rows yet.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {category.items.map((item) => {
            const rowId = `item:${item.id}`;
            const isSelected = rowId === selectedItemId;
            const isRenaming = renamingId === rowId;
            return (
              <li key={item.id} className="flex items-center gap-1">
                {isRenaming ? (
                  <>
                    <input
                      autoFocus
                      type="text"
                      value={renameValue}
                      onChange={(e) => onRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          onRenameSubmit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          onRenameCancel();
                        }
                      }}
                      onBlur={onRenameCancel}
                      className="min-w-0 flex-1 rounded-lg border border-brand-400 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none dark:bg-gray-900 dark:text-gray-100"
                    />
                    <span className="text-right text-sm">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(toNumber(item.actual_cost))}
                      </span>
                      <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                        SOLL {formatCurrency(toNumber(item.projected_cost))}
                      </span>
                    </span>
                    {renameError && (
                      <span className="text-xs text-red-600 dark:text-red-300">
                        {renameError}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelectItem(rowId)}
                      onDoubleClick={() => onRenameStart(item)}
                      title="Click to select — double-click to rename"
                      className={`flex flex-1 items-baseline justify-between rounded-lg px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        isSelected
                          ? 'bg-brand-100 ring-1 ring-brand-400 dark:bg-brand-900/50 dark:ring-brand-500'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`text-left ${
                          isSelected
                            ? 'font-semibold text-brand-700 dark:text-brand-200'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="text-right">
                        <span
                          className={`font-semibold ${
                            isSelected
                              ? 'text-brand-700 dark:text-brand-200'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {formatCurrency(toNumber(item.actual_cost))}
                        </span>
                        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                          SOLL {formatCurrency(toNumber(item.projected_cost))}
                        </span>
                      </span>
                    </button>
                    {/* Delete button — only on the selected row */}
                    {isSelected && (
                      <button
                        type="button"
                        onClick={() => onRequestDelete(item)}
                        title={`Delete ${item.label}`}
                        className="rounded-lg bg-red-50 px-2 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                      >
                        −
                      </button>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {/* ── Inline new-row input (opened by the ＋ button) ── */}
      {isPendingNewTarget && (
        <input
          autoFocus
          type="text"
          value={newRowLabel}
          onChange={(e) => onNewRowLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCreateRow(category.id, newRowLabel.trim());
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancelNewRow();
            }
          }}
          placeholder="Row name, e.g. Lidl — Enter creates it"
          className="mt-2 w-full rounded-lg border border-brand-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-brand-700 dark:bg-gray-900 dark:text-gray-100"
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Calculator (right column)
// ─────────────────────────────────────────────────────────────

function CalculatorPanel({
  budget,
  selectedRow,
  onDeselectRow,
}: {
  budget: BudgetDetail;
  selectedRow: string;
  onDeselectRow: () => void;
}) {
  const queryClient = useQueryClient();
  const categories = budget.categories ?? [];

  // Which value of the selected row the calculator edits — toggled by
  // clicking the IST/SOLL tag inside the display
  const [field, setField] = useState<'ist' | 'soll'>('ist');
  // Round up: committed amounts are rounded up to the next full euro
  // (14.51 → 15.00; 3.00 → 4.00, i.e. the round-up is a full euro)
  const [roundUp, setRoundUp] = useState(false);

  // The selected row: either an expense item (item:<id>) or an income
  // row (income:<id>) — both work as the calculator's first argument.
  const target: Target | null = ((): Target | null => {
    if (!selectedRow) return null;
    if (selectedRow.startsWith('income:')) {
      const income = budget.incomes.find(
        (i) => `income:${i.id}` === selectedRow,
      );
      return income ? { kind: 'income', income } : null;
    }
    const item = categories
      .flatMap((c) => c.items)
      .find((i) => `item:${i.id}` === selectedRow);
    return item ? { kind: 'item', item } : null;
  })();

  // The row's currently edited value (IST or SOLL) — the calculator's
  // first argument. Read live from the query data, so it updates after
  // every commit.
  const seedValue = (() => {
    if (target === null) return null;
    if (target.kind === 'item') {
      return field === 'ist'
        ? toNumber(target.item.actual_cost)
        : toNumber(target.item.projected_cost);
    }
    return field === 'ist'
      ? toNumber(target.income.actual_amount)
      : toNumber(target.income.projected_amount);
  })();
  const seedString = seedValue !== null ? round2(seedValue).toFixed(2) : '';
  // ── Calculator state ─────────────────────────
  // input: the typed number; op: the operation pending against the
  // row value ("23.40 + 5" = seed 23.40, op '+', input "5"). With no
  // op, committing input replaces the row value outright.
  const [input, setInput] = useState('');
  const [op, setOp] = useState<Op | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // The amount Enter would apply with the current display contents
  const pendingAmount = (() => {
    const expr = op && seedValue !== null ? `${seedValue}${op}${input}` : input;
    return expr ? evaluateExpression(expr) : null;
  })();

  // ── Input helpers ────────────────────────────
  const appendChar = (ch: string) => {
    setError(null);
    setFlash(null);
    if (isOperatorChar(ch)) return; // operators go through pressOperator
    setInput((prev) => {
      if (ch === '.') {
        // One dot per number; the trailing number (after the last
        // operator) decides — an empty one starts "0."
        const trailing = /[0-9.]*$/.exec(prev)?.[0] ?? '';
        if (trailing.includes('.')) return prev;
        return prev + (trailing === '' ? '0.' : '.');
      }
      return prev + ch;
    });
  };

  const pressOperator = (next: Op) => {
    // Operations anchor on the row value — no row, no operation
    if (seedValue === null) return;
    setError(null);
    setFlash(null);
    if (!op) {
      // Start an operation on the row value (discards a typed
      // set-value)
      setInput('');
      setOp(next);
    } else if (input === '') {
      // Nothing typed yet — just switch the pending operation
      setOp(next);
    } else {
      // Chain: fold the typed number into the expression, e.g.
      // "59.85 + 1" then "+" → "59.85 + 1+"; a trailing operator is
      // replaced (fixes a double-tap)
      setInput((prev) => {
        const last = prev[prev.length - 1];
        if (isOperatorChar(last)) return prev.slice(0, -1) + next;
        return prev + next;
      });
    }
  };

  const backspace = () => {
    setError(null);
    setInput((prev) => {
      if (prev) return prev.slice(0, -1);
      return prev;
    });
    if (!input && op) setOp(null);
  };

  const clear = () => {
    setInput('');
    setOp(null);
    setError(null);
  };

  /** Escape: clear the calculator first; if it's already empty,
   * deselect the row. */
  const escapeAction = () => {
    if (input || op) {
      clear();
    } else {
      setError(null);
      setFlash(null);
      onDeselectRow();
    }
  };

  /** Evaluate the pending expression in place (the "=" button/key). */
  const evaluate = () => {
    const expr = op && seedValue !== null ? `${seedValue}${op}${input}` : input;
    if (!expr) return;
    const value = evaluateExpression(expr);
    if (value === null) {
      setError('Incomplete expression — e.g. 23.40+5.');
      return;
    }
    setInput(round2(value).toFixed(2));
    setOp(null);
    setError(null);
  };

  // ── Commit (apply the result to the row) ─────
  const onError = (err: unknown) => setError(apiErrorMessage(err));

  const updateItemMutation = useMutation({
    mutationFn: ({
      id,
      actualCost,
      projectedCost,
    }: {
      id: number;
      actualCost?: string;
      projectedCost?: string;
    }) =>
      expenseItemsApi.update(id, {
        ...(actualCost !== undefined ? { actual_cost: actualCost } : {}),
        ...(projectedCost !== undefined
          ? { projected_cost: projectedCost }
          : {}),
      }),
    onSuccess: () => invalidateBudgetData(queryClient, budget.id),
    onError,
  });

  const updateIncomeMutation = useMutation({
    mutationFn: ({
      id,
      actualAmount,
      projectedAmount,
    }: {
      id: number;
      actualAmount?: string;
      projectedAmount?: string;
    }) =>
      incomeApi.update(id, {
        ...(actualAmount !== undefined
          ? { actual_amount: actualAmount }
          : {}),
        ...(projectedAmount !== undefined
          ? { projected_amount: projectedAmount }
          : {}),
      }),
    onSuccess: () => invalidateBudgetData(queryClient, budget.id),
    onError,
  });

  const commit = () => {
    if (!selectedRow) {
      setError('Choose a row first (click it on the left).');
      return;
    }
    if (pendingAmount === null) {
      setError('Enter an amount (e.g. 5 or +5) first.');
      return;
    }
    if (!target) return;
    const raw = round2(pendingAmount);
    const previous = toNumber(seedValue ?? 0);
    const label =
      target.kind === 'item' ? target.item.label : target.income.label;

    // Round up: the working row gets the exact amount; the round-ups
    // of every typed number (1 → 1.00, 0.5 → 0.50, …) go to the MSCI
    // World row (Investitionen) — added on add/replace, removed again
    // on subtract. × and ÷ don't touch MSCI World. If the row doesn't
    // exist (or the working row IS MSCI World), the rounded total
    // lands on the working row, as before.
    let applied = raw;
    let roundNote = '';
    let extra: { id: number; label: string; amount: number } | null = null;

    if (roundUp) {
      const msci = findRoundUpRow(budget);
      const isSelf = target.kind === 'item' && msci?.id === target.item.id;
      const diff = typedRoundUpDiff(input);
      const direction = op === '-' ? -1 : op === null || op === '+' ? 1 : 0;
      if (msci && !isSelf && direction !== 0) {
        const msciPrevious =
          field === 'ist'
            ? toNumber(msci.actual_cost)
            : toNumber(msci.projected_cost);
        extra = {
          id: msci.id,
          label: msci.label,
          amount: round2(msciPrevious + direction * diff),
        };
        roundNote =
          direction > 0
            ? ` — ${formatCurrency(diff)} to ${msci.label}`
            : ` — ${formatCurrency(diff)} from ${msci.label}`;
      } else if (direction !== 0) {
        applied = roundUpToEuro(raw);
        roundNote = ' (rounded up)';
      }
    }

    const amount = round2(applied);
    if (target.kind === 'item') {
      updateItemMutation.mutate({
        id: target.item.id,
        ...(field === 'ist'
          ? { actualCost: amount.toFixed(2) }
          : { projectedCost: amount.toFixed(2) }),
      });
    } else {
      updateIncomeMutation.mutate({
        id: target.income.id,
        ...(field === 'ist'
          ? { actualAmount: amount.toFixed(2) }
          : { projectedAmount: amount.toFixed(2) }),
      });
    }
    if (extra) {
      updateItemMutation.mutate({
        id: extra.id,
        ...(field === 'ist'
          ? { actualCost: extra.amount.toFixed(2) }
          : { projectedCost: extra.amount.toFixed(2) }),
      });
    }
    setFlash(
      `Set "${label}" ${field === 'ist' ? '(IST)' : '(SOLL)'} to ${formatCurrency(amount)} (was ${formatCurrency(previous)}).${roundNote}`,
    );

    setInput('');
    setOp(null);
  };

  // The window keydown handler must always see the latest commit and
  // input helpers, so keep them in a ref (updated after each render).
  const handlersRef = useRef({
    commit,
    evaluate,
    appendChar,
    pressOperator,
    backspace,
    escapeAction,
  });
  useEffect(() => {
    handlersRef.current = {
      commit,
      evaluate,
      appendChar,
      pressOperator,
      backspace,
      escapeAction,
    };
  });

  // ── Keyboard input (ignored while typing in a form field) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const {
        commit: doCommit,
        evaluate: doEvaluate,
        appendChar: doAppend,
        pressOperator: doPressOperator,
        backspace: doBackspace,
        escapeAction: doEscapeAction,
      } = handlersRef.current;

      if (/^[0-9]$/.test(e.key)) {
        doAppend(e.key);
      } else if (e.key === '.' || e.key === ',') {
        doAppend('.');
      } else if (e.key === '+') {
        doPressOperator('+');
      } else if (e.key === '-') {
        doPressOperator('-');
      } else if (e.key === '*') {
        doPressOperator('*');
      } else if (e.key === '/') {
        e.preventDefault(); // avoid Firefox quick-find
        doPressOperator('/');
      } else if (e.key === '=') {
        e.preventDefault();
        doEvaluate();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        doCommit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        doBackspace();
      } else if (e.key === 'Escape') {
        doEscapeAction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const canCommit =
    !!selectedRow && pendingAmount !== null && !updateItemMutation.isPending;

  // ── Preview line: what the commit will produce ──
  const preview = (() => {
    if (pendingAmount === null) return null;
    const raw = round2(pendingAmount);
    let amount = raw;
    let note = '';
    if (roundUp && target) {
      const msci = findRoundUpRow(budget);
      const isSelf = target.kind === 'item' && msci?.id === target.item.id;
      const diff = typedRoundUpDiff(input);
      const direction = op === '-' ? -1 : op === null || op === '+' ? 1 : 0;
      if (msci && !isSelf && direction !== 0) {
        note =
          direction > 0
            ? ` (+${formatCurrency(diff)} → ${msci.label})`
            : ` (−${formatCurrency(diff)} from ${msci.label})`;
      } else if (direction !== 0) {
        amount = roundUpToEuro(raw);
        note = ' (rounded up)';
      }
    }
    if (target) {
      const current = toNumber(seedValue ?? 0);
      if (op) {
        const typed = evaluateExpression(input);
        if (typed !== null) {
          return `${formatCurrency(current)} ${OP_SYMBOL[op]} ${formatCurrency(round2(typed))} = ${formatCurrency(amount)}${note}`;
        }
      }
      return `${formatCurrency(current)} → ${formatCurrency(amount)}${note}`;
    }
    return null;
  })();

  // ── Calculator display ───────────────────────
  const display = op
    ? `${seedString} ${OP_SYMBOL[op]} ${input}`
    : input || seedString || '0';

  const calcButtonClass = (variant: 'num' | 'op' | 'clear' | 'equals') => {
    const base =
      'rounded-xl py-3 text-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 disabled:cursor-not-allowed';
    switch (variant) {
      case 'op':
        return `${base} bg-gray-100 text-brand-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-brand-300 dark:hover:bg-gray-600`;
      case 'clear':
        return `${base} bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50`;
      case 'equals':
        return `${base} bg-brand-600 text-white hover:bg-brand-700`;
      default:
        return `${base} bg-white text-gray-900 border border-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700`;
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* ── Calculator display ────────────────── */}
      <div className="rounded-2xl bg-gray-900 px-3 py-2.5 text-right dark:bg-gray-950">
        <div className="flex items-center justify-between">
          {/* IST/SOLL tag — click to toggle which value is edited */}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setFlash(null);
              setField((f) => (f === 'ist' ? 'soll' : 'ist'));
            }}
            title={
              field === 'ist'
                ? 'Editing the actual value (IST) — click for planned (SOLL)'
                : 'Editing the planned value (SOLL) — click for actual (IST)'
            }
            className="break-all font-mono text-xl text-white/40 transition-colors hover:text-white/80"
          >
            {field}
          </button>
          <div
            className="min-h-7 min-w-0 flex-1 break-all text-right font-mono text-xl text-white"
            data-testid="calculator-display"
          >
            {display}
          </div>
        </div>
        <div className="mt-1 min-h-4 text-xs text-gray-400">
          {preview ?? (pendingAmount !== null ? `= ${formatCurrency(round2(pendingAmount))}` : '')}
        </div>
      </div>

      {/* ── Error / success feedback ──────────── */}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}
      {flash && !error && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">
          {flash}
        </p>
      )}

      {/* ── Calculator buttons ────────────────── */}
      {/* Right column, top to bottom: ÷ × − + = */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <button
          type="button"
          className={calcButtonClass('clear')}
          onClick={clear}
        >
          C
        </button>
        <button
          type="button"
          className={calcButtonClass('num')}
          onClick={backspace}
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => {
            setRoundUp((r) => !r);
            setError(null);
          }}
          title="Round the applied amount up to the next full euro (14.51 → 15.00, 3.00 → 4.00)"
          className={`rounded-xl py-3 text-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            roundUp
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          €↑
        </button>
        <button
          type="button"
          className={calcButtonClass('op')}
          onClick={() => pressOperator('/')}
          disabled={seedValue === null}
          title="Divide the row value"
        >
          ÷
        </button>

        {['7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            className={calcButtonClass('num')}
            onClick={() => appendChar(d)}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className={calcButtonClass('op')}
          onClick={() => pressOperator('*')}
          disabled={seedValue === null}
          title="Multiply the row value"
        >
          ×
        </button>

        {['4', '5', '6'].map((d) => (
          <button
            key={d}
            type="button"
            className={calcButtonClass('num')}
            onClick={() => appendChar(d)}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className={calcButtonClass('op')}
          onClick={() => pressOperator('-')}
          disabled={seedValue === null}
          title="Subtract from the row value"
        >
          −
        </button>

        {['1', '2', '3'].map((d) => (
          <button
            key={d}
            type="button"
            className={calcButtonClass('num')}
            onClick={() => appendChar(d)}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className={calcButtonClass('op')}
          onClick={() => pressOperator('+')}
          disabled={seedValue === null}
          title="Add to the row value"
        >
          +
        </button>

        <button
          type="button"
          className={`${calcButtonClass('num')} col-span-2`}
          onClick={() => appendChar('0')}
        >
          0
        </button>
        <button
          type="button"
          className={calcButtonClass('equals')}
          onClick={commit}
          disabled={!canCommit}
          title="Apply to the selected row (Enter)"
        >
          ⏎
        </button>
        <button
          type="button"
          className={calcButtonClass('op')}
          onClick={evaluate}
          disabled={!input && !op}
          title="Evaluate in place (=)"
        >
          =
        </button>
      </div>
    </div>
  );
}
