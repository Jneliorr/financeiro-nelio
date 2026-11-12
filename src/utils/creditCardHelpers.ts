import { CreditCard, Transaction } from '../types';
import { calculateInstallmentDate, getDateInMonth } from './formatters';

const CARD_BRANDS = [
  { aliases: /\bmercado[\s-]*pago\b|\bmp(?:\*|\b)/i, card: /mercado[\s-]*pago|\bmp\b/i, defaultId: 'card-mercadopago' },
  { aliases: /\bxp\b|\bcart[aã]o[\s-]*xp\b/i, card: /\bxp\b|cart[aã]o[\s-]*xp/i, defaultId: 'card-xp' },
  { aliases: /\bnubank\b|\broxinho\b|^principal$/i, card: /\bnubank\b|\bprincipal\b/i, defaultId: 'card-principal' },
];

export function findMatchingCard(creditCards: CreditCard[], text: string): CreditCard | undefined {
  const value = text.trim().toLowerCase();
  if (!value) return undefined;
  const exact = creditCards.find((card) => card.id.toLowerCase() === value);
  if (exact) return exact;
  const name = value.replace(/\s+/g, '');
  const named = creditCards.find((card) => card.name.toLowerCase().replace(/\s+/g, '') === name);
  if (named) return named;

  const brand = CARD_BRANDS.find(({ aliases }) => aliases.test(value));
  if (!brand) return undefined;
  const matches = creditCards.filter((card) => brand.card.test([card.id, card.name, card.bankName].join(' ')));
  return matches.length === 1 ? matches[0] : matches.find((card) => card.id === brand.defaultId);
}

export function getTransactionCard(transaction: Transaction, creditCards: CreditCard[]): CreditCard | undefined {
  if (transaction.type !== 'expense' || transaction.paymentMethod !== 'credit') return undefined;
  if (transaction.creditCardId) {
    const exact = creditCards.find((card) => card.id === transaction.creditCardId);
    if (exact) return exact;
    // Generated IDs belong to a specific card even after it has been removed.
    if (/^card-\d+$/.test(transaction.creditCardId)) return undefined;
    return findMatchingCard(creditCards, transaction.creditCardId);
  }
  return findMatchingCard(creditCards, [
    ...(transaction.tags ?? []),
    transaction.merchant,
    transaction.description,
  ].join(' '));
}

export function getNextMonthKey(monthKey: string): string {
  return monthKey ? calculateInstallmentDate(monthKey + '-01', 1).slice(0, 7) : '';
}

export function getPreviousMonthKey(monthKey: string): string {
  return monthKey ? calculateInstallmentDate(monthKey + '-01', -1).slice(0, 7) : '';
}

export function isCardInvoiceClosed(card: CreditCard, monthKey: string): boolean {
  return card.closedInvoices?.includes(monthKey) ?? false;
}

function getInvoiceCutoff(card: CreditCard, month: string): string {
  const scheduled = getDateInMonth(month, card.closingDay || 25);
  const manual = isCardInvoiceClosed(card, month) ? card.manualClosingDates?.[month] : undefined;
  return manual && manual < scheduled ? manual : scheduled;
}

function getBillingMonth(date: string, card: CreditCard | undefined): string {
  if (!date) return '';
  let month = date.slice(0, 7);
  if (!card || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date)) return month;
  while (date >= getInvoiceCutoff(card, month)) {
    month = getNextMonthKey(month);
  }
  return month;
}

export function getTransactionBillingMonth(transaction: Transaction, creditCards: CreditCard[]): string {
  return getBillingMonth(transaction.date, getTransactionCard(transaction, creditCards));
}

export function isTransactionInMonth(transaction: Transaction, monthKey: string, creditCards: CreditCard[]): boolean {
  return !monthKey || getTransactionBillingMonth(transaction, creditCards) === monthKey;
}

export function getCardBillingCycle(card: CreditCard, monthKey: string) {
  const start = getInvoiceCutoff(card, getPreviousMonthKey(monthKey));
  const cutoff = getInvoiceCutoff(card, monthKey);
  const [year, month, day] = cutoff.split('-').map(Number);
  const lastDay = new Date(year, month - 1, day - 1);
  const endFormatted = String(lastDay.getDate()).padStart(2, '0') + '/' + String(lastDay.getMonth() + 1).padStart(2, '0');
  const startFormatted = start.slice(8, 10) + '/' + start.slice(5, 7);
  return {
    startFormatted,
    endFormatted,
    fullLabel: startFormatted + ' a ' + endFormatted,
    isClosed: isCardInvoiceClosed(card, monthKey),
    manualCloseDate: card.manualClosingDates?.[monthKey],
  };
}

export function getCardSpend(
  transactions: Transaction[],
  card: CreditCard,
  monthKey: string,
  creditCards: CreditCard[],
): number {
  return transactions.reduce((sum, entry) =>
    belongsToInvoice(entry, card, monthKey, creditCards) ? sum + entry.amount : sum, 0);
}

export function getTransactionsForCard(
  transactions: Transaction[],
  card: CreditCard,
  monthKey: string,
  creditCards: CreditCard[],
): Transaction[] {
  return transactions
    .filter((entry) => belongsToInvoice(entry, card, monthKey, creditCards))
    .sort((left, right) => right.date.localeCompare(left.date));
}

function belongsToInvoice(entry: Transaction, card: CreditCard, monthKey: string, creditCards: CreditCard[]) {
  return getTransactionCard(entry, creditCards)?.id === card.id && (!monthKey || getBillingMonth(entry.date, card) === monthKey);
}
