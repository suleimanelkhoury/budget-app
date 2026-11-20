/**
 * Rechner-Texte — die Rechner-Seite (Tastenfeld, Budgetübersicht,
 * Saldo-Karte, Lösch-Bestätigung).
 *
 * Die App duzt (informelle Anrede). SOLL/IST bleiben unübersetzt.
 */

const calculator = {
  title: 'Rechner',
  budgetSelector: {
    label: 'Aktives Budget',
    lastEdited: 'Zuletzt bearbeitet: {{time}}',
    lastEditedTitle: 'Zuletzt bearbeitet {{time}}',
  },
  balance: {
    title: 'Saldo',
    diffFromSoll: '≠ von SOLL',
  },
  income: {
    title: 'Einnahmen',
    empty: 'Keine Einnahmezeilen.',
  },
  category: {
    empty: 'Noch keine Zeilen.',
    addRowTitle: 'Zeile zu {{category}} hinzufügen',
  },
  row: {
    clickToSelect: 'Klicken zum Auswählen — Doppelklick zum Umbenennen',
    deleteTitle: '{{label}} löschen',
  },
  newRow: {
    placeholder: 'Zeilenname, z. B. Lidl — Enter legt sie an',
  },
  errors: {
    newRowNameRequired: 'Gib einen Namen für die neue Zeile ein.',
    nameRequired: 'Gib einen Namen ein.',
  },
  deleteDialog: {
    title: 'Zeile löschen',
    /** Für die <Trans>-Komponente: <1> ist das <strong>-Label. */
    message:
      '<1>{{label}}</1> ({{context}}) löschen? Die Beträge werden aus dem Budget entfernt.',
    context: 'Kategorie {{category}}',
  },
  messages: {
    chooseRowFirst: 'Wähle zuerst eine Zeile aus (klicke sie links an).',
    amountRequired: 'Gib zuerst einen Betrag ein (z. B. 5 oder +5).',
    incompleteExpression: 'Unvollständiger Ausdruck — z. B. 23.40+5.',
  },
  tooltips: {
    roundUp:
      'Rundet den anzuwendenden Betrag auf den nächsten vollen Euro auf (14,51 → 15,00, 3,00 → 4,00)',
    divide: 'Teilt den Zeilenwert',
    multiply: 'Multipliziert den Zeilenwert',
    subtract: 'Zieht vom Zeilenwert ab',
    add: 'Addiert zum Zeilenwert',
    apply: 'Auf die ausgewählte Zeile anwenden (Enter)',
    evaluate: 'An Ort und Stelle auswerten (=)',
    istTag: 'Bearbeitet den IST-Wert — Klick wechselt zu SOLL',
    sollTag: 'Bearbeitet den SOLL-Wert — Klick wechselt zu IST',
  },
  flash: {
    set: '„{{label}}" ({{field}}) auf {{amount}} gesetzt (war {{previous}}).',
    toMsci: ' — {{amount}} an {{label}}',
    fromMsci: ' — {{amount}} von {{label}}',
    roundedUp: ' (aufgerundet)',
  },
  preview: {
    set: '{{current}} → {{amount}}',
    operation: '{{current}} {{op}} {{typed}} = {{amount}}',
    toMsci: ' (+{{amount}} → {{label}})',
    fromMsci: ' (−{{amount}} von {{label}})',
    roundedUp: ' (aufgerundet)',
  },
};

export default calculator;
