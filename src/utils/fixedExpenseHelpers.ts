import { Category, FixedExpense, RecurringTerms, Transaction, TransactionType } from '../types';
import { calculateInstallmentDate, getDateInMonth } from './formatters';

export function recurringTerms(fixed: FixedExpense): RecurringTerms {
  const { description, merchant, amount, categoryId, dueDay, paymentMethod, creditCardId, isVariable } = fixed;
  return { description, merchant, amount, categoryId, dueDay, paymentMethod, creditCardId, isVariable };
}

export function fixedRuleForMonth(fixed: FixedExpense, month: string): FixedExpense {
  const version = Object.keys(fixed.monthlyVersions ?? {}).filter((key) => key <= month).sort().at(-1);
  if (!version) return fixed;
  // Explicitly clear optional fields when an older version did not have them.
  return { ...fixed, merchant: undefined, creditCardId: undefined, isVariable: undefined, ...fixed.monthlyVersions![version] };
}

export function isRecurring(fixed: FixedExpense): boolean {
  return fixed.repeatMonthly ?? (fixed.type === 'expense' || !/extra|esporadic/i.test(fixed.categoryId));
}

export function fixedStartMonth(fixed: FixedExpense, transactions: Transaction[], currentMonth: string): string {
  if (fixed.startsOnMonth) return fixed.startsOnMonth;
  let first = '';
  for (const entry of transactions) {
    const month = entry.date.slice(0, 7);
    if ((entry.fixedExpenseId === fixed.id || entry.id === `tx-fix-${fixed.id}-${month}`) && (!first || month < first)) first = month;
  }
  return first || currentMonth;
}

export function reviseFixedRule(
  target: FixedExpense, updated: Partial<FixedExpense>, month: string, transactions: Transaction[], currentMonth: string,
): FixedExpense {
  const start = fixedStartMonth(target, transactions, currentMonth);
  const effectiveMonth = month < start ? start : month;
  const baseline = fixedRuleForMonth(target, effectiveMonth);
  const versions = { [start]: recurringTerms(target), ...target.monthlyVersions };
  versions[effectiveMonth] = recurringTerms({ ...baseline, ...updated });
  const latest = Object.keys(versions).sort().at(-1)!;
  return { ...target, ...updated, ...versions[latest], startsOnMonth: start, monthlyVersions: versions };
}

export function getTransactionsWithMonthlyPlans(
  fixedExpenses: FixedExpense[], categories: Category[], transactions: Transaction[], month: string, currentMonth: string,
): Transaction[] {
  const entries = [...transactions];
  const recurring = fixedExpenses.filter((fixed) => fixed.active && isRecurring(fixed))
    .map((fixed) => ({ fixed, start: fixedStartMonth(fixed, transactions, currentMonth) }));
  // Include the adjacent calendar months for purchases crossing an invoice cutoff.
  for (const offset of [-1, 0, 1]) {
    const calendarMonth = calculateInstallmentDate(`${month}-01`, offset).slice(0, 7);
    const rules = recurring.filter(({ start }) => start <= calendarMonth).map(({ fixed }) => fixedRuleForMonth(fixed, calendarMonth));
    entries.push(...createFixedExpenseTransactions(rules, categories, transactions, calendarMonth, 1)
      .map((entry) => ({ ...entry, projected: true })));
  }
  return entries;
}

export function createFixedExpenseTransactions(
  fixedExpenses: FixedExpense[],
  categories: Category[],
  transactions: Transaction[],
  startMonth: string,
  months: number,
): Transaction[] {
  const existingIds = new Set(transactions.map((entry) => entry.id));
  const existingMonths = new Set(transactions.flatMap((entry) => entry.fixedExpenseId
    ? [`${entry.fixedExpenseId}:${entry.date.slice(0, 7)}`]
    : []));
  const createdAt = new Date().toISOString();
  const entries: Transaction[] = [];

  for (const fixed of fixedExpenses) {
    const category = categories.find((item) => item.id === fixed.categoryId);
    const tags = category ? [`#${category.name.split(' ')[0]}`, '#Fixo'] : ['#Fixo'];
    for (let offset = 0; offset < months; offset++) {
      const month = calculateInstallmentDate(`${startMonth}-01`, offset).slice(0, 7);
      const id = `tx-fix-${fixed.id}-${month}`;
      if (existingIds.has(id) || existingMonths.has(`${fixed.id}:${month}`)) continue;
      entries.push({
        id,
        description: fixed.description,
        merchant: fixed.merchant,
        amount: fixed.monthlyOverrides?.[month] ?? fixed.amount,
        type: fixed.type,
        categoryId: fixed.categoryId,
        tags,
        date: getDateInMonth(month, fixed.dueDay),
        paymentMethod: fixed.paymentMethod || 'pix',
        creditCardId: fixed.creditCardId,
        isFixed: true,
        fixedExpenseId: fixed.id,
        createdAt,
      });
    }
  }
  return entries;
}

