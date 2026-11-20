/**
 * Calculator strings — the Calculator page (keypad, budget overview,
 * balance card, delete confirmation).
 */

const calculator = {
  title: 'Calculator',
  budgetSelector: {
    label: 'Active Budget',
    lastEdited: 'Last edited: {{time}}',
    lastEditedTitle: 'Last edited {{time}}',
  },
  balance: {
    title: 'Balance',
    diffFromSoll: '≠ from projected',
  },
  income: {
    title: 'Income',
    empty: 'No income rows.',
  },
  category: {
    empty: 'No rows yet.',
    addRowTitle: 'Add a row to {{category}}',
  },
  row: {
    clickToSelect: 'Click to select — double-click to rename',
    deleteTitle: 'Delete {{label}}',
  },
  newRow: {
    placeholder: 'Row name, e.g. Lidl — Enter creates it',
  },
  errors: {
    newRowNameRequired: 'Enter a name for the new row.',
    nameRequired: 'Enter a name.',
  },
  deleteDialog: {
    title: 'Delete row',
    /** Used with the <Trans> component: <1> is the <strong> label. */
    message:
      'Delete <1>{{label}}</1> ({{context}})? Its amounts will be removed from the budget.',
    context: 'category {{category}}',
  },
  messages: {
    chooseRowFirst: 'Choose a row first (click it on the left).',
    amountRequired: 'Enter an amount (e.g. 5 or +5) first.',
    incompleteExpression: 'Incomplete expression — e.g. 23.40+5.',
  },
  tooltips: {
    roundUp:
      'Round the applied amount up to the next full euro (14.51 → 15.00, 3.00 → 4.00)',
    divide: 'Divide the row value',
    multiply: 'Multiply the row value',
    subtract: 'Subtract from the row value',
    add: 'Add to the row value',
    apply: 'Apply to the selected row (Enter)',
    evaluate: 'Evaluate in place (=)',
    istTag: 'Editing the actual value — click for the projected value',
    sollTag: 'Editing the projected value — click for the actual value',
  },
  flash: {
    set: 'Set "{{label}}" ({{field}}) to {{amount}} (was {{previous}}).',
    toMsci: ' — {{amount}} to {{label}}',
    fromMsci: ' — {{amount}} from {{label}}',
    roundedUp: ' (rounded up)',
  },
  preview: {
    set: '{{current}} → {{amount}}',
    operation: '{{current}} {{op}} {{typed}} = {{amount}}',
    toMsci: ' (+{{amount}} → {{label}})',
    fromMsci: ' (−{{amount}} from {{label}})',
    roundedUp: ' (rounded up)',
  },
};

export default calculator;
