/**
 * ConfirmDialog — a reusable destructive-action confirmation modal.
 *
 * Standardizes the delete-confirmation UX (overlay, title, message, error
 * banner, Cancel/Confirm buttons) that was previously duplicated across
 * BudgetCard and BudgetDetailPage.
 */

import type { ReactNode } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Shown when the action is in flight. */
  isPending: boolean;
  /** Shown if the action failed. */
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  isPending,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        <div className="mb-5 text-sm text-gray-600 dark:text-gray-300">
          {message}
        </div>
        {errorMessage && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {errorMessage}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
