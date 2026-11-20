/**
 * Budget-Detail-Texte — Detailseite, Einnahmen- und Kategorientabellen,
 * Summenleiste, Klon-Formular sowie die Excel-Import-, Kategorie-Drill-Down-
 * und Kategorie-Ausgaben-Modals.
 *
 * Die App duzt (informelle Anrede).
 */

const detail = {
  page: {
    backToDashboard: '← Zurück zum Dashboard',
    notFound: 'Budget nicht gefunden.',
    cloneButton: 'In neuen Monat klonen',
    cloneTooltip:
      'Dieses Budget für einen neuen Monat klonen (wiederkehrende Ausgaben)',
    exportButton: 'Excel exportieren',
    exporting: 'Wird exportiert…',
    exportTooltip:
      'Dieses Budget in eine Excel-Datei exportieren (gleiches Format wie die Importvorlage)',
    deleteButton: 'Löschen',
    deleteTooltip: 'Dieses Budget und alle zugehörigen Daten löschen',
    searchPlaceholder: 'Posten suchen…',
    deleteDialogTitle: 'Budget löschen',
    deleteConfirmMessage:
      'Bist du sicher, dass du <strong>{{title}}</strong> löschen möchtest? Dadurch werden alle Kategorien, Ausgabenposten und Einnahmen endgültig entfernt. Diese Aktion kann nicht rückgängig gemacht werden.',
    deleteConfirmLabel: 'Budget löschen',
    deleteErrorMessage:
      'Budget konnte nicht gelöscht werden. Bitte versuche es erneut.',
    addIncome: '+ Einnahme hinzufügen',
    incomeLabelPlaceholder: 'Bezeichnung der Einnahme (z. B. Gehalt)',
    add: 'Hinzufügen',
    categoriesHeading: 'Kategorien',
    addCategory: '+ Kategorie hinzufügen',
    categoryNamePlaceholder: 'Name der Kategorie (z. B. Wohnen)',
    noSearchResults: 'Keine Posten gefunden, die „{{query}}“ entsprechen.',
    noCategories:
      'Noch keine Kategorien. Füge eine Kategorie hinzu, um Ausgaben zu erfassen.',
  },
  income: {
    heading: 'Einnahmen',
    label: 'Bezeichnung',
    sollProjected: 'SOLL (Geplant)',
    istActual: 'IST (Tatsächlich)',
    difference: 'Differenz',
    empty: 'Noch keine Einnahmen vorhanden.',
  },
  category: {
    addItem: '+ Posten hinzufügen',
    deleteTooltip: 'Kategorie löschen',
    itemPlaceholder: 'Name des Postens',
    label: 'Bezeichnung',
    diff: 'Diff',
    empty: 'Keine Posten in dieser Kategorie.',
    subtotal: 'Zwischensumme',
  },
  summary: {
    sollTotalCosts: 'SOLL GESAMTKOSTEN',
    istTotalCosts: 'IST GESAMTKOSTEN',
    totalDifference: 'GESAMTUNTERSCHIED',
    sollBalance: 'SOLL BALANCE',
    istBalance: 'IST BALANCE',
    difference: 'UNTERSCHIED',
  },
  clone: {
    heading: 'Budget für einen neuen Monat klonen',
    description:
      'Kopiert alle Kategorien, Posten und Einnahmen. Die Ist-Beträge werden standardmäßig auf null gesetzt, damit du sie für den neuen Monat eintragen kannst.',
    titleLabel: 'Neuer Budgettitel',
    monthLabel: 'Monat',
    yearLabel: 'Jahr',
    copyActuals: 'Ist-Beträge auch kopieren',
    cloning: 'Wird geklont…',
    submit: 'Budget klonen',
  },
  excelImport: {
    title: 'Budget aus Excel importieren',
    invalidFileType: 'Bitte wähle eine .xlsx-Datei aus.',
    readError:
      'Die Excel-Datei konnte nicht gelesen werden. Bitte prüfe das Format.',
    noFile: 'Bitte wähle zuerst eine Datei aus.',
    importFailed: 'Import fehlgeschlagen. Bitte versuche es erneut.',
    dropzoneSelect: 'Klicken, um eine Excel-Datei auszuwählen',
    dropzoneFormat: '.xlsx-Format',
    previewTitle: 'Vorschau: {{title}}',
    previewSummary:
      '{{incomes}} Einnahmen, {{categories}} Kategorien, {{items}} Ausgabenposten',
    incomeHeading: 'Einnahmen',
    incomeAmounts: 'SOLL: {{projected}} € | IST: {{actual}} €',
    categoriesHeading: 'Kategorien',
    itemsCount_one: '{{name}} ({{count}} Posten)',
    itemsCount_other: '{{name}} ({{count}} Posten)',
    chooseDifferentFile: 'Andere Datei auswählen',
    uploading: 'Wird hochgeladen…',
    confirmImport: 'Import bestätigen',
  },
  drillDown: {
    title: '{{name}} — Posten',
    loading: 'Wird geladen…',
    empty: 'Keine Posten in dieser Kategorie.',
    item: 'Posten',
    difference: 'Differenz',
    trendHeading: 'Letzte 12 Monate (SOLL vs. IST)',
  },
  spending: {
    title: 'Kategorieausgaben {{year}} (IST)',
    loading: 'Wird geladen…',
    empty: 'Keine Ausgabenkategorien für dieses Jahr erfasst.',
    yearOnly: 'Nur {{year}}',
    compareWith: 'vs. {{year}}',
    compareTooltip: 'Mit {{year}} vergleichen',
    noCompareData: 'Keine Daten für {{year}} zum Vergleichen',
    legendSpent: 'Ausgegeben',
    legendYear: '{{year}} (IST)',
    category: 'Kategorie',
    total: 'Gesamt (IST)',
    delta: 'Δ vs. {{year}}',
  },
};

export default detail;