export function updateFixedIncomeTransactions(
  previous: FixedExpense,
  updated: FixedExpense,
  categories: Category[],
  transactions: Transaction[],
  startMonth: string,
): Transaction[] {
  const currentMonthEntry = createFixedExpenseTransactions([updated], categories, transactions, startMonth, 1);
  const projectedEntries = transactions.flatMap((entry) => {
    const month = entry.date.slice(0, 7);
    const linked = entry.fixedExpenseId === updated.id || entry.id === `tx-fix-${updated.id}-${month}`;
    if (!linked || entry.type !== 'income' || month < startMonth || updated.statusByMonth?.[month] === 'paid') return [];

    const amount = updated.monthlyOverrides?.[month] ?? (entry.amount === previous.amount ? updated.amount : entry.amount);
    return [{ ...entry, description: updated.description, categoryId: updated.categoryId, amount }];
  });
  return [...currentMonthEntry, ...projectedEntries];
}

/**
 * Returns the effective amount for a fixed expense in a specific month (YYYY-MM).
 * Priority:
 * 1. Explicit monthlyOverride in fixed expense
 * 2. Generated/logged transaction for that month (e.g. tx-fix-...)
 * 3. Base/default template amount
 */
export const getFixedExpenseAmountForMonth = (
  fixed: FixedExpense,
  monthKey: string,
  transactions?: Transaction[]
): number => {
  if (fixed.monthlyOverrides && typeof fixed.monthlyOverrides[monthKey] === 'number') {
    return fixed.monthlyOverrides[monthKey];
  }

  if (transactions && transactions.length > 0) {
    const matchingTx = transactions.find(
      (t) =>
        (t.fixedExpenseId === fixed.id || t.id === `tx-fix-${fixed.id}-${monthKey}`) &&
        t.date.startsWith(monthKey)
    );
    if (matchingTx && typeof matchingTx.amount === 'number') {
      return matchingTx.amount;
    }
  }

  return fixedRuleForMonth(fixed, monthKey).amount;
};

export interface FixedExpenseMonthInfo {
  amount: number;
  baseAmount: number;
  isOverridden: boolean;
  isCustomized: boolean;
  status: 'paid' | 'adjusted' | 'estimated';
  associatedTransaction?: Transaction;
}

/**
 * Detailed status and values for a fixed expense in a given month.
 */
export const getFixedExpenseInfoForMonth = (
  fixed: FixedExpense,
  monthKey: string,
  transactions?: Transaction[]
): FixedExpenseMonthInfo => {
  fixed = fixedRuleForMonth(fixed, monthKey);
  const hasOverride =
    fixed.monthlyOverrides !== undefined && typeof fixed.monthlyOverrides[monthKey] === 'number';

  let matchingTx: Transaction | undefined;
  if (transactions && transactions.length > 0) {
    matchingTx = transactions.find(
      (t) =>
        (t.fixedExpenseId === fixed.id || t.id === `tx-fix-${fixed.id}-${monthKey}`) &&
        t.date.startsWith(monthKey)
    );
  }

  const effectiveAmount = hasOverride
    ? fixed.monthlyOverrides![monthKey]
    : matchingTx
    ? matchingTx.amount
    : fixed.amount;

  const isOverridden = hasOverride || (matchingTx !== undefined && matchingTx.amount !== fixed.amount);

  let status: 'paid' | 'adjusted' | 'estimated' = 'estimated';
  if (fixed.statusByMonth && fixed.statusByMonth[monthKey]) {
    status = fixed.statusByMonth[monthKey];
  } else if (isOverridden) {
    status = 'adjusted';
  }

  return {
    amount: effectiveAmount,
    baseAmount: fixed.amount,
    isOverridden,
    isCustomized: isOverridden || fixed.isVariable === true,
    status,
    associatedTransaction: matchingTx,
  };
};

/**
 * Sums all active fixed expenses or incomes for a given month.
 */
export const getTotalFixedForMonth = (
  fixedExpenses: FixedExpense[],
  monthKey: string,
  type: TransactionType = 'expense',
  transactions?: Transaction[]
): number => {
  return fixedExpenses
    .filter((f) => f.active && f.type === type)
    .reduce((sum, f) => sum + getFixedExpenseAmountForMonth(f, monthKey, transactions), 0);
};
