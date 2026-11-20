/**
 * ConfirmDialog — a reusable destructive-action confirmation modal.
 *
 * Standardizes the delete-confirmation UX (title, message, error
 * banner, Cancel/Confirm buttons) that was previously duplicated across
 * BudgetCard and BudgetDetailPage.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { neutralButtonClass } from '../utils/ui';

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
  cancelLabel,
  isPending,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal title={title} onClose={onCancel} closeButton={false}>
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
          className={neutralButtonClass}
        >
          {cancelLabel ?? t('common.actions.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? t('common.actions.deleting') : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
