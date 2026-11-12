import React, { useState, useEffect, useRef } from 'react';
import type { CardPurchaseDraft } from './CardPurchaseDialog';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Calendar as CalendarIcon,
  Check,
  CreditCard as CardIcon,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  Store,
  Plus,
  Search,
} from 'lucide-react';
import {
  Category,
  CreditCard,
  PaymentMethod,
  Transaction,
  TransactionType,
} from '../types';
import { CategoryIcon } from './CategoryIcon';
import {
  getTodayDateString,
  getYesterdayDateString,
  formatCurrency,
  formatMonthYear,
  getDateInMonth,
} from '../utils/formatters';
import { PAYMENT_METHOD_LABELS } from '../data/defaultData';
import { parseFinancialAmount, parseFinancialDate } from '../utils/delimitedData';
import {
  findMatchingCard,
  getTransactionBillingMonth,
} from '../utils/creditCardHelpers';

export interface SaveTransactionPayload extends Omit<Transaction, 'id' | 'createdAt'> {
  installmentConfig?: {
    isInstallment: boolean;
    totalInstallments: number;
    valueMode: 'total' | 'installment';
  };
}

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: SaveTransactionPayload) => Promise<boolean>;
  categories: Category[];
  creditCards: CreditCard[];
  initialData?: Transaction | null;
  initialType?: TransactionType;
  cardPurchaseDraft?: CardPurchaseDraft | null;
  selectedMonth: string;
  merchants?: string[];
  onAddMerchant?: (name: string) => void;
}

