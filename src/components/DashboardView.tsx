import { useState } from 'react';
import {
  ArrowDownLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleDollarSign,
  CreditCard, Eye, EyeOff, Plus, ReceiptText, Wallet,
} from 'lucide-react';
import { Category, CreditCard as Card, FixedExpense, Transaction } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { formatCurrency, formatDateDisplay, formatMonthYear, getCurrentMonthKey, getTodayDateString } from '../utils/formatters';
import { getNextMonthKey, getPreviousMonthKey, getTransactionCard, isTransactionInMonth } from '../utils/creditCardHelpers';

interface DashboardProps {
  categories: Category[];
  creditCards: Card[];
  fixedExpenses: FixedExpense[];
  transactions: Transaction[];
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  onAddCardPurchase: () => void;
  onAddFixed: () => void;
  onSetSalary: () => void;
  onAdjustFixed: (id: string, month: string) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onNavigateToTransactions: () => void;
  onNavigateToFixed: () => void;
}

export function DashboardView({
  categories, creditCards, fixedExpenses, transactions, selectedMonth, onChangeMonth, onAddCardPurchase,
  onAddFixed, onSetSalary, onAdjustFixed, onEditTransaction, onNavigateToTransactions, onNavigateToFixed,
}: DashboardProps) {
  const [hideBalance, setHideBalance] = useState(() => localStorage.getItem('financas_hide_balance') === 'true');
  const today = getTodayDateString();
  const currentMonth = getCurrentMonthKey();
  const money = (amount: number) => hideBalance ? '••••' : formatCurrency(amount);
  const monthEntries = transactions.filter((entry) => isTransactionInMonth(entry, selectedMonth, creditCards));
  const total = (entries: Transaction[]) => entries.reduce((sum, entry) => sum + Math.round(entry.amount * 100), 0) / 100;
  const income = total(monthEntries.filter((entry) => entry.type === 'income'));
  const expenses = monthEntries.filter((entry) => entry.type === 'expense');
  const cards = total(expenses.filter((entry) => entry.paymentMethod === 'credit'));
  const otherExpenses = total(expenses.filter((entry) => entry.paymentMethod !== 'credit'));
  const balance = (Math.round(income * 100) - Math.round((otherExpenses + cards) * 100)) / 100;
  const hasSalary = fixedExpenses.some((rule) => rule.type === 'income' && rule.active && rule.repeatMonthly !== false &&
    (rule.categoryId === 'cat-salario' || /salário|salario/i.test(rule.description)));

  const bills = transactions.flatMap((entry) => {
    if (entry.type !== 'expense' || !entry.fixedExpenseId || !entry.date.startsWith(selectedMonth)) return [];
    const rule = fixedExpenses.find((item) => item.id === entry.fixedExpenseId);
    if (!rule) return [];
    const status = rule.statusByMonth?.[selectedMonth];
    const paid = status === 'paid';
    const onCredit = entry.paymentMethod === 'credit';
    const overdue = !paid && !onCredit && entry.date < today;
    const label = paid ? 'Paga' : onCredit ? 'No cartão' : overdue ? 'Vencida' :
      rule.isVariable && status !== 'adjusted' ? 'Estimativa' : 'A pagar';
    return [{ entry, rule, paid, overdue, label }];
  }).sort((a, b) => Number(a.paid) - Number(b.paid) || a.entry.date.localeCompare(b.entry.date));

  const purchases = expenses.filter((entry) => entry.paymentMethod === 'credit' && !entry.isFixed && !entry.fixedExpenseId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="finance-dashboard">
      <div className="finance-page-heading">
        <div>
          <div className="finance-kicker"><span /> MEU CONTROLE FINANCEIRO</div>
          <h1>Visão geral</h1>
          <p>Seu dinheiro e seus compromissos do mês, em um só lugar.</p>
        </div>
        <div className="finance-month" aria-label="Navegação entre meses">
          <button type="button" aria-label="Mês anterior" onClick={() => onChangeMonth(getPreviousMonthKey(selectedMonth))}><ChevronLeft size={17} /></button>
          <button type="button" className="finance-month-current" onClick={() => onChangeMonth(currentMonth)}
            title="Voltar ao mês atual"><CalendarDays size={16} /> <span>{formatMonthYear(selectedMonth)}</span></button>
          <button type="button" aria-label="Próximo mês" onClick={() => onChangeMonth(getNextMonthKey(selectedMonth))}><ChevronRight size={17} /></button>
        </div>
      </div>

      <section className="finance-balance" aria-labelledby="balance-title">
        <div className="finance-balance-art" aria-hidden="true"><Wallet size={102} strokeWidth={1.1} /></div>
        <div className="finance-balance-content">
          <div className="finance-balance-label">
            <h2 id="balance-title">Saldo previsto do mês</h2>
            <button type="button" className="finance-eye" aria-label={hideBalance ? 'Mostrar valores' : 'Ocultar valores'} onClick={() => {
              localStorage.setItem('financas_hide_balance', String(!hideBalance));
              setHideBalance(!hideBalance);
            }}>{hideBalance ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
          <p className="finance-balance-value">{money(balance)}</p>
          <p className="finance-balance-note">Entradas menos contas, faturas e outros gastos do mês.</p>
          {!hasSalary && <button type="button" className="finance-salary" onClick={onSetSalary}>
            <Plus size={15} /> Configurar salário
          </button>}
        </div>
      </section>

      <div className="finance-metrics" aria-label="Resumo financeiro">
        <div className="finance-metric"><div className="finance-metric-icon income"><ArrowDownLeft size={19} /></div><div><p>Entradas</p><strong>{money(income)}</strong></div></div>
        <div className="finance-metric"><div className="finance-metric-icon bills"><ReceiptText size={18} /></div><div><p>Contas e outros gastos</p><strong>{money(otherExpenses)}</strong></div></div>
        <div className="finance-metric"><div className="finance-metric-icon credit"><CreditCard size={19} /></div><div><p>Faturas dos cartões</p><strong>{money(cards)}</strong></div></div>
      </div>

      <div className="finance-panels">
        <section className="finance-panel" aria-labelledby="bills-title">
          <div className="finance-panel-heading">
            <div><h2 id="bills-title">Contas do mês</h2><p>Acompanhe os vencimentos e ajuste os valores.</p></div>
            <button type="button" className="finance-link" onClick={onNavigateToFixed}>Ver contas <ArrowRight size={15} /></button>
          </div>
          {bills.length ? <>
            <div className="finance-list">
              {bills.slice(0, 5).map(({ entry, rule, paid, overdue, label }) => {
                const category = categories.find((item) => item.id === entry.categoryId);
                return <button key={entry.id} type="button" className="finance-row" onClick={() => onAdjustFixed(rule.id, selectedMonth)}>
                  <span className="finance-row-icon">{paid ? <Check size={18} /> : <CategoryIcon name={category?.icon ?? 'ReceiptText'} size={17} />}</span>
                  <span className="finance-row-main"><strong>{entry.description}</strong><small>Dia {Number(entry.date.slice(8))} <span aria-hidden="true">·</span> {rule.isVariable ? 'Valor variável' : 'Recorrente'}</small></span>
                  <span className="finance-row-end"><strong>{money(entry.amount)}</strong><small className={overdue ? 'overdue' : paid ? 'paid' : ''}>{label}</small></span>
                </button>;
              })}
            </div>
            <button type="button" className="finance-panel-action" onClick={onAddFixed}><Plus size={16} /> Nova conta</button>
          </> : <div className="finance-empty">
            <div className="finance-empty-icon"><ReceiptText size={23} strokeWidth={1.7} /></div>
            <h3>Nenhuma conta neste mês</h3>
            <p>Cadastre aluguel, luz, água ou internet uma vez e acompanhe todo mês.</p>
            <button type="button" className="finance-secondary" onClick={onAddFixed}><Plus size={16} /> Nova conta</button>
          </div>}
        </section>

        <section className="finance-panel" aria-labelledby="purchases-title">
          <div className="finance-panel-heading">
            <div><h2 id="purchases-title">Compras no cartão</h2><p>Últimos lançamentos nas faturas deste mês.</p></div>
            <button type="button" className="finance-link" onClick={onNavigateToTransactions}>Ver extrato <ArrowRight size={15} /></button>
          </div>
          {purchases.length ? <>
            <div className="finance-list">
              {purchases.slice(0, 5).map((entry) => {
                const card = getTransactionCard(entry, creditCards);
                const category = categories.find((item) => item.id === entry.categoryId);
                return <button key={entry.id} type="button" className="finance-row" onClick={() => onEditTransaction(entry)}>
                  <span className="finance-row-icon credit">{category ? <CategoryIcon name={category.icon} size={17} /> : <CreditCard size={17} />}</span>
                  <span className="finance-row-main"><strong>{entry.merchant || entry.description}</strong><small>{card?.name ?? 'Crédito'} <span aria-hidden="true">·</span> {formatDateDisplay(entry.date)}</small></span>
                  <span className="finance-row-end"><strong>{money(entry.amount)}</strong>{entry.installments && <small>{entry.installments.current}/{entry.installments.total}</small>}</span>
                </button>;
              })}
            </div>
            <button type="button" className="finance-panel-action" onClick={onAddCardPurchase}><Plus size={16} /> Lançar compra</button>
          </> : <div className="finance-empty">
            <div className="finance-empty-icon credit"><CreditCard size={24} strokeWidth={1.7} /></div>
            <h3>Nenhuma compra neste mês</h3>
            <p>Informe o valor e o cartão. A compra entra na fatura pelo dia de fechamento.</p>
            <button type="button" className="finance-secondary" onClick={onAddCardPurchase}><Plus size={16} /> Lançar compra</button>
          </div>}
        </section>
      </div>

      <p className="finance-footnote"><CircleDollarSign size={15} /> O saldo é uma previsão e pode incluir contas com valor estimado.</p>
    </div>
  );
}
