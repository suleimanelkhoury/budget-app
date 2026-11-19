/**
 * Modal — shared popup shell used by all dialogs in the app.
 *
 * Provides the overlay, close-on-backdrop-click, close-on-Escape, the
 * header row (title + close button), and the scrollable panel. Content is
 * passed as children.
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { XIcon } from './Icons';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Panel width class, e.g. 'max-w-lg' (default) or 'max-w-2xl'. */
  widthClassName?: string;
  /** Hide the close button (e.g. when the content provides its own buttons). */
  closeButton?: boolean;
}

export function Modal({
  title,
  onClose,
  children,
  widthClassName = 'max-w-lg',
  closeButton = true,
}: ModalProps) {
  // Close with the Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-800 ${widthClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          {closeButton && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              aria-label="Close dialog"
            >
              <XIcon size={16} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
