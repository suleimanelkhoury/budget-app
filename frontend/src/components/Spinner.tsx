/**
 * Spinner — a centered loading spinner used across pages.
 */

export function Spinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
