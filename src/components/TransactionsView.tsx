import React, { useState } from 'react';
import {
  Search,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  FileSpreadsheet,
  X,
  CreditCard as CardIcon,
  Tag,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  RotateCcw,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { Category, CreditCard, Transaction, TransactionType } from '../types';
import { CategoryIcon } from './CategoryIcon';
import {
  formatCurrency,
  formatDateDisplay,
  formatDateFull,
  formatMonthYear,
} from '../utils/formatters';
import { PAYMENT_METHOD_LABELS } from '../data/defaultData';
import { getTransactionCard, isTransactionInMonth } from '../utils/creditCardHelpers';

interface TransactionsViewProps {
  transactions: Transaction[];
  categories: Category[];
  creditCards: CreditCard[];
  selectedMonth: string;
  onChangeMonth: (monthKey: string) => void;
  onOpenQuickAdd: (type?: TransactionType) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string, deleteAllInstallments?: boolean) => void;
  onOpenSpreadsheetModal: () => void;
  onOpenImportCsvModal?: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  categories,
  creditCards,
  selectedMonth,
  onChangeMonth,
  onOpenQuickAdd,
  onEditTransaction,
  onDeleteTransaction,
  onOpenSpreadsheetModal,
  onOpenImportCsvModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all');
  const [selectedCard, setSelectedCard] = useState<string>('all');
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedType !== 'all' ||
    selectedCard !== 'all';

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedType('all');
    setSelectedCard('all');
  };

  const filtered = transactions.filter((t) => {
    if (!isTransactionInMonth(t, selectedMonth, creditCards)) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchDesc = t.description.toLowerCase().includes(term);
      const matchMerchant = t.merchant ? t.merchant.toLowerCase().includes(term) : false;
      const matchTags = t.tags ? t.tags.some((tag) => tag.toLowerCase().includes(term)) : false;
      const cat = categories.find((c) => c.id === t.categoryId);
      const matchCat = cat ? cat.name.toLowerCase().includes(term) : false;
      if (!matchDesc && !matchMerchant && !matchTags && !matchCat) return false;
    }

    if (selectedType !== 'all' && t.type !== selectedType) return false;
    if (selectedCategory !== 'all' && t.categoryId !== selectedCategory) return false;

    // Filter strictly by credit card when a card is selected
    if (selectedCard !== 'all') {
      const targetCard = creditCards.find((c) => c.id === selectedCard);
      if (!targetCard) {
        if (t.paymentMethod !== 'credit' || t.creditCardId !== selectedCard) return false;
      } else {
        if (getTransactionCard(t, creditCards)?.id !== targetCard.id) return false;
      }
    }

    return true;
  });

  const totalFilteredExpenses = filtered
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalFilteredIncome = filtered
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalFilteredIncome - totalFilteredExpenses;

  const groupedByDate: Record<string, Transaction[]> = {};
  filtered
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .forEach((tx) => {
      if (!groupedByDate[tx.date]) groupedByDate[tx.date] = [];
      groupedByDate[tx.date].push(tx);
    });

  const selectedCardObj = creditCards.find((c) => c.id === selectedCard);

  return (
    <div className="space-y-3 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-sage-800">
              Extrato de Gastos
            </h2>
            <span className="px-1.5 py-0.5 bg-sage-100 text-sage-600 text-[10px] font-bold rounded-md">
              {filtered.length}
            </span>
          </div>
          <p className="text-[10px] text-sage-400 font-medium">
            {formatMonthYear(selectedMonth)}
            {selectedCardObj ? ` • ${selectedCardObj.name}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenImportCsvModal && (
            <button
              onClick={onOpenImportCsvModal}
              className="px-2.5 py-1.5 bg-sage-900 hover:bg-sage-800 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-xs transition-transform active:scale-95"
              title="Importar Fatura CSV do Cartão XP"
            >
              <FileSpreadsheet size={13} className="text-pine-300" />
              <span>Importar CSV</span>
            </button>
          )}

          <button
            onClick={() => onOpenQuickAdd('expense')}
            className="p-1.5 bg-pine-600 hover:bg-pine-700 text-white rounded-xl text-xs font-bold flex items-center justify-center shadow-xs transition-transform active:scale-95"
            title="Adicionar Lançamento Rápido"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Mini Stats Summary Bar */}
      <div className="grid grid-cols-3 gap-1.5 p-2 bg-sage-50/80 border border-sage-200/80 rounded-2xl">
        <div className="bg-white p-2 rounded-xl border border-sage-100 shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] text-sage-400 font-semibold">
            <ArrowDownRight size={12} className="text-rose-500" />
            <span>Saídas</span>
          </div>
          <p className="text-xs font-bold tabular-nums text-rose-600 truncate mt-0.5">
            {formatCurrency(totalFilteredExpenses)}
          </p>
        </div>

        <div className="bg-white p-2 rounded-xl border border-sage-100 shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] text-sage-400 font-semibold">
            <ArrowUpRight size={12} className="text-pine-600" />
            <span>Entradas</span>
          </div>
          <p className="text-xs font-bold tabular-nums text-pine-600 truncate mt-0.5">
            {formatCurrency(totalFilteredIncome)}
          </p>
        </div>

        <div className="bg-white p-2 rounded-xl border border-sage-100 shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] text-sage-400 font-semibold">
            <Filter size={11} className="text-sage-400" />
            <span>Líquido</span>
          </div>
          <p
            className={`text-xs font-bold tabular-nums truncate mt-0.5 ${
              netBalance >= 0 ? 'text-sage-800' : 'text-rose-600'
            }`}
          >
            {formatCurrency(netBalance)}
          </p>
        </div>
      </div>

      {/* Search Input with Clear Button */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar local (ex: Mercado, Bomfrios), tag (#XP)..."
          className="w-full pl-8 pr-8 py-2 bg-white border border-sage-200 rounded-xl text-xs text-sage-800 placeholder-sage-400 focus:outline-none focus:ring-2 focus:ring-pine-600/30 transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-sage-400 hover:text-sage-600 rounded-full"
            title="Limpar busca"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Filter Tabs (Todos / Gastos / Entradas) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
        <button
          onClick={() => setSelectedType('all')}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition-all ${
            selectedType === 'all'
              ? 'bg-pine-600 text-white shadow-xs'
              : 'bg-white border border-sage-200 text-sage-600 hover:bg-sage-50'
          }`}
        >
          Todos ({filtered.length})
        </button>
        <button
          onClick={() => setSelectedType('expense')}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition-all ${
            selectedType === 'expense'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white border border-sage-200 text-sage-600 hover:bg-sage-50'
          }`}
        >
          Gastos ({formatCurrency(totalFilteredExpenses)})
        </button>
        <button
          onClick={() => setSelectedType('income')}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition-all ${
            selectedType === 'income'
              ? 'bg-pine-600 text-white shadow-xs'
              : 'bg-white border border-sage-200 text-sage-600 hover:bg-sage-50'
          }`}
        >
          Entradas ({formatCurrency(totalFilteredIncome)})
        </button>
      </div>

      {/* Filter Dropdowns: Credit Cards only & Categories */}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {/* Credit Card Filter (Contains ONLY Credit Cards) */}
        <div className="relative">
          <select
            value={selectedCard}
            onChange={(e) => setSelectedCard(e.target.value)}
            className="w-full pl-2.5 pr-7 py-2 bg-white border border-sage-200 rounded-xl text-[11px] text-sage-800 font-semibold truncate appearance-none focus:outline-none focus:ring-2 focus:ring-pine-600/30 shadow-2xs"
          >
            <option value="all">💳 Todos os Cartões</option>
            {creditCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sage-400 pointer-events-none"
          />
        </div>

        {/* Category / Tags Filter */}
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full pl-2.5 pr-7 py-2 bg-white border border-sage-200 rounded-xl text-[11px] text-sage-800 font-semibold truncate appearance-none focus:outline-none focus:ring-2 focus:ring-pine-600/30 shadow-2xs"
          >
            <option value="all">🏷️ Todas as Categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sage-400 pointer-events-none"
          />
        </div>
      </div>

      {/* Active filters indicator & reset button */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between px-1 text-[11px] text-sage-500">
          <span className="flex items-center gap-1 font-medium">
            <Filter size={11} className="text-pine-600" />
            Filtro ativo • {filtered.length} registro(s)
          </span>
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 text-[10px] text-pine-600 hover:text-pine-800 font-bold bg-pine-600/10 hover:bg-pine-600/20 px-2 py-0.5 rounded-lg transition-colors"
          >
            <RotateCcw size={10} />
            <span>Limpar filtros</span>
          </button>
        </div>
      )}

      {/* Grouped list of Transactions */}
      {Object.keys(groupedByDate).length === 0 ? (
        <div className="p-8 bg-white rounded-2xl border border-sage-200 text-center space-y-2 shadow-2xs">
          <div className="w-10 h-10 mx-auto rounded-full bg-sage-100 flex items-center justify-center text-sage-400">
            <Search size={18} />
          </div>
          <p className="text-xs font-bold text-sage-700">Nenhum lançamento encontrado</p>
          <p className="text-[11px] text-sage-400 max-w-[240px] mx-auto">
            {hasActiveFilters
              ? 'Tente remover os filtros ou buscar por outros termos.'
              : 'Não há registros para o mês selecionado.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="mt-2 px-3 py-1.5 bg-sage-100 hover:bg-sage-200 text-sage-700 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={12} />
              <span>Restaurar todos os lançamentos</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedByDate).map(([dateKey, items]) => {
            const dayExpenseSum = items
              .filter((i) => i.type === 'expense')
              .reduce((sum, i) => sum + i.amount, 0);

            const dayIncomeSum = items
              .filter((i) => i.type === 'income')
              .reduce((sum, i) => sum + i.amount, 0);

            return (
              <div key={dateKey} className="space-y-1">
                {/* Date header */}
                <div className="flex items-center justify-between px-1.5 text-[10px] font-bold text-sage-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} className="text-sage-400" />
                    {formatDateFull(dateKey)} ({formatDateDisplay(dateKey)})
                  </span>
                  <div className="flex items-center gap-2">
                    {dayIncomeSum > 0 && (
                      <span className="text-pine-600 tabular-nums">+{formatCurrency(dayIncomeSum)}</span>
                    )}
                    {dayExpenseSum > 0 && (
                      <span className="text-sage-600 tabular-nums">-{formatCurrency(dayExpenseSum)}</span>
                    )}
                  </div>
                </div>

                {/* Date items container */}
                <div className="bg-white rounded-2xl border border-sage-200/80 shadow-2xs divide-y divide-sage-100 overflow-hidden">
                  {items.map((tx) => {
                    const cat = categories.find((c) => c.id === tx.categoryId);
                    const card =
                      getTransactionCard(tx, creditCards);
                    const isExpense = tx.type === 'expense';
                    const mainTitle = tx.merchant || tx.description;
                    const subtitle = tx.merchant ? tx.description : '';

                    return (
                      <div
                        key={tx.id}
                        className="p-3 flex items-center justify-between gap-2.5 hover:bg-sage-50/80 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Category Icon */}
                          <div
                            className="w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 border border-black/5"
                            style={{ backgroundColor: cat ? `${cat.color}18` : '#f1f5f9' }}
                          >
                            <CategoryIcon
                              name={cat?.icon || 'Tag'}
                              size={15}
                              color={cat?.color || '#64748b'}
                            />
                          </div>

                          <div className="min-w-0">
                            {/* Merchant / Description */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-sage-900 truncate max-w-[170px] sm:max-w-[220px]">
                                {mainTitle}
                              </h4>

                              {/* Installment Badge */}
                              {tx.installments && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-pine-100 text-pine-800 font-bold rounded-md flex items-center gap-0.5 shrink-0">
                                  <Layers size={9} />
                                  {tx.installments.current}/{tx.installments.total}
                                </span>
                              )}

                              {/* Fixed Expense Badge */}
                              {tx.isFixed && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-pine-50 text-pine-700 font-bold rounded-md shrink-0">
                                  {tx.projected ? 'Previsto' : 'Fixo'}
                                </span>
                              )}
                            </div>

                            {/* Tags, Card & Payment Info */}
                            <div className="flex items-center gap-1.5 text-[10px] text-sage-400 mt-0.5 flex-wrap">
                              {/* Tag / Category */}
                              {tx.tags && tx.tags.length > 0 ? (
                                <span className="text-pine-600 font-bold tabular-nums">
                                  {tx.tags.join(' ')}
                                </span>
                              ) : (
                                <span>#{cat?.name.split(' ')[0]}</span>
                              )}

                              <span>•</span>

                              {/* Credit Card badge or Payment Method */}
                              {tx.paymentMethod === 'credit' && card ? (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span
                                    className="font-bold text-[9px] px-1.5 py-0.5 rounded-md text-white shadow-2xs"
                                    style={{ backgroundColor: card.color }}
                                  >
                                    {card.name}
                                  </span>
                                  {tx.date.slice(0, 7) !== selectedMonth && (
                                    <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded-md">
                                      Compra {formatDateDisplay(tx.date)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sage-500 font-medium">
                                  {PAYMENT_METHOD_LABELS[tx.paymentMethod]?.label || tx.paymentMethod}
                                </span>
                              )}
                            </div>

                            {/* Subtitle / Note */}
                            {subtitle && subtitle !== mainTitle && (
                              <p className="text-[10px] text-sage-400 italic truncate mt-0.5">
                                {subtitle}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Amount & Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              isExpense ? 'text-rose-600' : 'text-pine-600'
                            }`}
                          >
                            {isExpense ? '- ' : '+ '}
                            {formatCurrency(tx.amount)}
                          </span>

                          <div className="flex items-center">
                            <button
                              onClick={() => onEditTransaction(tx)}
                              className="p-1.5 text-sage-400 hover:text-sage-800 hover:bg-sage-100 rounded-lg transition-colors"
                              title="Editar Lançamento"
                            >
                              <Edit2 size={13} />
                            </button>
                            {!tx.projected && <button
                              onClick={() => setPendingDeleteTx(tx)}
                              className="p-1.5 text-sage-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Excluir Lançamento"
                            >
                              <Trash2 size={13} />
                            </button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal for Installments / Single Items */}
      {pendingDeleteTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sage-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-sage-200">
            <h4 className="text-sm font-bold text-sage-800">
              Excluir lançamento
            </h4>
            <p className="text-xs text-sage-600">
              Deseja remover <strong>{pendingDeleteTx.merchant || pendingDeleteTx.description}</strong> ({formatCurrency(pendingDeleteTx.amount)})?
            </p>

            {pendingDeleteTx.installments && (
              <p className="text-xs text-pine-700 bg-pine-50 p-2.5 rounded-xl border border-pine-200">
                Esta é a parcela <strong>{pendingDeleteTx.installments.current} de {pendingDeleteTx.installments.total}</strong>.
              </p>
            )}

            <div className="space-y-2 pt-1">
              {pendingDeleteTx.installments ? (
                <>
                  <button
                    onClick={() => {
                      onDeleteTransaction(pendingDeleteTx.id, false);
                      setPendingDeleteTx(null);
                    }}
                    className="w-full py-2 bg-sage-100 hover:bg-sage-200 text-sage-800 text-xs font-bold rounded-xl transition-colors"
                  >
                    Excluir Apenas Esta Parcela ({pendingDeleteTx.installments.current}/{pendingDeleteTx.installments.total})
                  </button>
                  <button
                    onClick={() => {
                      onDeleteTransaction(pendingDeleteTx.id, true);
                      setPendingDeleteTx(null);
                    }}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Excluir Todas as {pendingDeleteTx.installments.total} Parcelas da Compra
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    onDeleteTransaction(pendingDeleteTx.id, false);
                    setPendingDeleteTx(null);
                  }}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Sim, Excluir Lançamento
                </button>
              )}

              <button
                onClick={() => setPendingDeleteTx(null)}
                className="w-full py-2 border border-sage-200 text-sage-600 text-xs font-bold rounded-xl hover:bg-sage-50 transition-colors"
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

