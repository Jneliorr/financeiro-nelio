import React, { useState } from 'react';
import {
  CreditCard as CardIcon,
  Plus,
  Edit2,
  Trash2,
  Check,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Link2,
  Lock,
  Unlock,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Info,
  CheckCircle2,
  HelpCircle,
  Clock,
  Sparkles,
  Receipt,
  Star,
} from 'lucide-react';
import { CreditCard, Category, Transaction } from '../types';
import {
  formatCurrency,
  formatMonthYear,
  formatDateDisplay,
  getTodayDateString,
} from '../utils/formatters';
import {
  getCardSpend,
  getTransactionsForCard,
  getTransactionCard,
  isTransactionInMonth,
  getCardBillingCycle,
  isCardInvoiceClosed,
  getNextMonthKey,
  getPreviousMonthKey,
} from '../utils/creditCardHelpers';
import { CategoryIcon } from './CategoryIcon';

interface CardsViewProps {
  creditCards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  selectedMonth: string;
  onChangeMonth?: (monthKey: string) => void;
  onAddCreditCard: (card: Omit<CreditCard, 'id'>) => Promise<CreditCard | undefined>;
  onUpdateCreditCard: (id: string, updated: Partial<CreditCard>) => void;
  onDeleteCreditCard: (id: string) => void;
  onOpenImportCsvModal?: () => void;
  onEditTransaction?: (tx: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
  onBulkUpdateCardId?: (transactionIds: string[], cardId: string) => void;
}

const CARD_COLORS = [
  { name: 'Preto / Dark (XP/Carbon)', color: '#111827' },
  { name: 'Azul Celeste (Mercado Pago)', color: '#009EE3' },
  { name: 'Roxo (Nubank)', color: '#820AD1' },
  { name: 'Laranja (Itaú/Inter)', color: '#EC7000' },
  { name: 'Vermelho (Santander/Bradesco)', color: '#DC2626' },
  { name: 'Azul Real', color: '#2563EB' },
  { name: 'Verde Esmeralda', color: '#059669' },
  { name: 'Dourado / Ouro', color: '#D97706' },
  { name: 'Rosa / Magenta', color: '#DB2777' },
  { name: 'Azul Petróleo', color: '#0891B2' },
];

export const CardsView: React.FC<CardsViewProps> = ({
  creditCards,
  categories,
  transactions,
  selectedMonth,
  onChangeMonth,
  onAddCreditCard,
  onUpdateCreditCard,
  onDeleteCreditCard,
  onOpenImportCsvModal,
  onEditTransaction,
  onDeleteTransaction,
  onBulkUpdateCardId,
}) => {
  // Selected Card for Focus View (defaults to XP or first card)
  const [selectedCardId, setSelectedCardId] = useState<string>(() => {
    const xp = creditCards.find((c) => c.name.toLowerCase().includes('xp') || c.id.includes('xp'));
    return xp ? xp.id : creditCards[0]?.id || '';
  });

  // Current Invoice Month being inspected (defaults to global selectedMonth, can switch anterior / atual / proxima)
  const [activeInvoiceMonth, setActiveInvoiceMonth] = useState<string>(selectedMonth);
  const changeInvoiceMonth = (month: string) => {
    setActiveInvoiceMonth(month);
    onChangeMonth?.(month);
  };

  // Sync if selectedMonth changes externally and user hadn't navigated away
  React.useEffect(() => {
    setActiveInvoiceMonth(selectedMonth);
  }, [selectedMonth]);

  // Keep selected card valid
  React.useEffect(() => {
    if (creditCards.length > 0 && !creditCards.some((c) => c.id === selectedCardId)) {
      const xp = creditCards.find((c) => c.name.toLowerCase().includes('xp') || c.id.includes('xp'));
      setSelectedCardId(xp ? xp.id : creditCards[0].id);
    }
  }, [creditCards, selectedCardId]);

  // Didactic Help Guide Accordion
  const [showDidacticGuide, setShowDidacticGuide] = useState(false);

  // Card Modals & States
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [pendingDeleteCard, setPendingDeleteCard] = useState<CreditCard | null>(null);

  // Manual Close Modal state
  const [closingConfirmCard, setClosingConfirmCard] = useState<CreditCard | null>(null);
  const [customClosingDate, setCustomClosingDate] = useState<string>(getTodayDateString());

  // Card Form Fields
  const [cardName, setCardName] = useState('');
  const [cardBankName, setCardBankName] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState<number>(20);
  const [cardDueDay, setCardDueDay] = useState<number>(28);
  const [cardLimitStr, setCardLimitStr] = useState('5000');
  const [cardColor, setCardColor] = useState(CARD_COLORS[0].color);

  // Active Card instance
  const activeCard = creditCards.find((c) => c.id === selectedCardId) || creditCards[0];

  // Month navigation helper keys
  const prevMonthKey = getPreviousMonthKey(activeInvoiceMonth);
  const nextMonthKey = getNextMonthKey(activeInvoiceMonth);

  // Unassigned Credit Transactions in active invoice month
  const unassignedCreditTransactions = transactions.filter((t) => {
    if (t.type !== 'expense' || t.paymentMethod !== 'credit') return false;
    if (!isTransactionInMonth(t, activeInvoiceMonth, creditCards)) return false;
    return !getTransactionCard(t, creditCards);
  });

  const handleOpenAddCard = () => {
    setEditingCard(null);
    setCardName('');
    setCardBankName('');
    setCardClosingDay(20);
    setCardDueDay(28);
    setCardLimitStr('5000');
    setCardColor(CARD_COLORS[0].color);
    setIsCardModalOpen(true);
  };

  const handleOpenEditCard = (card: CreditCard) => {
    setEditingCard(card);
    setCardName(card.name);
    setCardBankName(card.bankName || '');
    setCardClosingDay(card.closingDay);
    setCardDueDay(card.dueDay);
    setCardLimitStr(String(card.limit || 5000));
    setCardColor(card.color || CARD_COLORS[0].color);
    setIsCardModalOpen(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim()) return;

    const limit = parseFloat(cardLimitStr.replace(',', '.')) || 0;

    if (editingCard) {
      onUpdateCreditCard(editingCard.id, {
        name: cardName.trim(),
        bankName: cardBankName.trim() || cardName.trim(),
        closingDay: Math.min(Math.max(cardClosingDay, 1), 31),
        dueDay: Math.min(Math.max(cardDueDay, 1), 31),
        limit,
        color: cardColor,
      });
    } else {
      const newCard = await onAddCreditCard({
        name: cardName.trim(),
        bankName: cardBankName.trim() || cardName.trim(),
        closingDay: Math.min(Math.max(cardClosingDay, 1), 31),
        dueDay: Math.min(Math.max(cardDueDay, 1), 31),
        limit,
        color: cardColor,
      });
      if (!newCard) return;
      setSelectedCardId(newCard.id);
    }

    setIsCardModalOpen(false);
    setEditingCard(null);
  };

  // Toggle Manual Close Invoice
  const handleInitiateCloseInvoice = (card: CreditCard) => {
    setClosingConfirmCard(card);
    setCustomClosingDate(getTodayDateString());
  };

  const handleConfirmCloseInvoice = () => {
    if (!closingConfirmCard) return;

    const existingClosed = closingConfirmCard.closedInvoices || [];
    const updatedClosed = Array.from(new Set([...existingClosed, activeInvoiceMonth]));
    const updatedDates = {
      ...(closingConfirmCard.manualClosingDates || {}),
      [activeInvoiceMonth]: customClosingDate || getTodayDateString(),
    };

    onUpdateCreditCard(closingConfirmCard.id, {
      closedInvoices: updatedClosed,
      manualClosingDates: updatedDates,
    });

    setClosingConfirmCard(null);
  };

  const handleReopenInvoice = (card: CreditCard) => {
    const existingClosed = card.closedInvoices || [];
    const updatedClosed = existingClosed.filter((m) => m !== activeInvoiceMonth);
    const updatedDates = { ...(card.manualClosingDates || {}) };
    delete updatedDates[activeInvoiceMonth];

    onUpdateCreditCard(card.id, {
      closedInvoices: updatedClosed,
      manualClosingDates: updatedDates,
    });
  };

  const cardForm = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sage-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-sage-200 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-sage-800">
                {editingCard ? 'Editar Cartão de Crédito' : 'Novo Cartão de Crédito'}
              </h4>
              <div
                className="w-5 h-5 rounded-full"
                style={{ backgroundColor: cardColor }}
              />
            </div>

            <form onSubmit={handleSaveCard} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-sage-600 mb-1">
                  Nome do Cartão
                </label>
                <input
                  type="text"
                  placeholder="Ex: Cartão XP, Nubank Ultravioleta..."
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full px-3 py-2 border border-sage-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-sage-600 mb-1">
                  Banco / Emissor (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: XP Investimentos, Nubank, Itaú..."
                  value={cardBankName}
                  onChange={(e) => setCardBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-sage-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-sage-600 mb-1">
                    Dia Fechamento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={cardClosingDay}
                    onChange={(e) => setCardClosingDay(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-sage-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600"
                    required
                  />
                  <span className="text-[10px] text-sage-400 mt-0.5 block">
                    Trava a fatura
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-sage-600 mb-1">
                    Dia Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={cardDueDay}
                    onChange={(e) => setCardDueDay(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-sage-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600"
                    required
                  />
                  <span className="text-[10px] text-sage-400 mt-0.5 block">
                    Data do pagamento
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-sage-600 mb-1">
                  Limite Total (R$)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 5000"
                  value={cardLimitStr}
                  onChange={(e) => setCardLimitStr(e.target.value)}
                  className="w-full px-3 py-2 border border-sage-200 rounded-xl text-xs tabular-nums font-bold focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600"
                  required
                />
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-xs font-bold text-sage-600 mb-1.5">
                  Cor do Cartão
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {CARD_COLORS.map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setCardColor(c.color)}
                      style={{ backgroundColor: c.color }}
                      className={`h-7 rounded-xl flex items-center justify-center text-white transition-transform ${
                        cardColor === c.color ? 'ring-2 ring-sage-900 ring-offset-2 scale-105' : 'hover:scale-95'
                      }`}
                      title={c.name}
                    >
                      {cardColor === c.color && <Check size={14} className="stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-sage-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCardModalOpen(false);
                    setEditingCard(null);
                  }}
                  className="flex-1 py-2 border border-sage-200 text-sage-700 text-xs font-bold rounded-xl hover:bg-sage-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-pine-600 hover:bg-pine-800 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {editingCard ? 'Salvar Alterações' : 'Adicionar Cartão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      );

  // If no card is registered yet
  if (creditCards.length === 0) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-dashed border-sage-200 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-pine-50 text-pine-600 flex items-center justify-center mx-auto">
          <CardIcon size={32} />
        </div>
        <div>
          <h3 className="text-base font-bold text-sage-800">Nenhum Cartão Cadastrado</h3>
          <p className="text-xs text-sage-500 max-w-sm mx-auto mt-1">
            Cadastre seu cartão (como Cartão XP ou Nubank) para ter controle visual completo do fechamento da fatura e limites.
          </p>
        </div>
        <button
          onClick={handleOpenAddCard}
          className="px-4 py-2.5 bg-pine-600 hover:bg-pine-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-xs transition-transform active:scale-95"
        >
          <Plus size={16} />
          Cadastrar Cartão
        </button>
        {isCardModalOpen && cardForm}
      </div>
    );
  }

  // Active card calculations for the inspected invoice month
  const activeCycle = getCardBillingCycle(activeCard, activeInvoiceMonth);
  const isInvoiceClosed = isCardInvoiceClosed(activeCard, activeInvoiceMonth);
  const invoiceTransactions = getTransactionsForCard(transactions, activeCard, activeInvoiceMonth, creditCards);
  const invoiceTotal = getCardSpend(transactions, activeCard, activeInvoiceMonth, creditCards);
  const cardLimit = activeCard.limit || 5000;
  const limitUsedPercent = Math.min(Math.round((invoiceTotal / cardLimit) * 100), 100);
  const availableLimit = Math.max(cardLimit - invoiceTotal, 0);

  // Future projected spend (next month's invoice)
  const nextInvoiceTotal = getCardSpend(transactions, activeCard, nextMonthKey, creditCards);
  const nextInvoiceTxs = getTransactionsForCard(transactions, activeCard, nextMonthKey, creditCards);

  // Best day to buy calculation (1 day after closing day)
  const bestDayToBuy = activeCard.closingDay >= 28 ? 1 : activeCard.closingDay + 1;

  // Total across all cards in this invoice month for quick reference
  const totalAllCards = creditCards.reduce(
    (sum, c) => sum + getCardSpend(transactions, c, activeInvoiceMonth, creditCards),
    0
  );

  return (
    <div className="space-y-4">
      {/* 1. TOP HEADER & GLOBAL ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-sage-900">Cartões e Faturas</h2>
            <span className="px-2 py-0.5 rounded-full bg-sage-100 text-sage-700 text-[10px] font-bold">
              Total Faturas: {formatCurrency(totalAllCards)}
            </span>
          </div>
          <p className="text-xs text-sage-500">
            Acompanhe o fechamento, vencimento e extrato didático de cada fatura
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenImportCsvModal && (
            <button
              onClick={onOpenImportCsvModal}
              className="px-3 py-1.5 bg-sage-900 hover:bg-sage-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              title="Importar extrato CSV do cartão XP"
            >
              <FileSpreadsheet size={14} className="text-pine-300" />
              Importar CSV (XP)
            </button>
          )}

          <button
            onClick={handleOpenAddCard}
            className="px-3 py-1.5 bg-pine-600 hover:bg-pine-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus size={14} />
            Novo Cartão
          </button>
        </div>
      </div>

      {/* 2. CARD SELECTOR TABS (SE HOuver mais de 1 cartão) */}
      {creditCards.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {creditCards.map((card) => {
            const isSelected = card.id === activeCard.id;
            const cardSpendInMonth = getCardSpend(transactions, card, activeInvoiceMonth, creditCards);
            const isClosed = isCardInvoiceClosed(card, activeInvoiceMonth);

            return (
              <button
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border transition-all shrink-0 text-left ${
                  isSelected
                    ? 'bg-sage-900 text-white border-sage-900 shadow-md ring-2 ring-sage-900/20'
                    : 'bg-white text-sage-700 border-sage-200 hover:border-sage-300 hover:bg-sage-50'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: card.color || 'var(--color-pine-600)' }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate max-w-[120px]">{card.name}</span>
                    {isClosed && (
                      <Lock size={10} className={isSelected ? 'text-pine-300' : 'text-pine-600'} />
                    )}
                  </div>
                  <span
                    className={`text-[10px] tabular-nums block ${
                      isSelected ? 'text-sage-300' : 'text-sage-500'
                    }`}
                  >
                    {formatCurrency(cardSpendInMonth)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. UNASSIGNED CREDIT TRANSACTIONS NOTICE (SE HOUVER) */}
      {unassignedCreditTransactions.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span className="text-xs font-semibold">
              {unassignedCreditTransactions.length}{' '}
              {unassignedCreditTransactions.length === 1 ? 'gasto no crédito' : 'gastos no crédito'}{' '}
              sem cartão vinculado neste mês ({formatCurrency(
                unassignedCreditTransactions.reduce((s, t) => s + t.amount, 0)
              )})
            </span>
          </div>
          {onBulkUpdateCardId && (
            <button
              onClick={() =>
                onBulkUpdateCardId(
                  unassignedCreditTransactions.map((t) => t.id),
                  activeCard.id
                )
              }
              className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-amber-900 transition-colors flex items-center gap-1 self-start sm:self-auto"
            >
              <Link2 size={12} />
              Vincular todos ao {activeCard.name}
            </button>
          )}
        </div>
      )}

      {/* 4. MAIN DIDACTIC INVOICE CARD */}
      <div className="bg-white rounded-3xl border border-sage-200/90 shadow-sm overflow-hidden">
        <div className="finance-gradient p-4 sm:p-5 text-white relative overflow-hidden">
          {/* Subtle decorative circles */}
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute right-12 bottom-0 translate-y-12 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
                <CardIcon size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold tracking-tight">{activeCard.name}</h3>
                  <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-white/15 border border-white/20 font-medium">
                    <span aria-hidden="true" className="size-2 rounded-full ring-1 ring-white/60" style={{ backgroundColor: activeCard.color || 'var(--color-pine-300)' }} />
                    {activeCard.bankName || 'Crédito'}
                  </span>
                </div>
                <p className="text-xs text-white/80 mt-0.5">
                  Fecha todo <strong>dia {activeCard.closingDay}</strong> • Vence todo{' '}
                  <strong>dia {activeCard.dueDay}</strong>
                </p>
              </div>
            </div>

            {/* Edit / Delete actions */}
            <div className="flex items-center gap-1 self-end sm:self-center">
              <button
                onClick={() => handleOpenEditCard(activeCard)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-xl transition-colors"
                title="Editar configurações do cartão"
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={() => setPendingDeleteCard(activeCard)}
                className="p-2 text-white/80 hover:text-rose-300 hover:bg-white/15 rounded-xl transition-colors"
                title="Excluir este cartão"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* INVOICE MONTH SELECTOR TOOLBAR */}
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between flex-wrap gap-2 text-xs">
            <button
              onClick={() => changeInvoiceMonth(prevMonthKey)}
              className="flex items-center gap-1 text-white/80 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Ver fatura do mês anterior"
            >
              <ArrowLeft size={13} />
              <span>{formatMonthYear(prevMonthKey)}</span>
            </button>

            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-xs px-3 py-1 rounded-xl border border-white/20">
              <Calendar size={13} className="text-pine-600" />
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                Fatura de {formatMonthYear(activeInvoiceMonth)}
              </span>
              {isInvoiceClosed ? (
                <span className="px-1.5 py-0.2 bg-pine-800 text-white rounded text-[9px] font-bold flex items-center gap-1">
                  <Lock size={9} /> Fechada
                </span>
              ) : (
                <span className="px-1.5 py-0.2 bg-pine-500/80 text-white rounded text-[9px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Aberta
                </span>
              )}
            </div>

            <button
              onClick={() => changeInvoiceMonth(nextMonthKey)}
              className="flex items-center gap-1 text-white/80 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Ver fatura do mês seguinte"
            >
              <span>{formatMonthYear(nextMonthKey)}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* 5. INVOICE KEY NUMBERS GRID */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total desta Fatura */}
            <div className="p-3.5 rounded-2xl bg-sage-50 border border-sage-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-sage-500 mb-1">
                <span>Valor Total da Fatura</span>
                <Receipt size={14} className="text-sage-400" />
              </div>
              <div>
                <span className="text-2xl font-extrabold text-sage-900 tabular-nums tracking-tight block">
                  {formatCurrency(invoiceTotal)}
                </span>
                <span className="text-[11px] text-sage-400 mt-0.5 block">
                  {invoiceTransactions.length}{' '}
                  {invoiceTransactions.length === 1 ? 'compra computada' : 'compras computadas'}
                </span>
              </div>
            </div>

            {/* Melhor Dia de Compra */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-amber-800 mb-1">
                <span className="font-semibold flex items-center gap-1">
                  <Star size={13} className="text-amber-600 fill-amber-500" />
                  Melhor Dia de Compra
                </span>
                <span className="text-[10px] text-amber-700 bg-amber-200/60 px-1.5 py-0.5 rounded-md font-bold">
                  Dica
                </span>
              </div>
              <div>
                <span className="text-xl font-extrabold text-amber-900 block">
                  Todo dia {bestDayToBuy}
                </span>
                <span className="text-[11px] text-amber-700/90 leading-tight block mt-0.5">
                  Compras feitas a partir do dia {activeCard.closingDay} caem somente no mês seguinte!
                </span>
              </div>
            </div>

            {/* Próxima Fatura Prevista */}
            <div className="p-3.5 rounded-2xl bg-pine-50/70 border border-pine-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-pine-800 mb-1">
                <span className="font-semibold">Próxima Fatura ({formatMonthYear(nextMonthKey)})</span>
                <Clock size={14} className="text-pine-600" />
              </div>
              <div>
                <span className="text-xl font-extrabold text-pine-950 tabular-nums block">
                  {formatCurrency(nextInvoiceTotal)}
                </span>
                <button
                  onClick={() => changeInvoiceMonth(nextMonthKey)}
                  className="text-[11px] font-bold text-pine-700 hover:text-pine-900 flex items-center gap-1 mt-0.5 hover:underline"
                >
                  Ver lançamentos futuros ({nextInvoiceTxs.length}) <ArrowRight size={11} />
                </button>
              </div>
            </div>
          </div>

          {/* 6. DIDACTIC TIMELINE: O CICLO DA FATURA */}
          <div className="p-4 rounded-2xl bg-sage-50/90 border border-sage-200/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sage-800 flex items-center gap-1.5">
                <Clock size={14} className="text-pine-600" />
                Linha do Tempo Desta Fatura ({activeCycle.fullLabel})
              </span>
              <button
                onClick={() => setShowDidacticGuide(!showDidacticGuide)}
                className="text-[11px] text-pine-600 font-bold hover:underline flex items-center gap-1"
              >
                <HelpCircle size={12} />
                {showDidacticGuide ? 'Ocultar explicação' : 'Como funcionam as datas?'}
              </button>
            </div>

            {/* Interactive Step-by-Step Visual Timeline */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              {/* Step 1: Período de Compras */}
              <div className="p-2.5 rounded-xl bg-white border border-sage-200 flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-pine-100 text-pine-600 font-bold text-xs flex items-center justify-center mb-1">
                  1
                </div>
                <span className="text-[10px] text-sage-400 font-semibold uppercase">Compras Válidas</span>
                <span className="text-xs font-bold text-sage-800">{activeCycle.fullLabel}</span>
                <span className="text-[9px] text-sage-500 mt-0.5">Gastos somados nesta fatura</span>
              </div>

              {/* Step 2: Fechamento */}
              <div
                className={`p-2.5 rounded-xl border flex flex-col items-center ${
                  isInvoiceClosed
                    ? 'bg-pine-50/80 border-pine-200 text-pine-900'
                    : 'bg-white border-sage-200 text-sage-800'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center mb-1 ${
                    isInvoiceClosed
                      ? 'bg-pine-200 text-pine-800'
                      : 'bg-sage-100 text-sage-600'
                  }`}
                >
                  2
                </div>
                <span className="text-[10px] text-sage-400 font-semibold uppercase">Fechamento</span>
                <span className="text-xs font-bold">
                  Dia {activeCard.closingDay}
                  {activeCycle.manualCloseDate && (
                    <span className="block text-[9px] text-pine-700">
                      (Fechou dia {formatDateDisplay(activeCycle.manualCloseDate).slice(0, 5)})
                    </span>
                  )}
                </span>
                <span className="text-[9px] text-sage-500 mt-0.5">Fatura fecha e trava</span>
              </div>

              {/* Step 3: Vencimento */}
              <div className="p-2.5 rounded-xl bg-white border border-sage-200 flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-pine-100 text-pine-700 font-bold text-xs flex items-center justify-center mb-1">
                  3
                </div>
                <span className="text-[10px] text-sage-400 font-semibold uppercase">Vencimento</span>
                <span className="text-xs font-bold text-sage-800">Dia {activeCard.dueDay}</span>
                <span className="text-[9px] text-sage-500 mt-0.5">Pagamento da fatura</span>
              </div>
            </div>

            {/* Collapsible Didactic Explanation */}
            {showDidacticGuide && (
              <div className="mt-3 p-3 bg-white rounded-xl border border-pine-100 text-xs text-sage-600 space-y-2 animate-in fade-in">
                <p className="font-bold text-sage-800 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-pine-600" />
                  Entendendo sua fatura de forma simples:
                </p>
                <ul className="space-y-1.5 text-[11px] text-sage-600 list-disc list-inside">
                  <li>
                    <strong>Dia de Fechamento (dia {activeCard.closingDay}):</strong> É o dia em que o banco "fecha a conta" do mês. Qualquer compra que você fizer <em>antes</em> desta data entra na fatura deste mês.
                  </li>
                  <li>
                    <strong>Melhor dia para comprar (dia {bestDayToBuy}):</strong> É o dia seguinte ao fechamento. Compras feitas a partir deste dia caem direto na fatura do mês seguinte ({formatMonthYear(nextMonthKey)}), dando até 40 dias para pagar.
                  </li>
                  <li>
                    <strong>Dia de Vencimento (dia {activeCard.dueDay}):</strong> É a data limite para você pagar a fatura sem cobrança de juros.
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* 7. CONTROLE MANUAL DE FECHAMENTO (DIDÁTICO & TRANSPARENTE) */}
          <div className="p-3.5 rounded-2xl border transition-all">
            {isInvoiceClosed ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-pine-50/70 p-3 rounded-xl border border-pine-200/80">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-pine-200 text-pine-800 flex items-center justify-center shrink-0">
                    <Lock size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-pine-950">
                      Fatura de {formatMonthYear(activeInvoiceMonth)} Fechada
                    </h4>
                    <p className="text-[11px] text-pine-800">
                      O total foi congelado em <strong>{formatCurrency(invoiceTotal)}</strong>. Novas compras no {activeCard.name} são lançadas automaticamente na fatura de <strong>{formatMonthYear(nextMonthKey)}</strong>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleReopenInvoice(activeCard)}
                  className="px-3 py-1.5 bg-white hover:bg-pine-100 text-pine-800 border border-pine-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs self-start sm:self-auto"
                >
                  <Unlock size={13} />
                  Reabrir Fatura
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sage-50 p-3 rounded-xl border border-sage-200/80">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sage-200 text-sage-700 flex items-center justify-center shrink-0">
                    <Unlock size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-sage-800">
                      Fatura Aberta (Acumulando Gastos)
                    </h4>
                    <p className="text-[11px] text-sage-500">
                      Fecha automaticamente no dia {activeCard.closingDay}. Deseja fechar agora para jogar novas compras para {formatMonthYear(nextMonthKey)}?
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleInitiateCloseInvoice(activeCard)}
                  className="px-3 py-1.5 bg-sage-900 hover:bg-sage-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-2xs self-start sm:self-auto"
                >
                  <Lock size={13} className="text-pine-300" />
                  Fechar Fatura Manualmente
                </button>
              </div>
            )}
          </div>

          {/* 8. LIMITE DO CARTÃO */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-sage-600 font-semibold">
                Limite Utilizado: <strong className="text-sage-900">{limitUsedPercent}%</strong>{' '}
                ({formatCurrency(invoiceTotal)})
              </span>
              <span className="text-sage-500">
                Disponível: <strong className="text-pine-700">{formatCurrency(availableLimit)}</strong> de{' '}
                {formatCurrency(cardLimit)}
              </span>
            </div>
            <div className="w-full bg-sage-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${limitUsedPercent}%`,
                  backgroundColor: limitUsedPercent > 80 ? 'var(--color-rose-600)' : 'var(--color-pine-600)',
                }}
              />
            </div>
          </div>

          {/* 9. EXTRATO DETALHADO DOS GASTOS DA FATURA */}
          <div className="pt-3 border-t border-sage-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sage-700 flex items-center gap-1.5">
                <Receipt size={14} className="text-pine-600" />
                Extrato desta Fatura ({invoiceTransactions.length})
              </h4>
              <span className="text-xs font-bold text-sage-900 tabular-nums">
                Total: {formatCurrency(invoiceTotal)}
              </span>
            </div>

            {invoiceTransactions.length === 0 ? (
              <div className="p-6 text-center bg-sage-50/60 rounded-2xl border border-dashed border-sage-200">
                <p className="text-xs font-semibold text-sage-600">
                  Nenhuma compra nesta fatura em {formatMonthYear(activeInvoiceMonth)}.
                </p>
                <p className="text-[11px] text-sage-400 mt-0.5">
                  Gastos lançados no cartão aparecerão aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
                {invoiceTransactions.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.categoryId);
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-2.5 bg-sage-50 hover:bg-sage-100/80 rounded-xl border border-sage-200/70 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: cat ? `${cat.color}18` : 'var(--color-pine-100)' }}
                        >
                          <CategoryIcon
                            name={cat?.icon || 'Tag'}
                            size={14}
                            color={cat?.color || 'var(--color-pine-600)'}
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-sage-800 truncate">
                            {tx.description || tx.merchant || 'Compra no cartão'}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-sage-400 flex-wrap">
                            <span>{formatDateDisplay(tx.date)}</span>
                            {tx.date.slice(0, 7) !== activeInvoiceMonth && (
                              <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 font-semibold rounded text-[9px]">
                                Pós-fechamento (d.{activeCard.closingDay})
                              </span>
                            )}
                            {tx.installments && (
                              <span className="px-1.5 py-0.2 bg-pine-50 text-pine-700 font-bold rounded text-[9px]">
                                Parcela {tx.installments.current}/{tx.installments.total}
                              </span>
                            )}
                            {cat && (
                              <span className="text-pine-600 font-semibold">
                                #{cat.name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs font-bold text-rose-600 tabular-nums">
                          -{formatCurrency(tx.amount)}
                        </span>
                        {onEditTransaction && (
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-1 text-sage-400 hover:text-sage-700 rounded-lg hover:bg-white transition-colors"
                            title="Editar lançamento"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        {onDeleteTransaction && !tx.projected && (
                          <button
                            onClick={() => onDeleteTransaction(tx.id)}
                            className="p-1 text-sage-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Excluir lançamento"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL: FECHAR FATURA MANUALMENTE                               */}
      {/* ============================================================== */}
      {closingConfirmCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sage-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-sage-200 animate-in fade-in">
            <div className="flex items-center gap-2.5 text-pine-950">
              <div className="w-10 h-10 rounded-xl bg-pine-100 flex items-center justify-center text-pine-700">
                <Lock size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-sage-800">
                  Fechar Fatura: {closingConfirmCard.name}
                </h4>
                <p className="text-xs text-sage-500">
                  Mês de referência: {formatMonthYear(activeInvoiceMonth)}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-pine-50 rounded-2xl border border-pine-200/80 text-xs text-pine-950 space-y-2">
              <p className="font-semibold">O que acontece ao fechar a fatura agora:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-pine-800">
                <li>
                  Compras com data a partir do fechamento serão contabilizadas{' '}
                  <strong>automaticamente na fatura do mês seguinte ({formatMonthYear(nextMonthKey)})</strong>.
                </li>
                <li>Você pode reabrir esta fatura a qualquer momento com um clique.</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-sage-600 uppercase mb-1">
                Data do Fechamento
              </label>
              <input
                type="date"
                value={customClosingDate}
                onChange={(e) => setCustomClosingDate(e.target.value)}
                className="w-full px-3 py-2 border border-sage-200 rounded-xl text-xs font-bold bg-sage-50"
              />
              <span className="text-[11px] text-sage-400 block mt-1">
                Compras feitas a partir desta data vão para a fatura de {formatMonthYear(nextMonthKey)}.
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClosingConfirmCard(null)}
                className="flex-1 py-2 border border-sage-200 text-sage-700 text-xs font-bold rounded-xl hover:bg-sage-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseInvoice}
                className="flex-1 py-2 bg-pine-700 hover:bg-pine-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                <Lock size={13} />
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT CARTÃO                                       */}
      {/* ============================================================== */}
      {isCardModalOpen && cardForm}

      {/* ============================================================== */}
      {/* MODAL: CONFIRMAR EXCLUSÃO DE CARTÃO                            */}
      {/* ============================================================== */}
      {pendingDeleteCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sage-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-sage-200 animate-in fade-in">
            <h4 className="text-sm font-bold text-sage-800">Excluir Cartão</h4>
            <p className="text-xs text-sage-600">
              Tem certeza que deseja remover o cartão <strong>{pendingDeleteCard.name}</strong>?
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  onDeleteCreditCard(pendingDeleteCard.id);
                  setPendingDeleteCard(null);
                }}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl"
              >
                Sim, Excluir Cartão
              </button>
              <button
                onClick={() => setPendingDeleteCard(null)}
                className="w-full py-2 border border-sage-200 text-sage-600 text-xs font-bold rounded-xl hover:bg-sage-50"
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
