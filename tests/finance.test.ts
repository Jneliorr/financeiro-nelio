import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CreditCard, FixedExpense, Transaction } from '../src/types';
import { getCardBillingCycle, getCardSpend, getTransactionBillingMonth } from '../src/utils/creditCardHelpers';
import { parseDelimitedRows, parseFinancialAmount, parseFinancialDate, quoteSpreadsheetCell } from '../src/utils/delimitedData';
import { createFixedExpenseTransactions, getTransactionsWithMonthlyPlans, reviseFixedRule, updateFixedIncomeTransactions } from '../src/utils/fixedExpenseHelpers';

test('lê CSV e TSV com separadores, aspas e quebras de linha dentro dos campos', () => {
  const description = 'Padaria; "Centro"\nCompra';
  const csv = '\uFEFFData;Descrição;Valor\r\n2026-02-28;' + quoteSpreadsheetCell(description, ';') + ';12,50';
  assert.deepEqual(parseDelimitedRows(csv)[1], ['2026-02-28', description, '12,50']);
  assert.deepEqual(parseDelimitedRows('Data\tDescrição\tValor\n2026-02-28\tPadaria; Centro\t12.50')[1], ['2026-02-28', 'Padaria; Centro', '12.50']);
  assert.throws(() => parseDelimitedRows('Data;Descrição\n2026-02-28;"Padaria'));
  assert.equal(quoteSpreadsheetCell('  =1+1', ';'), "'  =1+1");
});

test('preserva centavos e rejeita valores e datas inválidos', () => {
  assert.equal(parseFinancialAmount('12.50'), 12.5);
  assert.equal(parseFinancialAmount('R$ 1.234,56'), 1234.56);
  assert.equal(parseFinancialAmount('R$ 3.500,75'), 3500.75);
  assert.equal(parseFinancialAmount('1,234.56'), 1234.56);
  assert.equal(parseFinancialAmount('12,50-'), -12.5);
  assert.equal(parseFinancialAmount('12,50 inválido'), null);
  assert.equal(parseFinancialDate('29/02/2024'), '2024-02-29');
  assert.equal(parseFinancialDate('29/02/2026'), null);
});

test('lança um salário já cadastrado no mês selecionado e atualiza as projeções em aberto', () => {
  const salary: FixedExpense = {
    id: 'salario', description: 'Salário', amount: 3000, type: 'income', categoryId: 'cat-salario',
    dueDay: 1, paymentMethod: 'pix', active: true,
    monthlyOverrides: { '2026-04': 3200 }, statusByMonth: { '2026-05': 'paid' },
  };
  const projected = createFixedExpenseTransactions([salary], [], [], '2026-01', 6);
  const saved = projected.filter((entry) => entry.date !== '2026-02-01');
  const updated = updateFixedIncomeTransactions(salary, { ...salary, amount: 3500.75 }, [], saved, '2026-02');

  assert.deepEqual(updated.map(({ date, amount, type }) => [date, amount, type]), [
    ['2026-02-01', 3500.75, 'income'],
    ['2026-03-01', 3500.75, 'income'],
    ['2026-04-01', 3200, 'income'],
    ['2026-06-01', 3500.75, 'income'],
  ]);
  assert.equal(updated.find((entry) => entry.date === '2026-03-01')?.id, projected[2].id);
});

const xp: CreditCard = { id: 'card-xp', name: 'Cartão XP', bankName: 'XP', closingDay: 31, dueDay: 5, color: '#000' };
const other: CreditCard = { ...xp, id: 'card-123', name: 'Outro cartão', bankName: 'Outro', closingDay: 15 };
const purchase: Transaction = {
  id: 'compra', description: 'Mercado', amount: 50, type: 'expense', categoryId: 'cat-mercado',
  date: '2026-02-28', paymentMethod: 'credit', creditCardId: other.id, tags: ['#CartãoXP'], createdAt: '',
};

test('conta compras vinculadas em apenas uma fatura, mesmo com tags antigas', () => {
  const cards = [xp, other];
  assert.equal(getCardSpend([purchase], xp, '2026-03', cards), 0);
  assert.equal(getCardSpend([purchase], other, '2026-03', cards), 50);
  assert.equal(getCardSpend([{ ...purchase, creditCardId: undefined }], xp, '2026-03', cards), 50);
});

