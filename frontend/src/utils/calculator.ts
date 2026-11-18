/**
 * Minimal safe arithmetic evaluator for the entry calculator.
 *
 * Supports decimal numbers and + − × ÷ with standard operator
 * precedence (multiplication/division bind tighter than
 * addition/subtraction). Implemented as a hand-rolled tokenizer and
 * two-stack reduction instead of eval() so keyboard input can never
 * execute code.
 *
 * Returns the result, or null for incomplete/invalid expressions
 * (trailing operator, consecutive operators, division by zero, ...).
 */

type Op = '+' | '-' | '*' | '/';

type Token = { type: 'num'; value: number } | { type: 'op'; value: Op };

const PRECEDENCE: Record<Op, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

export function isOperatorChar(ch: string): boolean {
  return ch === '+' || ch === '-' || ch === '*' || ch === '/';
}

export function evaluateExpression(expr: string): number | null {
  const tokens = tokenize(expr);
  if (tokens === null) return null;
  return reduce(tokens);
}

function tokenize(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];

    if (ch === ' ') {
      i++;
      continue;
    }

    // Number: digits with at most one decimal point
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i;
      let dots = 0;
      while (
        j < expr.length &&
        ((expr[j] >= '0' && expr[j] <= '9') || expr[j] === '.')
      ) {
        if (expr[j] === '.') {
          dots++;
          if (dots > 1) return null;
        }
        j++;
      }
      const text = expr.slice(i, j);
      if (text === '.') return null;
      const value = Number(text);
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: 'num', value });
      i = j;
      continue;
    }

    // Operator: must follow a number (no leading operator, no doubles)
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      const prev = tokens[tokens.length - 1];
      if (!prev || prev.type !== 'num') return null;
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    return null; // any other character is invalid
  }

  // Empty, or trailing operator → incomplete expression
  if (tokens.length === 0) return null;
  if (tokens[tokens.length - 1].type === 'op') return null;
  return tokens;
}

function reduce(tokens: Token[]): number | null {
  const values: number[] = [];
  const ops: Op[] = [];

  const applyTop = (): boolean => {
    const op = ops.pop();
    const b = values.pop();
    const a = values.pop();
    if (op === undefined || a === undefined || b === undefined) return false;
    if (op === '+') values.push(a + b);
    else if (op === '-') values.push(a - b);
    else if (op === '*') values.push(a * b);
    else {
      if (b === 0) return false; // division by zero
      values.push(a / b);
    }
    return true;
  };

  for (const token of tokens) {
    if (token.type === 'num') {
      values.push(token.value);
      continue;
    }
    // Standard precedence: resolve stronger operators first
    while (
      ops.length > 0 &&
      PRECEDENCE[ops[ops.length - 1]] >= PRECEDENCE[token.value]
    ) {
      if (!applyTop()) return null;
    }
    ops.push(token.value);
  }
  while (ops.length > 0) {
    if (!applyTop()) return null;
  }

  const result = values[0];
  return values.length === 1 && Number.isFinite(result) ? result : null;
}
