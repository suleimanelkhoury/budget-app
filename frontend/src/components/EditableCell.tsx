/**
 * EditableCell — an inline-editable table cell.
 *
 * Click to edit, Enter or blur to save, Escape to cancel.
 * Calls onSave with the new value when the user commits a change.
 */

import { useEffect, useRef, useState } from 'react';

interface EditableCellProps {
  /** The current value to display. */
  value: string;
  /** Called when the user commits a new value. */
  onSave: (newValue: string) => void;
  /** Whether the cell is editable. Defaults to true. */
  editable?: boolean;
  /** Additional CSS classes. */
  className?: string;
  /** Input type — 'text' or 'number'. */
  type?: 'text' | 'number';
}

export function EditableCell({
  value,
  onSave,
  editable = true,
  className = '',
  type = 'text',
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (editable) {
      // Always start with the latest prop value
      setEditValue(value);
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    if (editValue !== value) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
      // Move focus to the next editable cell
      const target = e.currentTarget as HTMLElement;
      const next = findNextEditableCell(target);
      next?.focus();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value);
    } else if (e.key === 'Tab') {
      // Save on Tab and let the browser move focus naturally
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`w-full rounded border border-indigo-400 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-200 dark:border-indigo-500 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-indigo-800 ${className}`}
      />
    );
  }

  return (
    <span
      onClick={handleStartEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault();
          handleStartEdit();
        }
      }}
      tabIndex={editable ? 0 : -1}
      className={`block cursor-pointer rounded px-2 py-1 text-sm outline-none hover:bg-indigo-50 focus:bg-indigo-50 focus:ring-2 focus:ring-indigo-200 dark:text-gray-100 dark:hover:bg-indigo-900/30 dark:focus:bg-indigo-900/30 dark:focus:ring-indigo-800 ${
        editable ? '' : 'cursor-default'
      } ${className}`}
    >
      {value}
    </span>
  );
}

/**
 * Find the next editable cell in the DOM after the given element.
 * Looks for elements with tabIndex=0 within the same table.
 */
function findNextEditableCell(current: HTMLElement): HTMLElement | null {
  const table = current.closest('table');
  if (!table) return null;

  const editables = Array.from(
    table.querySelectorAll<HTMLElement>('[tabindex="0"]'),
  );
  const currentIndex = editables.indexOf(
    current.closest('[tabindex="0"]') as HTMLElement,
  );
  return editables[currentIndex + 1] ?? null;
}
