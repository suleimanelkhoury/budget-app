/**
 * Budget form helpers — shared default-state factories.
 *
 * Several pages manage "create budget" / "clone budget" forms with the same
 * initial shape. These factories keep the defaults (including "now"-based
 * month/year) in one place.
 */

export interface BudgetDraft {
  title: string;
  month: number;
  year: number;
}

/** A blank budget draft pre-filled with the current month/year. */
export function emptyBudgetDraft(): BudgetDraft {
  return {
    title: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  };
}