test('usa o último dia do mês e a data de fechamento antecipado no ciclo', () => {
  assert.equal(getTransactionBillingMonth({ ...purchase, creditCardId: xp.id }, [xp]), '2026-03');
  assert.equal(getCardBillingCycle(xp, '2026-03').fullLabel, '28/02 a 30/03');

  const closed = { ...xp, closedInvoices: ['2026-02'], manualClosingDates: { '2026-02': '2026-02-20' } };
  assert.equal(getTransactionBillingMonth({ ...purchase, creditCardId: xp.id, date: '2026-02-20' }, [closed]), '2026-03');
  assert.equal(getCardBillingCycle(closed, '2026-02').endFormatted, '19/02');
  assert.equal(getCardBillingCycle(closed, '2026-03').startFormatted, '20/02');
});

test('projeta vencimentos reais sem sobrescrever lançamentos recorrentes existentes', () => {
  const fixed: FixedExpense = {
    id: 'aluguel', description: 'Aluguel', amount: 600, type: 'expense', categoryId: 'cat-casa',
    dueDay: 31, paymentMethod: 'pix', active: true, monthlyOverrides: { '2026-02': 650 },
  };
  const existing = { ...purchase, id: 'antigo', fixedExpenseId: fixed.id, date: '2026-01-30' };
  const entries = createFixedExpenseTransactions([fixed], [], [existing], '2026-01', 3);
  assert.deepEqual(entries.map(({ date, amount }) => [date, amount]), [['2026-02-28', 650], ['2026-03-31', 600]]);
});

test('repete sem limite de 12 meses e preserva a base histórica após um reajuste', () => {
  const water: FixedExpense = {
    id: 'agua', description: 'Água', amount: 100, type: 'expense', categoryId: 'cat-moradia',
    dueDay: 31, paymentMethod: 'pix', active: true, startsOnMonth: '2026-12', isVariable: true,
    monthlyOverrides: { '2027-02': 137.45 },
  };
  const salary: FixedExpense = {
    ...water, id: 'salario', description: 'Salário', amount: 3000, type: 'income', categoryId: 'cat-salario',
    dueDay: 5, repeatMonthly: true, monthlyOverrides: {},
  };
  const revisedWater = reviseFixedRule(water, { amount: 120, dueDay: 25 }, '2027-03', [], '2027-03');
  const entriesInMonth = (month: string) => getTransactionsWithMonthlyPlans([revisedWater, salary], [], [], month, '2027-03')
    .filter((entry) => entry.date.startsWith(month)).map(({ date, amount }) => [date, amount]);

  assert.deepEqual(entriesInMonth('2026-11'), []);
  assert.deepEqual(entriesInMonth('2027-01'), [['2027-01-31', 100], ['2027-01-05', 3000]]);
  assert.deepEqual(entriesInMonth('2027-02'), [['2027-02-28', 137.45], ['2027-02-05', 3000]]);
  assert.deepEqual(entriesInMonth('2028-08'), [['2028-08-25', 120], ['2028-08-05', 3000]]);
});

test('considera conta recorrente no cartão em apenas uma fatura e usa o valor confirmado', () => {
  const internet: FixedExpense = {
    id: 'internet', description: 'Internet', amount: 100, type: 'expense', categoryId: 'cat-moradia',
    dueDay: 25, paymentMethod: 'credit', creditCardId: other.id, active: true, startsOnMonth: '2026-02',
  };
  const confirmed = { ...purchase, fixedExpenseId: internet.id, date: '2026-02-25', amount: 92 };
  const entries = getTransactionsWithMonthlyPlans([internet], [], [confirmed], '2026-03', '2026-03');
  assert.equal(getCardSpend(entries, other, '2026-02', [other]), 0);
  assert.equal(getCardSpend(entries, other, '2026-03', [other]), 92);
  assert.equal(getCardSpend(entries, other, '2026-04', [other]), 100);
});
