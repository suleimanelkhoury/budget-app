/**
 * Charts page strings — tabs, empty states, chart titles, series
 * (legend) names, and labels for ChartsPage.
 */

const charts = {
  title: 'Charts',
  tabs: {
    overall: 'Overall',
    monthly: 'Monthly',
  },
  emptyState: {
    overall: 'No budgets available. Create at least one budget to see charts.',
    monthly: 'No budgets available. Create a budget first to see charts.',
  },
  charts: {
    incomeVsExpenses: {
      title: 'Income vs Expenses (actual, plan dashed)',
    },
    balance: {
      title: 'Cash Balance Over Time (savings trajectory, plan dashed)',
    },
    topExpenses: {
      title: 'Top Expense Rows (all budgets, actual)',
    },
    expensesByCategory: {
      title: 'Expenses by Category (Projected vs Actual)',
    },
    expenseDistribution: {
      title: 'Expense Distribution (Actual)',
    },
    categoryVariance: {
      title:
        'Category Variance (Projected − Actual · teal = under budget, terracotta = overspent)',
    },
    incomeVsExpensesSummary: {
      title: 'Income vs Expenses',
    },
  },
  series: {
    incomeGehaltExtra: 'Income (Gehalt + Extra)',
    expensesActual: 'Expenses (actual)',
    expensesPlan: 'Expenses (plan)',
    balanceActual: 'Balance (actual)',
    balancePlan: 'Balance (plan)',
    spentIst: 'Spent (Actual)',
    sollMinusIst: 'Projected − Actual',
  },
  labels: {
    selectBudget: 'Select Budget',
    projectedBalance: 'Projected Balance',
    actualBalance: 'Actual Balance',
  },
  tip: "Tip: click a bar or pie slice to see that category's items.",
};

export default charts;
