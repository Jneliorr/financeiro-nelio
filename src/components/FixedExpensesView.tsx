import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Edit2,
  Check,
  Zap,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';
import { FixedExpense, Category, CreditCard, Transaction, TransactionType } from '../types';
import { formatCurrency, formatMonthYear, getDateInMonth } from '../utils/formatters';
import { normalizeHeader, parseFinancialAmount } from '../utils/delimitedData';
import {
  getFixedExpenseAmountForMonth,
  getFixedExpenseInfoForMonth,
  getTotalFixedForMonth,
  fixedRuleForMonth,
  fixedStartMonth,
  isRecurring,
} from '../utils/fixedExpenseHelpers';
import { CategoryIcon } from './CategoryIcon';

export type FixedFormRequest = { kind: 'new'; type: TransactionType } | { kind: 'adjust'; id: string };

interface FixedExpensesViewProps {
  fixedExpenses: FixedExpense[];
  categories: Category[];
  creditCards: CreditCard[];
  selectedMonth: string;
  onChangeMonth?: (month: string) => void;
  transactions?: Transaction[];
  onAddFixedExpense: (item: Omit<FixedExpense, 'id'>) => Promise<boolean>;
  onUpdateFixedExpense: (id: string, updated: Partial<FixedExpense>) => Promise<boolean>;
  onUpdateFixedMonthlyAmount: (
    fixedId: string,
    monthKey: string,
    newAmount: number,
    updateDefault: boolean,
    status?: 'estimated' | 'adjusted' | 'paid'
  ) => Promise<boolean>;
  onDeleteFixedExpense: (id: string, deleteGeneratedTxs?: boolean) => void;
  formRequest?: FixedFormRequest | null;
  onConsumeFormRequest?: () => void;
}

