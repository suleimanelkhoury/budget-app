/**
 * Charts page strings — tabs, empty states, chart titles, series
 * (legend) names, and labels for ChartsPage. Informal "du" form.
 */

const charts = {
  title: 'Diagramme',
  tabs: {
    overall: 'Gesamt',
    monthly: 'Monatlich',
  },
  emptyState: {
    overall:
      'Keine Budgets vorhanden. Erstelle mindestens ein Budget, um Diagramme zu sehen.',
    monthly:
      'Keine Budgets vorhanden. Erstelle zuerst ein Budget, um Diagramme zu sehen.',
  },
  charts: {
    incomeVsExpenses: {
      title: 'Einkommen vs. Ausgaben (IST, Plan gestrichelt)',
    },
    balance: {
      title: 'Saldo im Zeitverlauf (Sparverlauf, Plan gestrichelt)',
    },
    topExpenses: {
      title: 'Top-Ausgabenposten (alle Budgets, IST)',
    },
    expensesByCategory: {
      title: 'Ausgaben nach Kategorie (SOLL vs. IST)',
    },
    expenseDistribution: {
      title: 'Ausgabenverteilung (IST)',
    },
    categoryVariance: {
      title:
        'Kategorie-Abweichung (SOLL − IST · Türkis = unter Budget, Terrakotta = über Budget)',
    },
    incomeVsExpensesSummary: {
      title: 'Einkommen vs. Ausgaben',
    },
  },
  series: {
    incomeGehaltExtra: 'Einkommen (Gehalt + Extra)',
    expensesActual: 'Ausgaben (IST)',
    expensesPlan: 'Ausgaben (Plan)',
    balanceActual: 'Saldo (IST)',
    balancePlan: 'Saldo (Plan)',
    spentIst: 'Ausgegeben (IST)',
    sollMinusIst: 'SOLL − IST',
  },
  labels: {
    selectBudget: 'Budget auswählen',
    projectedBalance: 'Geplanter Saldo (SOLL)',
    actualBalance: 'Tatsächlicher Saldo (IST)',
  },
  tip: 'Tipp: Klicke auf einen Balken oder ein Tortenstück, um die Posten dieser Kategorie zu sehen.',
};

export default charts;
