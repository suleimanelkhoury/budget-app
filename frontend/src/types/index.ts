/**
 * TypeScript types matching the backend Pydantic schemas.
 * These mirror the API response/request bodies exactly.
 */

// ── Auth ─────────────────────────────────────
export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface UserCreate {
  email: string;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: User;
}

// ── Budget ───────────────────────────────────
export interface BudgetCreate {
  title: string;
  month: number;
  year: number;
}

export interface BudgetUpdate {
  title?: string;
  month?: number;
  year?: number;
}

export interface Budget {
  id: number;
  user_id: number;
  title: string;
  month: number;
  year: number;
  created_at: string;
}

export interface BudgetDetail extends Budget {
  incomes: Income[];
  categories: Category[];
}

// ── Income ───────────────────────────────────
export interface IncomeCreate {
  label: string;
  projected_amount?: string | number;
  actual_amount?: string | number;
}

export interface IncomeUpdate {
  label?: string;
  projected_amount?: string | number;
  actual_amount?: string | number;
}

export interface Income {
  id: number;
  budget_id: number;
  label: string;
  projected_amount: string;
  actual_amount: string;
  difference: string;
}

// ── Category ─────────────────────────────────
export interface CategoryCreate {
  name: string;
  sort_order?: number;
}

export interface CategoryUpdate {
  name?: string;
  sort_order?: number;
}

export interface Category {
  id: number;
  budget_id: number;
  name: string;
  sort_order: number;
  items: ExpenseItem[];
}

// ── Expense Item ─────────────────────────────
export interface ExpenseItemCreate {
  label: string;
  projected_cost?: string | number;
  actual_cost?: string | number;
}

export interface ExpenseItemUpdate {
  label?: string;
  projected_cost?: string | number;
  actual_cost?: string | number;
}

export interface ExpenseItem {
  id: number;
  category_id: number;
  label: string;
  projected_cost: string;
  actual_cost: string;
  difference: string;
}

// ── Summary ──────────────────────────────────
export interface BudgetSummary {
  total_projected_income: string;
  total_actual_income: string;
  total_projected_gehalt: string;
  total_actual_gehalt: string;
  total_projected_extra: string;
  total_actual_extra: string;
  total_projected_expenses: string;
  total_actual_expenses: string;
  projected_balance: string;
  actual_balance: string;
  balance_difference: string;
  expense_difference: string;
}

export interface CategorySubtotal {
  category_id: number;
  category_name: string;
  sort_order: number;
  item_count: number;
  projected_subtotal: string;
  actual_subtotal: string;
  difference: string;
}

export interface CategorySummary {
  budget_id: number;
  categories: CategorySubtotal[];
}

// ── Chart Data ───────────────────────────────
export interface ChartDataPoint {
  label: string;
  projected: string;
  actual: string;
}

export interface ChartData {
  budget_id: number;
  budget_title: string;
  expenses_by_category: ChartDataPoint[];
  income_vs_expenses: ChartDataPoint;
}

// ── Multi-month Comparison ───────────────────
export interface BudgetComparisonEntry {
  budget_id: number;
  title: string;
  month: number;
  year: number;
  total_projected_income: string;
  total_actual_income: string;
  total_projected_gehalt: string;
  total_actual_gehalt: string;
  total_projected_extra: string;
  total_actual_extra: string;
  total_projected_expenses: string;
  total_actual_expenses: string;
  projected_balance: string;
  actual_balance: string;
}

export interface BudgetComparison {
  budgets: BudgetComparisonEntry[];
}

// ── Budget Clone (recurring templates) ───────
export interface BudgetClone {
  title: string;
  month: number;
  year: number;
  copy_actuals?: boolean;
}

// ── Budget Templates ─────────────────────────
export interface TemplateItem {
  id: number;
  category_id: number;
  label: string;
}

export interface TemplateItemCreate {
  label: string;
}

export interface TemplateCategory {
  id: number;
  template_id: number;
  name: string;
  sort_order: number;
  items: TemplateItem[];
}

export interface TemplateCategoryCreate {
  name: string;
  sort_order?: number;
  items: TemplateItemCreate[];
}

export interface BudgetTemplate {
  id: number;
  user_id: number;
  name: string;
  categories: TemplateCategory[];
}

export interface BudgetTemplateCreate {
  name: string;
  categories: TemplateCategoryCreate[];
}

export interface BudgetTemplateUpdate {
  name?: string;
}

export interface CreateBudgetFromTemplate {
  title: string;
  month: number;
  year: number;
}

// ── Excel Import ─────────────────────────────
export interface ExcelImportResponse {
  budget_id: number;
  budget_title: string;
  categories_imported: number;
  income_imported: number;
  items_imported: number;
  message: string;
}

// ── API Error ────────────────────────────────
export interface ApiError {
  error: {
    status_code: number;
    message: string;
    detail: unknown;
    path: string;
    method: string;
  };
}