export const FixedExpensesView: React.FC<FixedExpensesViewProps> = ({
  fixedExpenses,
  categories,
  creditCards,
  selectedMonth,
  onChangeMonth,
  transactions = [],
  onAddFixedExpense,
  onUpdateFixedExpense,
  onUpdateFixedMonthlyAmount,
  onDeleteFixedExpense,
  formRequest,
  onConsumeFormRequest,
}) => {
  // Navigation / Filter states
  const [filterMode, setFilterMode] = useState<'all' | 'variable' | 'stable' | 'income'>('all');
  
  // Modals
  const [isAddFixedOpen, setIsAddFixedOpen] = useState(false);
  const [editingBaseFixed, setEditingBaseFixed] = useState<FixedExpense | null>(null);
  const [adjustingFixed, setAdjustingFixed] = useState<FixedExpense | null>(null);
  const [pendingDeleteFixed, setPendingDeleteFixed] = useState<FixedExpense | null>(null);

  // Monthly Invoice Adjustment form state
  const [adjustmentAmountStr, setAdjustmentAmountStr] = useState('');
  const [adjustmentUpdateDefault, setAdjustmentUpdateDefault] = useState(false);
  const [adjustmentIsPaid, setAdjustmentIsPaid] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState('');
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  // New/Edit Base Fixed form state
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [incomeSubtype, setIncomeSubtype] = useState<'salario' | 'esporadica'>('salario');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [dueDay, setDueDay] = useState<number>(5);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit' | 'debit' | 'transfer'>('pix');
  const [creditCardId, setCreditCardId] = useState(creditCards[0]?.id || '');
  const [isVariable, setIsVariable] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSavingFixed, setIsSavingFixed] = useState(false);

  // Month Navigation helpers
  const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = selectedMonth === currentMonthKey;

  const handlePrevMonth = () => {
    if (!onChangeMonth) return;
    const d = new Date(yearNum, monthNum - 2, 1);
    onChangeMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    if (!onChangeMonth) return;
    const d = new Date(yearNum, monthNum, 1);
    onChangeMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleGoCurrentMonth = () => {
    if (!onChangeMonth) return;
    onChangeMonth(currentMonthKey);
  };

  // Open adjustment modal for a specific fixed expense
  const openAdjustmentModal = (item: FixedExpense) => {
    const info = getFixedExpenseInfoForMonth(item, selectedMonth, transactions);
    setAdjustingFixed(item);
    setAdjustmentAmountStr(info.amount.toFixed(2).replace('.', ','));
    setAdjustmentUpdateDefault(false);
    setAdjustmentIsPaid(info.status === 'paid');
    setAdjustmentError('');
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingFixed || savingAdjustment) return;
    const num = parseFinancialAmount(adjustmentAmountStr);
    if (num === null || num < 0) {
      setAdjustmentError('Informe um valor válido.');
      return;
    }
    setSavingAdjustment(true);
    try {
      const saved = await onUpdateFixedMonthlyAmount(adjustingFixed.id, selectedMonth, num, adjustmentUpdateDefault, adjustmentIsPaid ? 'paid' : 'adjusted');
      if (saved) setAdjustingFixed(null);
      else setAdjustmentError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSavingAdjustment(false);
    }
  };

  // Open modal to add or edit base info
  const openNewFixedModal = (initialType: TransactionType = 'expense') => {
    setSaveError('');
    setEditingBaseFixed(null);
    setDescription(initialType === 'income' ? 'Salário' : '');
    setMerchant('');
    setAmountStr('');
    setType(initialType);
    setIncomeSubtype('salario');
    setCategoryId(categories.find((c) => c.id === (initialType === 'expense' ? 'cat-moradia' : 'cat-salario'))?.id ||
      categories.find((c) => c.type === initialType)?.id || '');
    setDueDay(5);
    setPaymentMethod('pix');
    setCreditCardId(creditCards[0]?.id || '');
    setIsVariable(false);
    setIsAddFixedOpen(true);
  };

  useEffect(() => {
    if (!formRequest) return;
    if (formRequest.kind === 'new') openNewFixedModal(formRequest.type);
    else {
      const rule = fixedExpenses.find((item) => item.id === formRequest.id);
      if (rule) {
        setFilterMode(rule.type === 'income' ? 'income' : 'all');
        openAdjustmentModal(fixedRuleForMonth(rule, selectedMonth));
      }
    }
    onConsumeFormRequest?.();
  }, [formRequest]);

  const openEditBaseFixedModal = (item: FixedExpense) => {
    setSaveError('');
    setEditingBaseFixed(item);
    setDescription(item.description);
    setMerchant(item.merchant || '');
    setAmountStr(item.amount.toFixed(2).replace('.', ','));
    setType(item.type);
    const category = categories.find((entry) => entry.id === item.categoryId);
    setIncomeSubtype(item.categoryId === 'cat-extra' || /extra|esporadic/.test(normalizeHeader(category?.name ?? '')) ? 'esporadica' : 'salario');
    setCategoryId(item.categoryId);
    setDueDay(item.dueDay || 5);
    setPaymentMethod(item.paymentMethod as any);
    setCreditCardId(item.creditCardId || creditCards[0]?.id || '');
    setIsVariable(item.isVariable ?? (item.type === 'expense'));
    setIsAddFixedOpen(true);
  };

  const handleSaveBaseFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingFixed) return;
    const amount = parseFinancialAmount(amountStr);
    if (!description.trim() || amount === null || amount <= 0) {
      setSaveError('Informe uma descrição e um valor válido maior que zero.');
      return;
    }

    let effectiveCategoryId = categoryId;
    if (type === 'income') {
      const pattern = incomeSubtype === 'salario' ? /salario/ : /extra|esporadic/;
      const incomeCategories = categories.filter((entry) => entry.type === 'income');
      effectiveCategoryId = incomeCategories.find((entry) => pattern.test(normalizeHeader(entry.name)))?.id
        ?? incomeCategories.find((entry) => entry.id === categoryId)?.id
        ?? incomeCategories[0]?.id
        ?? (incomeSubtype === 'salario' ? 'cat-salario' : 'cat-extra');
    } else if (!categories.some((item) => item.type === 'expense' && item.id === categoryId)) {
      setSaveError('Escolha uma categoria de despesa.');
      return;
    }

    const salary = type === 'income' && incomeSubtype === 'salario';
    if (type === 'expense' && paymentMethod === 'credit' && !creditCards.some((card) => card.id === creditCardId)) {
      setSaveError('Escolha um cartão ou outra forma de pagamento.');
      return;
    }
    const entry: Omit<FixedExpense, 'id'> = {
      description: description.trim(),
      merchant: merchant.trim() || undefined,
      amount,
      type,
      categoryId: effectiveCategoryId,
      dueDay,
      paymentMethod: type === 'income' ? 'pix' : paymentMethod,
      creditCardId: type === 'expense' && paymentMethod === 'credit' ? creditCardId : undefined,
      active: editingBaseFixed?.active ?? true,
      isVariable: type === 'expense' && isVariable,
      repeatMonthly: type === 'expense' || salary,
    };

    setIsSavingFixed(true);
    setSaveError('');
    try {
      const saved = editingBaseFixed
        ? await onUpdateFixedExpense(editingBaseFixed.id, entry)
        : await onAddFixedExpense(entry);
      if (!saved) {
        setSaveError('Não foi possível salvar. Verifique a conexão e tente novamente.');
        return;
      }
      if (type === 'income') setFilterMode('income');
      setIsAddFixedOpen(false);
      setEditingBaseFixed(null);
    } finally {
      setIsSavingFixed(false);
    }
  };

  // Totals calculated for the selected month!
  const monthRules = fixedExpenses.filter((fixed) => {
    const hasEntry = transactions.some((entry) => entry.fixedExpenseId === fixed.id && entry.date.startsWith(selectedMonth));
    return hasEntry || (fixed.active && isRecurring(fixed) && fixedStartMonth(fixed, transactions, currentMonthKey) <= selectedMonth);
  }).map((fixed) => fixedRuleForMonth(fixed, selectedMonth));
  const totalFixedIncomeMonth = getTotalFixedForMonth(monthRules, selectedMonth, 'income', transactions);
  const totalFixedExpenseMonth = getTotalFixedForMonth(monthRules, selectedMonth, 'expense', transactions);
  const fixedNetBalanceMonth = totalFixedIncomeMonth - totalFixedExpenseMonth;

  // Filter items
  const filteredItems = monthRules.filter((item) => {
    if (filterMode === 'income') return item.type === 'income';
    if (item.type !== 'expense') return false;
    if (filterMode === 'variable') return item.isVariable === true;
    if (filterMode === 'stable') return item.isVariable !== true;
    return true;
  });

  const adjustedInSelectedMonthCount = monthRules.filter(
    (f) => f.active && f.type === 'expense' && getFixedExpenseInfoForMonth(f, selectedMonth, transactions).isOverridden
  ).length;

  return (
    <div className="space-y-4 pb-4">
      {/* 1. Header with Title & Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-sage-900">
            Recorrências
          </h3>
          <p className="text-[11px] text-sage-500">
            Cadastre uma vez e ajuste o valor de cada mês quando precisar.
          </p>
        </div>
        <button
          onClick={() => openNewFixedModal(filterMode === 'income' ? 'income' : 'expense')}
          className="px-3 py-1.5 bg-pine-600 hover:bg-pine-800 active:scale-[0.98] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-[0_2px_8px_rgba(26,100,72,0.25)] transition-all"
        >
          <Plus size={14} className="text-white" />
          <span>{filterMode === 'income' ? 'Nova entrada' : 'Nova conta'}</span>
        </button>
      </div>

      {/* 2. Month Selector Header (Apple HIG Segmented Bar) */}
      <div className="bg-white rounded-[20px] p-2.5 border border-black/[0.04] shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex items-center justify-between gap-2">
        <button
          onClick={handlePrevMonth}
          className="w-8 h-8 rounded-full flex items-center justify-center text-sage-900 hover:bg-black/[0.04] active:scale-95 transition-transform"
          title="Mês anterior"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-sage-900 tracking-tight">
            <Calendar size={14} className="text-pine-600" />
            <span className="capitalize">{formatMonthYear(selectedMonth)}</span>
          </div>

          {!isCurrentMonth && (
            <button
              onClick={handleGoCurrentMonth}
              className="text-[10px] font-semibold text-pine-600 bg-pine-600/10 px-2 py-0.5 rounded-full hover:bg-pine-600/20 transition-colors"
            >
              Mês Atual
            </button>
          )}
        </div>

        <button
          onClick={handleNextMonth}
          className="w-8 h-8 rounded-full flex items-center justify-center text-sage-900 hover:bg-black/[0.04] active:scale-95 transition-transform"
          title="Próximo mês"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* 3. Monthly Metrics Summary (Apple Health Metrics Style) */}
      {monthRules.length > 0 && (
        <div className="bg-white rounded-[22px] p-3.5 sm:p-4 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-pine-700/10 rounded-[16px] text-center border border-pine-700/15">
              <p className="text-[10px] font-semibold text-pine-700 uppercase tracking-wider mb-0.5">
                Ganhos Fixos
              </p>
              <p className="text-xs sm:text-sm font-semibold tabular-nums text-pine-950 truncate">
                +{formatCurrency(totalFixedIncomeMonth)}
              </p>
            </div>

            <div className="p-2.5 bg-rose-700/10 rounded-[16px] text-center border border-rose-700/15">
              <p className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider mb-0.5">
                Gastos Fixos
              </p>
              <p className="text-xs sm:text-sm font-semibold tabular-nums text-rose-950 truncate">
                -{formatCurrency(totalFixedExpenseMonth)}
              </p>
            </div>

            <div className="p-2.5 bg-pine-600/10 rounded-[16px] text-center border border-pine-600/15">
              <p className="text-[10px] font-semibold text-pine-600 uppercase tracking-wider mb-0.5">
                Sobra Prevista
              </p>
              <p
                className={`text-xs sm:text-sm font-semibold tabular-nums truncate ${
                  fixedNetBalanceMonth >= 0 ? 'text-pine-600' : 'text-rose-700'
                }`}
              >
                {formatCurrency(fixedNetBalanceMonth)}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-black/[0.04] flex items-center justify-between text-[11px] text-sage-500">
            <span className="flex items-center gap-1.5 text-sage-900">
              <Sparkles size={12} className="text-pine-600" />
              <span>
                {adjustedInSelectedMonthCount > 0 ? (
                  <strong className="text-pine-700">
                    {adjustedInSelectedMonthCount} {adjustedInSelectedMonthCount === 1 ? 'fatura ajustada' : 'faturas ajustadas'}
                  </strong>
                ) : (
                  'Valores estimados de base'
                )}{' '}
                em {formatMonthYear(selectedMonth)}
              </span>
            </span>

          </div>
        </div>
      )}

      {/* 4. Filter Tabs (Apple Segmented Bar) */}
      <div className="flex items-center justify-center p-1 bg-black/[0.05] rounded-full gap-1">
        <button
          onClick={() => setFilterMode('all')}
          className={`flex-1 py-1 px-2 rounded-full text-[11px] font-semibold transition-all ${
            filterMode === 'all'
              ? 'bg-white text-sage-900 shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
              : 'text-sage-500 hover:text-sage-900'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilterMode('variable')}
          className={`flex-1 py-1 px-2 rounded-full text-[11px] font-semibold transition-all flex items-center justify-center gap-1 ${
            filterMode === 'variable'
              ? 'bg-white text-pine-700 shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
              : 'text-sage-500 hover:text-sage-900'
          }`}
        >
          <Zap size={11} />
          <span>Variáveis (Consumo)</span>
        </button>
        <button
          onClick={() => setFilterMode('stable')}
          className={`flex-1 py-1 px-2 rounded-full text-[11px] font-semibold transition-all ${
            filterMode === 'stable'
              ? 'bg-white text-sage-900 shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
              : 'text-sage-500 hover:text-sage-900'
          }`}
        >
          Estáveis
        </button>
        <button
          onClick={() => setFilterMode('income')}
          className={`flex-1 py-1 px-2 rounded-full text-[11px] font-semibold transition-all ${
            filterMode === 'income'
              ? 'bg-white text-pine-700 shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
              : 'text-sage-500 hover:text-sage-900'
          }`}
        >
          Entradas
        </button>
      </div>

      {/* 5. Fixed Expenses List */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="p-8 bg-white rounded-[22px] border border-dashed border-black/[0.08] text-center">
            <p className="text-xs font-semibold text-sage-900 mb-1">
              {filterMode === 'income' ? 'Nenhuma entrada fixa cadastrada' : 'Nenhum gasto fixo nesta categoria'}
            </p>
            <p className="text-[11px] text-sage-500 mb-3">
              Cadastre contas recorrentes como Água, Luz, Internet, Aluguel e Salário.
            </p>
            <button
              onClick={() => openNewFixedModal(filterMode === 'income' ? 'income' : 'expense')}
              className="px-3.5 py-1.5 bg-pine-600 hover:bg-pine-800 text-white rounded-full text-xs font-semibold inline-flex items-center gap-1.5 shadow-[0_2px_8px_rgba(26,100,72,0.25)]"
            >
              <Plus size={14} />
              {filterMode === 'income' ? 'Cadastrar entrada' : 'Cadastrar conta'}
            </button>
          </div>
        ) : (
          filteredItems.map((item) => {
            const cat = categories.find((c) => c.id === item.categoryId);
            const card = creditCards.find((c) => c.id === item.creditCardId);
            const isExpense = item.type === 'expense';
            const monthInfo = getFixedExpenseInfoForMonth(item, selectedMonth, transactions);

            return (
              <div
                key={item.id}
                className="p-3.5 bg-white rounded-[20px] border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:border-black/[0.08]"
              >
                {/* Item Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-[14px] flex items-center justify-center shrink-0 border border-black/[0.04] ${
                      isExpense
                        ? item.isVariable
                          ? 'bg-pine-700/10 text-pine-700'
                          : 'bg-rose-700/10 text-rose-700'
                        : 'bg-pine-700/10 text-pine-700'
                    }`}
                  >
                    {isExpense ? (
                      <CategoryIcon
                        name={cat?.icon || 'ReceiptText'}
                        size={17}
                        color={cat?.color || 'var(--color-pine-700)'}
                      />
                    ) : (
                      <ArrowUpRight size={17} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-sage-900 truncate">
                        {item.description}
                      </p>

                      {/* Variable indicator */}
                      {isExpense && item.isVariable && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-pine-700/10 text-pine-700 font-semibold rounded-full flex items-center gap-0.5">
                          <Zap size={9} />
                          Variável
                        </span>
                      )}

                      {/* Status indicator for selected month */}
                      {isExpense && monthInfo.isOverridden && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-pine-700/15 text-pine-700 font-semibold rounded-full flex items-center gap-0.5">
                          <Check size={9} />
                          Ajustada
                        </span>
                      )}
                      {isExpense && monthInfo.status === 'paid' && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-pine-600/15 text-pine-600 font-semibold rounded-full">
                          Pago
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-sage-500 mt-0.5 flex-wrap">
                      {isExpense ? (
                        <>
                          {item.merchant && (
                            <span className="text-sage-900 font-medium">{item.merchant} •</span>
                          )}
                          <span>Vencimento dia {Number(getDateInMonth(selectedMonth, item.dueDay).slice(8))}</span>
                          <span>•</span>
                          {card ? (
                            <span className="text-pine-700 font-semibold">{card.name.split(' ')[0]}</span>
                          ) : (
                            <span className="uppercase">{item.paymentMethod}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-pine-700 font-medium">
                          {cat?.name || 'Entrada / Salário'} · Dia {Number(getDateInMonth(selectedMonth, item.dueDay).slice(8))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/[0.04]">
                  {/* Values */}
                  <div className="text-left sm:text-right">
                    <span
                      className={`text-sm sm:text-base font-semibold tabular-nums block ${
                        isExpense ? 'text-sage-900' : 'text-pine-700'
                      }`}
                    >
                      {isExpense ? '- ' : '+ '}
                      {formatCurrency(monthInfo.amount)}
                    </span>
                    {isExpense && monthInfo.isOverridden && (
                      <span className="text-[10px] text-sage-500 tabular-nums block">
                        Base: {formatCurrency(item.amount)}
                      </span>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1.5">
                    {(isExpense || isRecurring(item)) && (
                      <button
                        onClick={() => openAdjustmentModal(item)}
                        className="px-2.5 py-1 bg-pine-600/10 hover:bg-pine-600/20 active:scale-95 text-pine-600 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all"
                        title={`Ajustar fatura de ${formatMonthYear(selectedMonth)}`}
                      >
                        <SlidersHorizontal size={11} />
                        <span>Ajustar Mês</span>
                      </button>
                    )}

                    <button
                      onClick={() => openEditBaseFixedModal(item)}
                      className="p-1.5 text-sage-500 hover:text-sage-900 hover:bg-black/[0.04] rounded-full transition-colors"
                      title="Editar cadastro base"
                    >
                      <Edit2 size={13} />
                    </button>

                    <button
                      onClick={() => setPendingDeleteFixed(item)}
                      className="p-1.5 text-sage-500 hover:text-rose-700 hover:bg-rose-700/10 rounded-full transition-colors"
                      title="Excluir fixo"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 6. Modal: Ajustar Fatura do Mês Selecionado */}
      {adjustingFixed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pine-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-5 space-y-4 shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-black/[0.04]">
            <div>
              <div className="flex items-center gap-1.5 text-pine-600 text-xs font-semibold uppercase tracking-wider mb-1">
                <SlidersHorizontal size={13} />
                <span>Ajuste do mês</span>
              </div>
              <h4 className="text-sm font-semibold text-sage-900">
                {adjustingFixed.description}
              </h4>
              <p className="text-[11px] text-sage-500">
                Valor de <strong className="text-sage-900 capitalize">{formatMonthYear(selectedMonth)}</strong>
              </p>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div>
                <label htmlFor="fixed-month-amount" className="block text-[10px] font-semibold text-sage-500 uppercase tracking-wider mb-1">
                  Valor deste mês (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-sage-500">
                    R$
                  </span>
                  <input
                    id="fixed-month-amount"
                    type="text"
                    inputMode="decimal"
                    required
                    autoFocus
                    placeholder="0,00"
                    value={adjustmentAmountStr}
                    onChange={(e) => setAdjustmentAmountStr(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-black/[0.1] rounded-[16px] text-base font-semibold tabular-nums text-sage-900 focus:outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
                  />
                </div>
                <p className="text-[10px] text-sage-500 mt-1">
                  Valor base padrão atual: {formatCurrency(adjustingFixed.amount)}
                </p>
              </div>

              {/* Scope options (Apple Radio Cards) */}
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold text-sage-500 uppercase tracking-wider">
                  Escopo da alteração
                </label>

                <label
                  onClick={() => setAdjustmentUpdateDefault(false)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-[16px] border cursor-pointer transition-all ${
                    !adjustmentUpdateDefault
                      ? 'bg-pine-600/5 border-pine-600 text-sage-900'
                      : 'border-black/[0.08] hover:bg-black/[0.02] text-sage-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={!adjustmentUpdateDefault}
                    onChange={() => setAdjustmentUpdateDefault(false)}
                    className="mt-0.5 text-pine-600 focus:ring-pine-600"
                  />
                  <div>
                    <span className="text-xs font-semibold block text-sage-900">
                      Apenas em {formatMonthYear(selectedMonth)}
                    </span>
                    <span className="text-[10px] text-sage-500 leading-tight block">
                      Ideal para oscilação natural de consumo (água, luz, gás). Os outros meses mantêm a base.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setAdjustmentUpdateDefault(true)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-[16px] border cursor-pointer transition-all ${
                    adjustmentUpdateDefault
                      ? 'bg-pine-600/5 border-pine-600 text-sage-900'
                      : 'border-black/[0.08] hover:bg-black/[0.02] text-sage-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={adjustmentUpdateDefault}
                    onChange={() => setAdjustmentUpdateDefault(true)}
                    className="mt-0.5 text-pine-600 focus:ring-pine-600"
                  />
                  <div>
                    <span className="text-xs font-semibold block text-sage-900">
                      Neste mês e atualizar valor padrão futuro
                    </span>
                    <span className="text-[10px] text-sage-500 leading-tight block">
                      Ideal para reajustes de contrato ou planos definitivos (ex: plano de internet subiu).
                    </span>
                  </div>
                </label>
              </div>

              {/* Paid Status Checkbox */}
              <label className="flex items-center gap-2.5 p-2.5 bg-black/[0.02] rounded-[16px] border border-black/[0.05] cursor-pointer">
                <input
                  type="checkbox"
                  checked={adjustmentIsPaid}
                  onChange={(e) => setAdjustmentIsPaid(e.target.checked)}
                  className="w-4 h-4 text-pine-700 rounded-[4px] focus:ring-pine-700"
                />
                <span className="text-xs font-medium text-sage-900">
                  {adjustingFixed.type === 'income' ? 'Marcar como recebida neste mês' : 'Marcar como paga neste mês'}
                </span>
              </label>

              {adjustmentError && <p role="alert" className="text-xs text-red-700">{adjustmentError}</p>}
              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingFixed(null)}
                  className="flex-1 py-2 text-xs font-semibold text-sage-500 hover:text-sage-900 rounded-full hover:bg-black/[0.04] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAdjustment}
                  className="flex-1 py-2 bg-pine-600 hover:bg-pine-800 active:scale-[0.98] text-white text-xs font-semibold rounded-full shadow-[0_2px_8px_rgba(26,100,72,0.25)] transition-all"
                >
                  {savingAdjustment ? 'Salvando…' : 'Salvar ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Novo Fixo ou Editar Cadastro Base */}
      {isAddFixedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pine-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-5 space-y-4 shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-black/[0.04] max-h-[90vh] overflow-y-auto">
            <h4 className="text-sm font-semibold text-sage-900">
              {editingBaseFixed ? 'Editar recorrência' : type === 'income' ? 'Nova entrada' : 'Nova conta recorrente'}
            </h4>

            <form onSubmit={handleSaveBaseFixed} className="space-y-3">
              {/* Type Switcher */}
              {!editingBaseFixed && (
                <div className="grid grid-cols-2 p-1 bg-black/[0.05] rounded-full gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setType('expense');
                      setCategoryId(categories.find((item) => item.id === 'cat-moradia')?.id ||
                        categories.find((item) => item.type === 'expense')?.id || '');
                    }}
                    className={`py-1 text-xs font-semibold rounded-full transition-all ${
                      type === 'expense'
                        ? 'bg-white text-rose-700 shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
                        : 'text-sage-500'
                    }`}
                  >
                    Gasto Fixo
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`py-1 text-xs font-semibold rounded-full transition-all ${
                      type === 'income'
                        ? 'bg-white text-pine-700 shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
                        : 'text-sage-500'
                    }`}
                  >
                    Entrada Fixa
                  </button>
                </div>
              )}

              {/* Description */}
              <div>
                <label htmlFor="fixed-description" className="block text-[10px] font-semibold text-sage-500 uppercase tracking-wider mb-1">
                  {type === 'expense' ? 'Descrição' : 'Descrição / Origem'}
                </label>
                <input
                  id="fixed-description"
                  type="text"
                  required
                  placeholder={
                    type === 'expense'
                      ? 'Ex: Conta de Luz, Água, Internet, Aluguel...'
                      : 'Ex: Salário Empresa, Freela...'
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-black/[0.1] rounded-[16px] text-xs font-medium text-sage-900 focus:outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
                />
              </div>

              {/* Merchant / Provider */}
              {type === 'expense' && (
                <div>
                  <label className="block text-[10px] font-semibold text-sage-500 uppercase tracking-wider mb-1">
                    Concessionária / Empresa (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Copasa, Cemig, Claro, Imobiliária..."
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="w-full px-3 py-2 border border-black/[0.1] rounded-[16px] text-xs font-medium text-sage-900 focus:outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
                  />
                </div>
              )}

              {/* Expense Fields */}
              {type === 'expense' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="fixed-expense-amount" className="block text-[10px] font-semibold text-sage-500 uppercase tracking-wider mb-1">
                        {isVariable ? 'Valor estimado (R$)' : 'Valor mensal (R$)'}
                      </label>
                      <input
                        id="fixed-expense-amount"
                        type="text"
                        inputMode="decimal"
                        required
                        placeholder="0,00"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        className="w-full px-3 py-2 border border-black/[0.1] rounded-[16px] text-xs font-semibold tabular-nums text-sage-900 focus:outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="fixed-due-day" className="block text-[10px] font-semibold text-sage-500 uppercase tracking-wider mb-1">
                        Dia do Vencimento
                      </label>
                      <input
                        id="fixed-due-day"
                        type="number"
                        min="1"
                        max="31"
                        required
                        value={dueDay}
                        onChange={(e) => setDueDay(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-black/[0.1] rounded-[16px] text-xs font-semibold text-sage-900 focus:outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/20"
                      />
                    </div>
                  </div>

                  {/* Variable Checkbox Toggle */}
                  <label className="flex items-center gap-2.5 p-2.5 bg-pine-700/5 rounded-[16px] border border-pine-700/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isVariable}
                      onChange={(e) => setIsVariable(e.target.checked)}
                      className="w-4 h-4 text-pine-700 rounded-[4px] focus:ring-pine-700"
                    />
                    <div>
                      <span className="text-xs font-semibold text-sage-900 block">
                        Esta conta varia todo mês (água, luz, internet, etc.)?
                      </span>
                      <span className="text-[10px] text-sage-500 block">
                        Permite ajustar o valor mês a mês conforme as faturas reais forem chegando.
                      </span>
                    </div>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-sage-500 uppercase tracking-wider mb-1">
                        Categoria
                      </label>
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full px-2.5 py-2 border border-black/[0.1] rounded-[16px] text-xs text-sage-900 bg-white focus:outline-none focus:border-pine-600"
                      >
                        {categories
                          .filter((c) => c.type === 'expense')
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-sage-500 uppercase tracking-wider mb-1">
                        Forma de Pagamento
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-2.5 py-2 border border-black/[0.1] rounded-[16px] text-xs text-sage-900 bg-white focus:outline-none focus:border-pine-600"
                      >
                        <option value="pix">Pix / Boleto / Débito</option>
                        <option value="credit">Cartão de Crédito</option>
                        <option value="transfer">Transferência</option>
                      </select>
                    </div>
                  </div>

                  {paymentMethod === 'credit' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-sage-500 uppercase tracking-wider mb-1">
                        Cartão Vinculado
                      </label>
                      <select
                        value={creditCardId}
                        onChange={(e) => setCreditCardId(e.target.value)}
                        className="w-full px-2.5 py-2 border border-black/[0.1] rounded-[16px] text-xs font-semibold text-sage-900 bg-white focus:outline-none focus:border-pine-600"
                      >
                        {creditCards.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : (
                /* Income Fields */
                <>
                  <div className="grid grid-cols-2 p-1 bg-black/[0.05] rounded-full gap-1">
                    <button
                      type="button"
                      onClick={() => setIncomeSubtype('salario')}
                      className={`py-1 text-xs font-semibold rounded-full transition-all ${
                        incomeSubtype === 'salario'
                          ? 'bg-white text-pine-700 shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
                          : 'text-sage-500'
                      }`}
                    >
                      Salário (Mensal)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncomeSubtype('esporadica')}
                      className={`py-1 text-xs font-semibold rounded-full transition-all ${
                        incomeSubtype === 'esporadica'
                          ? 'bg-white text-pine-600 shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
                          : 'text-sage-500'
                      }`}
                    >
                      Esporádica
                    </button>
                  </div>

                  <div>
                    <label htmlFor="fixed-income-amount" className="block text-[10px] font-semibold text-sage-500 uppercase tracking-wider mb-1">
                      Valor Mensal (R$)
                    </label>
                    <input
                      id="fixed-income-amount"
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="0,00"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      className="w-full px-3 py-2 border border-black/[0.1] rounded-[16px] text-xs font-semibold tabular-nums text-pine-700 focus:outline-none focus:border-pine-700 focus:ring-2 focus:ring-pine-700/20"
                    />
                  </div>
                  <label className="block space-y-1">
                    <span className="text-[10px] font-semibold text-sage-500 uppercase tracking-wider">Dia de recebimento</span>
                    <input type="number" min={1} max={31} required value={dueDay || ''} onChange={(event) => setDueDay(Number(event.target.value))}
                      className="w-full px-3 py-2 border border-black/[0.1] rounded-[16px] text-sm" />
                  </label>
                </>
              )}

              <p className="rounded-xl bg-pine-50 p-2.5 text-xs text-pine-900">
                {type === 'expense' || incomeSubtype === 'salario'
                  ? `Repete todo mês a partir de ${formatMonthYear(selectedMonth).toLowerCase()}.`
                  : `Entrada única em ${formatMonthYear(selectedMonth).toLowerCase()}.`}
              </p>

              {saveError && <p role="alert" className="text-xs text-red-700">{saveError}</p>}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddFixedOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold text-sage-500 hover:text-sage-900 rounded-full hover:bg-black/[0.04] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingFixed}
                  className="flex-1 py-2 bg-pine-600 hover:bg-pine-800 active:scale-[0.98] text-white text-xs font-semibold rounded-full shadow-[0_2px_8px_rgba(26,100,72,0.25)] transition-all"
                >
                  {isSavingFixed ? 'Salvando…' : editingBaseFixed ? 'Salvar alterações' : type === 'expense' ? 'Salvar conta' : 'Salvar entrada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Modal: Exclusão com Confirmação */}
      {pendingDeleteFixed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pine-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-5 space-y-4 shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-black/[0.04]">
            <h4 className="text-sm font-semibold text-sage-900">Excluir Gasto Fixo</h4>
            <p className="text-xs text-sage-500">
              Deseja remover <strong>{pendingDeleteFixed.description}</strong>?
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  onDeleteFixedExpense(pendingDeleteFixed.id, true);
                  setPendingDeleteFixed(null);
                }}
                className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 active:scale-[0.98] text-white text-xs font-semibold rounded-full shadow-[0_2px_8px_rgba(190,18,60,0.25)] transition-all"
              >
                Excluir Fixo e Todos os Lançamentos nos 12 Meses
              </button>
              <button
                onClick={() => {
                  onDeleteFixedExpense(pendingDeleteFixed.id, false);
                  setPendingDeleteFixed(null);
                }}
                className="w-full py-2.5 bg-black/[0.05] hover:bg-black/[0.08] active:scale-[0.98] text-sage-900 text-xs font-semibold rounded-full transition-all"
              >
                Excluir Fixo mas Manter Lançamentos Já Existentes
              </button>
              <button
                onClick={() => setPendingDeleteFixed(null)}
                className="w-full py-2 text-sage-500 hover:text-sage-900 text-xs font-semibold rounded-full hover:bg-black/[0.04] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
