/**
 * Dashboard strings — page heading, create-budget form, archive sections,
 * budget card, and the year-to-date summary strips.
 */

const dashboard = {
  title: 'Your Budgets',
  actions: {
    importExcel: 'Import Excel',
    newBudget: '+ New Budget',
  },
  create: {
    heading: 'Create New Budget',
    titleLabel: 'Title',
    titlePlaceholder: 'e.g. July 2026',
    monthLabel: 'Month',
    yearLabel: 'Year',
    submit: 'Create',
    submitting: 'Creating…',
  },
  archive: {
    budgetCount_one: '{{count}} budget',
    budgetCount_other: '{{count}} budgets',
    empty:
      'No budgets yet. Create a new budget or import from Excel to get started.',
  },
  card: {
    current: 'Current',
    cloneTitle:
      'Clone this budget into {{month}} — projected amounts are copied, actual amounts start at zero',
    exportTitle: 'Export budget to Excel',
    exportAriaLabel: 'Export budget {{title}} to Excel',
    deleteTitle: 'Delete budget',
    deleteAriaLabel: 'Delete budget {{title}}',
    labels: {
      gehalt: 'Gehalt',
      extra: 'Extra',
      expenses: 'Expenses',
      balance: 'Balance',
    },
    deleteConfirm: {
      title: 'Delete Budget',
      message:
        'Are you sure you want to delete <bold>{{title}}</bold>? This will permanently remove all categories, expense items, and income entries. This action cannot be undone.',
      confirmLabel: 'Delete Budget',
      error: 'Failed to delete budget. Please try again.',
    },
  },
  summary: {
    categorySpending: 'Category Spending',
    categorySpendingTitle: 'Actual spending per category in {{year}}',
    overallIncome: 'Overall Income',
    overallIncomeTitle:
      'New money in {{year}}, carryover excluded:\nOverall expenses + end-of-year balance − January carryover ({{carryover}})',
    overallExpenses: 'Overall Expenses (w/o investing)',
    overallExpensesTitle:
      'Consumption only — excludes {{amount}} transferred into investments (see the Investing row)',
    avgMonthlyExpenses: 'Avg. Monthly Expenses (w/o investing)',
    avgExpensesTitle_one:
      'Average consumption across {{count}} budget in {{year}} — investments excluded',
    avgExpensesTitle_other:
      'Average consumption across {{count}} budgets in {{year}} — investments excluded',
    endOfYearBalance: 'End-of-Year Balance',
    balanceTitle: 'Remaining cash as of {{title}}',
    overallInvested: 'Overall Invested',
    overallInvestedTitle:
      'Total transferred into investments (Investitionen category) in {{year}}',
    avgMonthlyInvesting: 'Avg. Monthly Investing',
    avgInvestingTitle_one: 'Average across {{count}} budget in {{year}}',
    avgInvestingTitle_other: 'Average across {{count}} budgets in {{year}}',
    investingRate: 'Investing Rate',
    investingRateTitle:
      'Invested ÷ overall income (new money, carryover excluded). On average the same for every month.',
  },
};

export default dashboard;