const DEFAULT_FREQUENT_MERCHANTS = [
  'Bons Frion',
  'Casa do Grão',
  'Mercadinho',
  'Padaria',
];

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  creditCards,
  initialData,
  initialType = 'expense',
  cardPurchaseDraft,
  selectedMonth,
  merchants,
  onAddMerchant,
}) => {
  const effectiveCards = creditCards;

  // Helper to find XP card by default
  const getXpCardId = () => {
    const xp = effectiveCards.find(
      (c) =>
        c.name.toLowerCase().includes('xp') ||
        c.id.toLowerCase().includes('xp') ||
        (c.bankName && c.bankName.toLowerCase().includes('xp'))
    );
    return xp?.id ?? effectiveCards[0]?.id ?? '';
  };

  // Helper to find Alimentação category by default
  const getDefaultCategoryId = (cats: Category[], targetType: TransactionType | string = 'expense') => {
    if (targetType === 'expense') {
      const foodCat = cats.find(
        (c) =>
          c.type === 'expense' &&
          (c.name.toLowerCase().includes('aliment') || c.id.toLowerCase().includes('aliment'))
      );
      if (foodCat) return foodCat.id;
    }
    const fallback = cats.find((c) => c.type === targetType);
    return fallback?.id || '';
  };

  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>(() =>
    getDefaultCategoryId(categories, initialType)
  );
  const [date, setDate] = useState<string>(getTodayDateString());
  const [showCustomDate, setShowCustomDate] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [creditCardId, setCreditCardId] = useState<string>(getXpCardId());

  // Merchant combobox state
  const [localMerchantList, setLocalMerchantList] = useState<string[]>(() => {
    const saved = localStorage.getItem('financas_custom_merchants');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...DEFAULT_FREQUENT_MERCHANTS, ...parsed]));
        }
      } catch {
        // ignore
      }
    }
    return DEFAULT_FREQUENT_MERCHANTS;
  });

  const effectiveMerchantList = merchants ?? localMerchantList;
  const [isMerchantDropdownOpen, setIsMerchantDropdownOpen] = useState(false);
  const merchantDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        merchantDropdownRef.current &&
        !merchantDropdownRef.current.contains(e.target as Node)
      ) {
        setIsMerchantDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Advanced options toggle (keeps modal clean and uncluttered)
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isFixed, setIsFixed] = useState<boolean>(false);
  const [isInstallment, setIsInstallment] = useState<boolean>(false);
  const [totalInstallments, setTotalInstallments] = useState<number>(2);
  const [valueMode, setValueMode] = useState<'total' | 'installment'>('total');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredCategories = categories.filter((c) => c.type === type);
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Initialize or reset form
  useEffect(() => {
    if (isOpen) {
      setError('');
      setShowAdvanced(false);

      if (initialData) {
        setType(initialData.type);
        setAmountStr(initialData.amount.toFixed(2).replace('.', ','));
        setDescription(initialData.merchant || initialData.description || '');
        setCategoryId(initialData.categoryId);
        setDate(initialData.date);
        setPaymentMethod(initialData.paymentMethod);
        
        const matched = initialData.creditCardId
          ? effectiveCards.find((c) => c.id === initialData.creditCardId)
          : findMatchingCard(effectiveCards, initialData.merchant || initialData.description || '');
        
        setCreditCardId(initialData.creditCardId ?? matched?.id ?? '');
        setIsFixed(!!initialData.isFixed);
        
        if (initialData.installments) {
          setIsInstallment(true);
          setTotalInstallments(initialData.installments.total);
          setValueMode('installment');
          setShowAdvanced(true);
        } else {
          setIsInstallment(false);
        }

        setNotes(initialData.notes || '');
        setShowCustomDate(
          initialData.date !== getTodayDateString() &&
          initialData.date !== getYesterdayDateString()
        );
        if (initialData.isFixed || initialData.notes) {
          setShowAdvanced(true);
        }
      } else {
        setType(initialType);
        setAmountStr(cardPurchaseDraft?.amount ?? '');
        setDescription(cardPurchaseDraft?.description ?? '');
        const today = getTodayDateString();
        const isSelectedMonthCurrent = today.startsWith(selectedMonth);
        const entryDate = cardPurchaseDraft?.date || (isSelectedMonthCurrent ? today : `${selectedMonth}-01`);
        setDate(entryDate);
        setShowCustomDate(entryDate !== today && entryDate !== getYesterdayDateString());
        setPaymentMethod(initialType === 'expense' && effectiveCards.length ? 'credit' : 'pix');
        
        // XP card by default as requested
        setCreditCardId(cardPurchaseDraft?.cardId || getXpCardId());
        
        setIsFixed(false);
        setIsInstallment(!!cardPurchaseDraft);
        setShowAdvanced(!!cardPurchaseDraft);
        setTotalInstallments(2);
        setValueMode('total');
        setNotes('');
        
        setCategoryId(cardPurchaseDraft?.categoryId || getDefaultCategoryId(categories, initialType));
      }
    }
  }, [isOpen, initialData, initialType, cardPurchaseDraft]);

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategoryId(getDefaultCategoryId(categories, newType));
    if (newType === 'income') {
      setIsInstallment(false);
      if (paymentMethod === 'credit') setPaymentMethod('pix');
    }
  };

  const handleSelectMerchant = (val: string) => {
    setDescription(val);
    setIsMerchantDropdownOpen(false);
    if (!categoryId) {
      const foodCat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('mercado') ||
          c.name.toLowerCase().includes('aliment') ||
          c.name.toLowerCase().includes('feira')
      );
      if (foodCat) setCategoryId(foodCat.id);
    }
  };

  const handleAddNewMerchant = (newMerchant: string) => {
    const trimmed = newMerchant.trim();
    if (!trimmed) return;
    setDescription(trimmed);
    if (onAddMerchant) {
      onAddMerchant(trimmed);
    } else if (!effectiveMerchantList.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...localMerchantList, trimmed];
      setLocalMerchantList(updated);
      localStorage.setItem('financas_custom_merchants', JSON.stringify(updated));
    }
    setIsMerchantDropdownOpen(false);
    if (!categoryId) {
      const foodCat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('mercado') ||
          c.name.toLowerCase().includes('aliment') ||
          c.name.toLowerCase().includes('feira')
      );
      if (foodCat) setCategoryId(foodCat.id);
    }
  };

  const filteredMerchants = effectiveMerchantList.filter((m) =>
    m.toLowerCase().includes(description.trim().toLowerCase())
  );
  const hasExactMatch = effectiveMerchantList.some(
    (m) => m.toLowerCase() === description.trim().toLowerCase()
  );
  const canAddNew = description.trim().length > 0 && !hasExactMatch;

  const handleQuickAddValue = (increment: number) => {
    const current = parseFinancialAmount(amountStr) ?? 0;
    const next = current + increment;
    setAmountStr(next.toFixed(2).replace('.', ','));
  };

  // Calculations for installments
  const rawAmount = parseFinancialAmount(amountStr) ?? 0;
  let installmentAmount = rawAmount;
  let totalPurchaseAmount = rawAmount;
  if (isInstallment && totalInstallments > 0) {
    if (valueMode === 'total') {
      installmentAmount = rawAmount / totalInstallments;
      totalPurchaseAmount = rawAmount;
    } else {
      installmentAmount = rawAmount;
      totalPurchaseAmount = rawAmount * totalInstallments;
    }
  }

  // Real-time Credit Card Invoice Preview Calculation
  const getInvoiceDetails = () => {
    const chosenCard = effectiveCards.find((c) => c.id === creditCardId);
    if (!chosenCard || paymentMethod !== 'credit' || type !== 'expense' || !parseFinancialDate(date)) return null;

    const billingMonth = getTransactionBillingMonth(
      {
        id: 'temp',
        type: 'expense',
        amount: 1,
        categoryId: categoryId || 'cat',
        date,
        paymentMethod: 'credit',
        creditCardId: chosenCard.id,
        description: 'temp',
      } as Transaction,
      effectiveCards
    );

    const formattedDueDate = getDateInMonth(billingMonth, chosenCard.dueDay).split('-').reverse().join('/');

    return {
      card: chosenCard,
      billingMonth,
      isPostClosing: billingMonth !== date.slice(0, 7),
      formattedDueDate,
      billingMonthFormatted: formatMonthYear(billingMonth),
    };
  };

  const invoiceInfo = getInvoiceDetails();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const parsedAmount = parseFinancialAmount(amountStr);

    if (parsedAmount === null || parsedAmount <= 0) {
      setError('Informe um valor válido maior que zero.');
      return;
    }

    if (!categoryId || !filteredCategories.some((category) => category.id === categoryId)) {
      setError('Por favor, escolha uma categoria.');
      return;
    }

    if (!parseFinancialDate(date)) {
      setError('Informe uma data válida.');
      return;
    }

    if (!initialData && isInstallment && valueMode === 'total' && Math.round(parsedAmount * 100) < totalInstallments) {
      setError('Cada parcela precisa ter um valor de pelo menos R$ 0,01.');
      return;
    }

    const selCategory = categories.find((c) => c.id === categoryId);
    const categoryTag = selCategory
      ? `#${selCategory.name.split(' ')[0].replace(/[^a-zA-Z0-9À-ÿ]/g, '')}`
      : '';

    const matchedCard = paymentMethod === 'credit' ? effectiveCards.find((c) => c.id === creditCardId) : undefined;
    if (paymentMethod === 'credit' && !matchedCard && initialData?.paymentMethod !== 'credit') {
      setError('Escolha um cartão de crédito.');
      return;
    }
    const cardTag = matchedCard ? `#${matchedCard.name.replace(/\s+/g, '')}` : undefined;

    const merchant = description.trim();
    const unchangedMerchant = initialData && merchant === (initialData.merchant || initialData.description || '');
    const finalDescription =
      (unchangedMerchant ? initialData.description : merchant) ||
      selCategory?.name ||
      (type === 'expense' ? 'Gasto' : 'Entrada');

    const finalAmount = isInstallment && type === 'expense' ? installmentAmount : parsedAmount;

    const payload: SaveTransactionPayload = {
      description: finalDescription,
      merchant: unchangedMerchant ? initialData.merchant : merchant || undefined,
      amount: finalAmount,
      type,
      categoryId,
      tags: [categoryTag, cardTag].filter(Boolean) as string[],
      date,
      paymentMethod,
      creditCardId: paymentMethod === 'credit' ? matchedCard?.id ?? initialData?.creditCardId : undefined,
      isFixed,
      notes: notes.trim() || undefined,
      installmentConfig:
        isInstallment && type === 'expense' && !initialData
          ? {
              isInstallment: true,
              totalInstallments,
              valueMode,
            }
          : undefined,
    };

    setError('');
    setIsSaving(true);
    try {
      if (await onSave(payload)) onClose();
      else setError('Não foi possível salvar. Verifique a conexão e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-sage-950/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-sage-200"
        >
          {/* Header */}
          <div className="finance-gradient px-5 py-3.5 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  type === 'expense' ? 'bg-rose-400' : 'bg-pine-400'
                }`}
              />
              <h2 className="text-sm font-bold tracking-wide">
                {initialData
                  ? 'Editar Lançamento'
                  : type === 'expense'
                  ? 'Novo Gasto no Cartão'
                  : 'Nova Entrada'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-pine-200 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-5 space-y-4 flex-1 bg-sage-50">
            {/* 1. Toggle Despesa vs Entrada */}
            <div className="grid grid-cols-2 p-1 bg-sage-200 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  type === 'expense'
                    ? 'bg-pine-600 text-white shadow-xs'
                    : 'text-sage-600 hover:text-sage-900'
                }`}
              >
                💸 Despesa (Saída)
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  type === 'income'
                    ? 'bg-pine-600 text-white shadow-xs'
                    : 'text-sage-600 hover:text-sage-900'
                }`}
              >
                💰 Receita (Entrada)
              </button>
            </div>

            {/* 2. Campo de Valor Principal */}
            <div className="bg-white p-4 rounded-2xl border border-sage-200 text-center shadow-2xs">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-sage-400 mb-1">
                {isInstallment && valueMode === 'installment'
                  ? 'Valor de Cada Parcela'
                  : 'Valor'}
              </label>
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-2xl font-bold text-sage-400">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  placeholder="0,00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className={`text-3xl font-extrabold w-48 text-center bg-transparent outline-none ${
                    type === 'expense' ? 'text-sage-900' : 'text-pine-600'
                  }`}
                />
              </div>

              {/* Botões rápidos de acréscimo */}
              <div className="flex items-center justify-center gap-1.5 mt-2.5 pt-2.5 border-t border-sage-100">
                {[10, 20, 50, 100].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => handleQuickAddValue(inc)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-sage-50 hover:bg-sage-100 text-sage-600 rounded-lg border border-sage-200 transition-colors"
                  >
                    +{inc}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                {error}
              </p>
            )}

            {/* 3. Descrição ou Estabelecimento (Combobox com campo de pesquisa dentro do dropdown e adicionar como novo) */}
            <div
              ref={merchantDropdownRef}
              className="bg-white p-3.5 rounded-2xl border border-sage-200 shadow-2xs space-y-2 relative"
            >
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-sage-700 flex items-center gap-1.5">
                  <Store size={14} className="text-pine-600" />
                  Descrição ou Estabelecimento
                </label>
                <span className="text-[10px] text-sage-400">Busque ou adicione</span>
              </div>

              {/* Único campo de pesquisa */}
              <div className="relative">
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-sage-400 pointer-events-none" />
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setIsMerchantDropdownOpen(true);
                    }}
                    onFocus={() => setIsMerchantDropdownOpen(true)}
                    placeholder="Pesquise: Bons Frion, Casa do Grão, Padaria..."
                    className="w-full pl-8 pr-16 py-2.5 bg-sage-50 border border-sage-200 rounded-xl text-sage-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600"
                  />
                  <div className="absolute right-2 flex items-center gap-1 text-sage-400">
                    {description && (
                      <button
                        type="button"
                        onClick={() => {
                          setDescription('');
                          setIsMerchantDropdownOpen(true);
                        }}
                        className="p-1 hover:text-sage-600 rounded-full"
                        title="Limpar campo"
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsMerchantDropdownOpen(!isMerchantDropdownOpen)}
                      className="p-1 hover:text-sage-600 rounded-full"
                      title="Ver estabelecimentos"
                    >
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${
                          isMerchantDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Dropdown com opções filtradas e botão para adicionar como novo */}
                {isMerchantDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-sage-200 rounded-2xl shadow-xl z-30 max-h-56 overflow-y-auto p-1.5 space-y-1">
                    {filteredMerchants.length > 0 && (
                      <div className="space-y-0.5">
                        {filteredMerchants.map((m) => {
                          const isSelected = description.trim().toLowerCase() === m.toLowerCase();
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => handleSelectMerchant(m)}
                              className={`w-full text-left px-3 py-2 text-xs rounded-xl font-bold flex items-center justify-between transition-colors ${
                                isSelected
                                  ? 'bg-pine-50 text-pine-600'
                                  : 'hover:bg-sage-50 text-sage-700'
                              }`}
                            >
                              <span>{m}</span>
                              {isSelected && <Check size={14} className="text-pine-600" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Caso não ache ou esteja digitando um novo: Adicionar como Novo */}
                    {canAddNew && (
                      <button
                        type="button"
                        onClick={() => handleAddNewMerchant(description)}
                        className="w-full text-left px-3 py-2.5 text-xs font-bold text-pine-600 bg-pine-50 hover:bg-pine-100 rounded-xl flex items-center gap-1.5 transition-colors border border-pine-100 mt-1"
                      >
                        <Plus size={14} className="shrink-0" />
                        <span className="truncate">
                          Adicionar "<strong>{description.trim()}</strong>" como novo
                        </span>
                      </button>
                    )}

                    {filteredMerchants.length === 0 && !canAddNew && (
                      <div className="px-3 py-2.5 text-xs text-sage-400 text-center">
                        Nenhum estabelecimento encontrado
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Categoria em Menu Dropdown */}
            <div className="bg-white p-3.5 rounded-2xl border border-sage-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-sage-700 flex items-center gap-1.5">
                  <Tag size={13} className="text-pine-600" />
                  Categoria
                </label>
                {selectedCategory && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-pine-50 text-[11px] font-bold text-pine-800">
                    <CategoryIcon name={selectedCategory.icon} size={12} color={selectedCategory.color} />
                    <span>{selectedCategory.name}</span>
                  </div>
                )}
              </div>

              {/* Dropdown de Categorias */}
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 bg-sage-50 border border-sage-200 rounded-xl text-xs font-bold text-sage-800 focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600 cursor-pointer"
              >
                <option value="" disabled>Selecione uma categoria...</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sage-700">Forma de pagamento</span>
              <select
                value={paymentMethod}
                onChange={(event) => {
                  const method = event.target.value as PaymentMethod;
                  setPaymentMethod(method);
                  if (method === 'credit' && !creditCardId) setCreditCardId(getXpCardId());
                }}
                className="w-full rounded-xl border border-sage-200 bg-white p-2.5 text-xs"
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([method, { label }]) => (
                  <option key={method} value={method} disabled={method === 'credit' && !creditCards.length && paymentMethod !== 'credit'}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {paymentMethod === 'credit' && (
            <div className="bg-white p-3.5 rounded-2xl border border-sage-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sage-700 flex items-center gap-1.5">
                  <CardIcon size={14} className="text-pine-600" />
                  Qual cartão você utilizou?
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {effectiveCards.map((card) => {
                  const isSelected = creditCardId === card.id;
                  const isXp = card.name.toLowerCase().includes('xp') || card.id.toLowerCase().includes('xp');

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setCreditCardId(card.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                        isSelected
                          ? 'border-sage-900 bg-sage-900 text-white shadow-md'
                          : 'border-sage-200 bg-white hover:bg-sage-50 text-sage-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: card.color }}
                          />
                          {isXp && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-amber-400 text-sage-950 font-black rounded">
                              XP
                            </span>
                          )}
                        </div>
                        {isSelected && <Check size={14} className="text-pine-400" />}
                      </div>
                      <p className="text-xs font-bold truncate">{card.name}</p>
                      <p className="text-[10px] opacity-70">
                        Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* 🎯 AVISO CLARO E DIDÁTICO DE ONDE O GASTO VAI CAIR */}
              {invoiceInfo && (
                <div className="p-3 bg-gradient-to-r from-pine-50 to-pine-50/70 border border-pine-200 rounded-xl space-y-1 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CardIcon size={14} className="text-pine-600" />
                      <span className="text-xs font-bold text-sage-900">
                        Fatura: <span className="text-pine-600 font-extrabold">{invoiceInfo.billingMonthFormatted}</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-sage-700 border border-pine-100 shadow-2xs">
                      Vencimento: {invoiceInfo.formattedDueDate}
                    </span>
                  </div>
                  <p className="text-[11px] text-sage-600 leading-snug">
                    {invoiceInfo.isPostClosing ? (
                      <>
                        Compra após o fechamento. Entra na fatura de <strong>{invoiceInfo.billingMonthFormatted}</strong>.
                      </>
                    ) : (
                      <>
                        Compra antes do fechamento. Entra na fatura de <strong>{invoiceInfo.billingMonthFormatted}</strong>.
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
            )}

            {/* 6. Data da Compra */}
            <div className="bg-white p-3.5 rounded-2xl border border-sage-200 shadow-2xs space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-sage-700">
                Data do Lançamento
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDate(getTodayDateString());
                    setShowCustomDate(false);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                    date === getTodayDateString() && !showCustomDate
                      ? 'bg-sage-900 text-white border-sage-900'
                      : 'bg-white text-sage-600 border-sage-200 hover:bg-sage-50'
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDate(getYesterdayDateString());
                    setShowCustomDate(false);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                    date === getYesterdayDateString() && !showCustomDate
                      ? 'bg-sage-900 text-white border-sage-900'
                      : 'bg-white text-sage-600 border-sage-200 hover:bg-sage-50'
                  }`}
                >
                  Ontem
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomDate(true)}
                  className={`p-1.5 px-3 rounded-xl border text-xs font-bold flex items-center gap-1 ${
                    showCustomDate
                      ? 'bg-sage-900 text-white border-sage-900'
                      : 'bg-white text-sage-600 border-sage-200'
                  }`}
                  title="Escolher outra data"
                >
                  <CalendarIcon size={14} />
                  <span>Outra</span>
                </button>
              </div>

              {showCustomDate && (
                <input
                  type="date"
                  value={date}
                  onInput={(event) => setDate(event.currentTarget.value)}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-sage-50 border border-sage-200 rounded-xl text-xs text-sage-800"
                />
              )}
            </div>

            {/* 7. Opções Avançadas (Recolhível para não poluir o uso diário) */}
            <div className="bg-white rounded-2xl border border-sage-200 shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full p-3 flex items-center justify-between text-xs font-bold text-sage-600 hover:text-sage-900 hover:bg-sage-50 transition-colors"
              >
                <span>Mais opções (Parcelamento, Gasto Fixo, Notas)</span>
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showAdvanced && (
                <div className="p-3.5 border-t border-sage-100 space-y-3 bg-sage-50/50 animate-in fade-in">
                  {/* Parcelamento */}
                  {type === 'expense' && !initialData && (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInstallment}
                          onChange={(e) => setIsInstallment(e.target.checked)}
                          className="w-4 h-4 text-pine-600 rounded-md focus:ring-pine-500"
                        />
                        <span className="text-xs font-bold text-sage-800 flex items-center gap-1">
                          <Layers size={13} className="text-pine-600" />
                          Compra Parcelada?
                        </span>
                      </label>

                      {isInstallment && (
                        <div className="p-3 bg-pine-50/70 border border-pine-200 rounded-xl space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-pine-800 mb-1">
                                Parcelas
                              </label>
                              <select
                                value={totalInstallments}
                                onChange={(e) => setTotalInstallments(Number(e.target.value))}
                                className="w-full px-2 py-1.5 bg-white border border-pine-200 rounded-lg text-xs font-bold text-sage-800"
                              >
                                {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                                  <option key={n} value={n}>
                                    {n}x parcelas
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-pine-800 mb-1">
                                O valor digitado é
                              </label>
                              <select
                                value={valueMode}
                                onChange={(e) => setValueMode(e.target.value as 'total' | 'installment')}
                                className="w-full px-2 py-1.5 bg-white border border-pine-200 rounded-lg text-xs font-bold text-sage-800"
                              >
                                <option value="total">Total da compra</option>
                                <option value="installment">Valor de cada parcela</option>
                              </select>
                            </div>
                          </div>

                          {rawAmount > 0 && (
                            <p className="text-[11px] text-pine-900 font-semibold pt-1">
                              👉 {totalInstallments}x de {formatCurrency(installmentAmount)} (Total: {formatCurrency(totalPurchaseAmount)})
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recorrente / Fixo */}
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFixed}
                      disabled={isInstallment}
                      onChange={(e) => setIsFixed(e.target.checked)}
                      className="w-4 h-4 text-pine-600 rounded-md focus:ring-pine-500 disabled:opacity-50"
                    />
                    <div>
                      <span className="text-xs font-bold text-sage-800 flex items-center gap-1">
                        <RefreshCw size={12} className="text-pine-600" />
                        Gasto ou Ganho Fixo
                      </span>
                      <p className="text-[10px] text-sage-400">Repete automaticamente todo mês</p>
                    </div>
                  </label>

                  {/* Notas */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-sage-500 mb-1">
                      Observações
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Alguma anotação sobre este lançamento?"
                      className="w-full px-2.5 py-1.5 bg-white border border-sage-200 rounded-lg text-xs text-sage-800"
                    />
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Footer Save */}
          <div className="p-3.5 bg-white border-t border-sage-200 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-sage-200 text-sage-700 font-bold text-xs hover:bg-sage-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex-2 py-2.5 rounded-xl bg-pine-600 hover:bg-pine-800 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all"
            >
              <Check size={16} className="text-white" />
              {isSaving ? 'Salvando…' : initialData
                ? 'Salvar Alterações'
                : isInstallment
                ? `Lançar ${totalInstallments}x de ${formatCurrency(installmentAmount)}`
                : type === 'expense'
                ? 'Confirmar Gasto'
                : 'Confirmar Entrada'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
