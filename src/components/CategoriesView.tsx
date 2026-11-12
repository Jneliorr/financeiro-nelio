import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Tag,
  Check,
  AlertCircle,
  X,
  Store,
  Search,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react';
import { Category, CreditCard, Transaction, TransactionType } from '../types';
import { CategoryIcon, AVAILABLE_ICONS, AVAILABLE_COLORS } from './CategoryIcon';
import { formatCurrency } from '../utils/formatters';
import { isTransactionInMonth } from '../utils/creditCardHelpers';

export const DEFAULT_MERCHANTS_LIST = [
  'Bons Frion',
  'Casa do Grão',
  'Mercadinho',
  'Padaria',
];

interface CategoriesViewProps {
  categories: Category[];
  creditCards?: CreditCard[];
  transactions: Transaction[];
  currentMonthKey: string;
  onAddCategory: (category: Omit<Category, 'id'>) => void;
  onUpdateCategory: (id: string, updated: Partial<Category>) => void;
  onDeleteCategory: (id: string) => void;
  merchants?: string[];
  onAddMerchant?: (name: string) => void;
  onUpdateMerchant?: (oldName: string, newName: string) => void;
  onDeleteMerchant?: (name: string) => void;
  onResetMerchants?: () => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  creditCards = [],
  transactions,
  currentMonthKey,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  merchants = DEFAULT_MERCHANTS_LIST,
  onAddMerchant,
  onUpdateMerchant,
  onDeleteMerchant,
  onResetMerchants,
}) => {
  // Main view switcher: 'categories' | 'merchants'
  const [mainSection, setMainSection] = useState<'categories' | 'merchants'>('categories');

  // Categories Section State
  const [categoryTypeTab, setCategoryTypeTab] = useState<TransactionType>('expense');
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Category Form State
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('Tag');
  const [catColor, setCatColor] = useState('#F97316');
  const [catType, setCatType] = useState<TransactionType>('expense');
  const [catBudgetStr, setCatBudgetStr] = useState('');
  const [catError, setCatError] = useState('');

  // Merchants Section State
  const [merchantSearch, setMerchantSearch] = useState('');
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<string | null>(null);
  const [merchantNameInput, setMerchantNameInput] = useState('');
  const [merchantError, setMerchantError] = useState('');

  const filteredCategories = categories.filter((c) => c.type === categoryTypeTab);

  // Filter transactions in month
  const monthTransactions = transactions.filter((t) =>
    isTransactionInMonth(t, currentMonthKey, creditCards)
  );

  const getCategorySpent = (categoryId: string) => {
    return monthTransactions
      .filter((t) => t.categoryId === categoryId)
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // Stats for each merchant
  const getMerchantStats = (merchantName: string) => {
    const matched = monthTransactions.filter((t) => {
      const matchMerchant = t.merchant && t.merchant.toLowerCase() === merchantName.toLowerCase();
      const matchDesc = t.description && t.description.toLowerCase().includes(merchantName.toLowerCase());
      return matchMerchant || matchDesc;
    });

    const total = matched.reduce((sum, t) => sum + t.amount, 0);
    return { count: matched.length, total };
  };

  // Handlers for Categories
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatIcon('Tag');
    setCatColor(AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)]);
    setCatType(categoryTypeTab);
    setCatBudgetStr('');
    setCatError('');
    setIsCategoryFormOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatIcon(cat.icon);
    setCatColor(cat.color);
    setCatType(cat.type);
    setCatBudgetStr(cat.monthlyBudget ? String(cat.monthlyBudget) : '');
    setCatError('');
    setIsCategoryFormOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      setCatError('Por favor, informe um nome para a categoria.');
      return;
    }

    const budget = catBudgetStr ? parseFloat(catBudgetStr.replace(',', '.')) : undefined;

    if (editingCategory) {
      onUpdateCategory(editingCategory.id, {
        name: catName.trim(),
        icon: catIcon,
        color: catColor,
        type: catType,
        monthlyBudget: budget && budget > 0 ? budget : undefined,
      });
    } else {
      onAddCategory({
        name: catName.trim(),
        icon: catIcon,
        color: catColor,
        type: catType,
        monthlyBudget: budget && budget > 0 ? budget : undefined,
      });
    }

    setIsCategoryFormOpen(false);
  };

  // Handlers for Merchants
  const handleOpenAddMerchant = () => {
    setEditingMerchant(null);
    setMerchantNameInput('');
    setMerchantError('');
    setIsMerchantModalOpen(true);
  };

  const handleOpenEditMerchant = (merchant: string) => {
    setEditingMerchant(merchant);
    setMerchantNameInput(merchant);
    setMerchantError('');
    setIsMerchantModalOpen(true);
  };

  const handleSaveMerchant = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = merchantNameInput.trim();
    if (!trimmed) {
      setMerchantError('Por favor, digite o nome do estabelecimento.');
      return;
    }

    // Check duplicate
    const isDuplicate = merchants.some(
      (m) =>
        m.toLowerCase() === trimmed.toLowerCase() &&
        (!editingMerchant || editingMerchant.toLowerCase() !== trimmed.toLowerCase())
    );

    if (isDuplicate) {
      setMerchantError('Já existe um estabelecimento cadastrado com esse nome.');
      return;
    }

    if (editingMerchant) {
      if (onUpdateMerchant) {
        onUpdateMerchant(editingMerchant, trimmed);
      }
    } else {
      if (onAddMerchant) {
        onAddMerchant(trimmed);
      }
    }

    setIsMerchantModalOpen(false);
  };

  const handleDeleteMerchantAction = (merchant: string) => {
    if (confirm(`Excluir "${merchant}" das opções de estabelecimento?`)) {
      if (onDeleteMerchant) {
        onDeleteMerchant(merchant);
      }
    }
  };

  const filteredMerchants = merchants.filter((m) =>
    m.toLowerCase().includes(merchantSearch.trim().toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Primary Switcher: Categorias vs Estabelecimentos */}
      <div className="flex bg-sage-200/80 p-1 rounded-2xl gap-1 shadow-inner">
        <button
          type="button"
          onClick={() => setMainSection('categories')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            mainSection === 'categories'
              ? 'bg-white text-sage-900 shadow-xs'
              : 'text-sage-600 hover:text-sage-900'
          }`}
        >
          <Tag
            size={14}
            className={mainSection === 'categories' ? 'text-pine-600' : 'text-sage-400'}
          />
          <span>Categorias ({categories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMainSection('merchants')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            mainSection === 'merchants'
              ? 'bg-white text-sage-900 shadow-xs'
              : 'text-sage-600 hover:text-sage-900'
          }`}
        >
          <Store
            size={14}
            className={mainSection === 'merchants' ? 'text-pine-600' : 'text-sage-400'}
          />
          <span>Estabelecimentos ({merchants.length})</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: ESTABELECIMENTOS & DESCRIÇÕES                        */}
      {/* ============================================================== */}
      {mainSection === 'merchants' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Header & Add Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-sage-900 flex items-center gap-2">
                <Store size={18} className="text-pine-600" />
                Estabelecimentos e Descrições
              </h2>
              <p className="text-xs text-sage-500">
                Opções que aparecem na busca ao lançar uma compra
              </p>
            </div>
            <button
              onClick={handleOpenAddMerchant}
              className="flex items-center gap-1.5 px-3 py-2 bg-pine-600 hover:bg-pine-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              <Plus size={15} />
              Novo Local
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" />
            <input
              type="text"
              value={merchantSearch}
              onChange={(e) => setMerchantSearch(e.target.value)}
              placeholder="Buscar estabelecimento cadastrado..."
              className="w-full pl-8 pr-4 py-2 bg-white border border-sage-200 rounded-xl text-xs text-sage-800 focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600"
            />
            {merchantSearch && (
              <button
                onClick={() => setMerchantSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Merchants List */}
          <div className="space-y-2">
            {filteredMerchants.map((merchant) => {
              const stats = getMerchantStats(merchant);

              return (
                <div
                  key={merchant}
                  className="p-3 bg-white rounded-2xl border border-sage-200/80 shadow-2xs hover:border-sage-300 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-pine-50 text-pine-600 border border-pine-100 flex items-center justify-center shrink-0">
                      <Store size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-sage-800 truncate">{merchant}</h3>
                      <p className="text-xs text-sage-500">
                        {stats.count > 0 ? (
                          <>
                            {stats.count} {stats.count === 1 ? 'gasto' : 'gastos'} neste mês •{' '}
                            <strong className="text-sage-700">{formatCurrency(stats.total)}</strong>
                          </>
                        ) : (
                          <span className="text-sage-400">Nenhum gasto neste mês</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditMerchant(merchant)}
                      className="p-2 text-sage-400 hover:text-sage-700 rounded-lg hover:bg-sage-100 transition-colors"
                      title="Editar nome"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteMerchantAction(merchant)}
                      className="p-2 text-sage-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Excluir estabelecimento"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredMerchants.length === 0 && (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-sage-200 space-y-3">
                <Store size={32} className="mx-auto text-sage-300" />
                <p className="text-xs font-semibold text-sage-600">
                  {merchantSearch
                    ? 'Nenhum estabelecimento encontrado com essa busca.'
                    : 'Nenhum estabelecimento cadastrado no momento.'}
                </p>
                {onResetMerchants && (
                  <button
                    onClick={onResetMerchants}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sage-100 hover:bg-sage-200 text-sage-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    <RotateCcw size={13} />
                    Restaurar padrões (Bons Frion, Casa do Grão, Mercadinho, Padaria)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 2: CATEGORIAS                                          */}
      {/* ============================================================== */}
      {mainSection === 'categories' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Header & Add Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-sage-900">Categorias de Gastos e Ganhos</h2>
              <p className="text-xs text-sage-500">Personalize suas categorias</p>
            </div>
            <button
              onClick={handleOpenAddCategory}
              className="flex items-center gap-1.5 px-3 py-2 bg-pine-600 hover:bg-pine-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              <Plus size={15} />
              Nova Categoria
            </button>
          </div>

          {/* Sub-Tabs: Despesas vs Receitas */}
          <div className="grid grid-cols-2 p-1 bg-sage-200/70 rounded-xl gap-1">
            <button
              onClick={() => setCategoryTypeTab('expense')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                categoryTypeTab === 'expense'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-sage-600 hover:text-sage-900'
              }`}
            >
              💸 Despesas ({categories.filter((c) => c.type === 'expense').length})
            </button>
            <button
              onClick={() => setCategoryTypeTab('income')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                categoryTypeTab === 'income'
                  ? 'bg-white text-pine-600 shadow-xs'
                  : 'text-sage-600 hover:text-sage-900'
              }`}
            >
              💰 Receitas ({categories.filter((c) => c.type === 'income').length})
            </button>
          </div>

          {/* Categories List */}
          <div className="space-y-2.5">
            {filteredCategories.map((category) => {
              const spent = getCategorySpent(category.id);
              const hasBudget = category.monthlyBudget && category.monthlyBudget > 0;
              const budgetPercent = hasBudget
                ? Math.min(Math.round((spent / (category.monthlyBudget || 1)) * 100), 100)
                : 0;
              const isOverBudget = hasBudget && spent > (category.monthlyBudget || 0);

              return (
                <div
                  key={category.id}
                  className="p-3.5 bg-white rounded-2xl border border-sage-200/80 shadow-2xs hover:border-sage-300 transition-all flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${category.color}18` }}
                      >
                        <CategoryIcon name={category.icon} size={20} color={category.color} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-sage-800">{category.name}</h3>
                        <p className="text-xs text-sage-500">
                          Gasto neste mês: <strong className="text-sage-700">{formatCurrency(spent)}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditCategory(category)}
                        className="p-1.5 text-sage-400 hover:text-sage-700 rounded-lg hover:bg-sage-100 transition-colors"
                        title="Editar categoria"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Excluir a categoria "${category.name}"?`)) {
                            onDeleteCategory(category.id);
                          }
                        }}
                        className="p-1.5 text-sage-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Excluir categoria"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Budget bar if present */}
                  {hasBudget && (
                    <div className="pt-2 border-t border-sage-100">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-sage-500">
                          Orçamento mensal: {formatCurrency(category.monthlyBudget!)}
                        </span>
                        <span
                          className={`font-semibold ${
                            isOverBudget ? 'text-rose-600' : 'text-sage-600'
                          }`}
                        >
                          {budgetPercent}% {isOverBudget && '(Excedido!)'}
                        </span>
                      </div>
                      <div className="w-full bg-sage-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOverBudget
                              ? 'bg-rose-500'
                              : budgetPercent > 80
                              ? 'bg-amber-500'
                              : 'bg-pine-500'
                          }`}
                          style={{ width: `${budgetPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT ESTABELECIMENTO                              */}
      {/* ============================================================== */}
      {isMerchantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sage-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-sage-100 flex items-center justify-between bg-sage-50">
              <h3 className="font-bold text-sage-800 text-base flex items-center gap-2">
                <Store size={18} className="text-pine-600" />
                {editingMerchant ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}
              </h3>
              <button
                onClick={() => setIsMerchantModalOpen(false)}
                className="p-1 text-sage-400 hover:text-sage-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMerchant} className="p-5 space-y-4">
              {merchantError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {merchantError}
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold text-sage-600 mb-1">
                  Nome do Estabelecimento / Descrição
                </label>
                <input
                  type="text"
                  autoFocus
                  value={merchantNameInput}
                  onChange={(e) => setMerchantNameInput(e.target.value)}
                  placeholder="Ex: Padaria, Posto Shell, Açougue..."
                  className="w-full px-3.5 py-2.5 border border-sage-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600 font-semibold"
                />
                <p className="text-[11px] text-sage-400 mt-1.5">
                  Esse nome aparecerá no menu rápido quando você for lançar um gasto.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-sage-100">
                <button
                  type="button"
                  onClick={() => setIsMerchantModalOpen(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-sage-200 text-sage-700 text-xs font-bold hover:bg-sage-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 px-3 rounded-xl bg-pine-600 hover:bg-pine-800 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check size={16} />
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT CATEGORY                                     */}
      {/* ============================================================== */}
      {isCategoryFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sage-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-sage-100 flex items-center justify-between bg-sage-50">
              <h3 className="font-bold text-sage-800 text-base">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button
                onClick={() => setIsCategoryFormOpen(false)}
                className="p-1 text-sage-400 hover:text-sage-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-4 overflow-y-auto flex-1">
              {catError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {catError}
                </p>
              )}

              {/* Type */}
              <div>
                <label className="block text-xs font-semibold text-sage-600 mb-1">
                  Tipo da Categoria
                </label>
                <div className="grid grid-cols-2 p-1 bg-sage-100 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setCatType('expense')}
                    className={`py-1.5 text-xs font-bold rounded-lg ${
                      catType === 'expense'
                        ? 'bg-white text-rose-700 shadow-xs'
                        : 'text-sage-600'
                    }`}
                  >
                    💸 Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatType('income')}
                    className={`py-1.5 text-xs font-bold rounded-lg ${
                      catType === 'income'
                        ? 'bg-white text-pine-700 shadow-xs'
                        : 'text-sage-600'
                    }`}
                  >
                    💰 Receita
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-sage-600 mb-1">
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Ex: Lanches, Farmácia, Jogos..."
                  className="w-full px-3.5 py-2 border border-sage-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600"
                />
              </div>

              {/* Optional Monthly Budget */}
              {catType === 'expense' && (
                <div>
                  <label className="block text-xs font-semibold text-sage-600 mb-1">
                    Meta / Teto de Gasto Mensal (Opcional - R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={catBudgetStr}
                    onChange={(e) => setCatBudgetStr(e.target.value)}
                    placeholder="Ex: 500,00"
                    className="w-full px-3.5 py-2 border border-sage-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600"
                  />
                  <p className="text-[11px] text-sage-400 mt-1">
                    Ajuda a acompanhar se você está gastando mais do que planejou.
                  </p>
                </div>
              )}

              {/* Color picker */}
              <div>
                <label className="block text-xs font-semibold text-sage-600 mb-1.5">
                  Cor da Categoria
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatColor(c)}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                    >
                      {catColor === c && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon picker */}
              <div>
                <label className="block text-xs font-semibold text-sage-600 mb-1.5">
                  Ícone
                </label>
                <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1 bg-sage-50 rounded-xl border border-sage-100">
                  {AVAILABLE_ICONS.map((ic) => {
                    const isSelected = catIcon === ic;
                    return (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setCatIcon(ic)}
                        className={`p-2 rounded-xl flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-sage-900 text-white shadow-xs'
                            : 'bg-white text-sage-600 hover:bg-sage-200'
                        }`}
                      >
                        <CategoryIcon name={ic} size={18} color={isSelected ? '#ffffff' : catColor} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 bg-sage-50 rounded-xl border border-sage-200/60 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${catColor}20` }}
                >
                  <CategoryIcon name={catIcon} size={20} color={catColor} />
                </div>
                <div>
                  <span className="text-xs text-sage-400 block">Prévia visual:</span>
                  <span className="text-sm font-bold text-sage-800">
                    {catName || 'Nome da Categoria'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-sage-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryFormOpen(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-sage-200 text-sage-700 text-xs font-bold hover:bg-sage-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2.5 px-3 rounded-xl bg-pine-600 hover:bg-pine-800 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check size={16} />
                  Salvar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
