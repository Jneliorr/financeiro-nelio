import React, { useState } from 'react';
import {
  PieChart as PieChartIcon,
  CreditCard as CardIcon,
  RefreshCw,
  ArrowRight,
  TrendingDown,
  Layers,
  Sparkles,
  Tag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Category, CreditCard, FixedExpense, Transaction } from '../types';
import { formatCurrency, formatMonthYear } from '../utils/formatters';
import { getCardSpend, isTransactionInMonth } from '../utils/creditCardHelpers';
import { getFixedExpenseAmountForMonth, getTotalFixedForMonth } from '../utils/fixedExpenseHelpers';
import { CategoryIcon } from './CategoryIcon';

interface FixedAndCardsPieChartProps {
  categories?: Category[];
  fixedExpenses: FixedExpense[];
  creditCards: CreditCard[];
  transactions: Transaction[];
  selectedMonth: string;
  hideBalance: boolean;
  onNavigateToFixed?: () => void;
  onNavigateToCards?: () => void;
  onNavigateToCategories?: () => void;
}

interface SliceData {
  id: string;
  label: string;
  amount: number;
  color: string;
  kind: 'fixed' | 'card' | 'category';
  cardDetails?: CreditCard;
  categoryDetails?: Category;
  count?: number;
}

export const FixedAndCardsPieChart: React.FC<FixedAndCardsPieChartProps> = ({
  categories = [],
  fixedExpenses,
  creditCards,
  transactions,
  selectedMonth,
  hideBalance,
  onNavigateToFixed,
  onNavigateToCards,
  onNavigateToCategories,
}) => {
  const [viewMode, setViewMode] = useState<'macro' | 'detailed' | 'category'>('macro');
  const [pinnedSliceId, setPinnedSliceId] = useState<string | null>(null);
  const [hoveredSliceId, setHoveredSliceId] = useState<string | null>(null);
  const activeSliceId = hoveredSliceId || pinnedSliceId;
  const [isExpandedCategories, setIsExpandedCategories] = useState(false);

  // 1. Calculate active fixed expenses for the selected month (considering monthly invoices/adjustments)
  const activeFixedList = fixedExpenses.filter((f) => f.active && f.type === 'expense');
  const totalFixed = getTotalFixedForMonth(fixedExpenses, selectedMonth, 'expense', transactions);

  // 2. Calculate credit card spends for the selected month
  const cardsWithSpend = creditCards.map((card) => {
    const spent = getCardSpend(transactions, card, selectedMonth, creditCards);
    return {
      card,
      spent,
    };
  });

  const totalCards = cardsWithSpend.reduce((sum, c) => sum + c.spent, 0);
  const totalFixedAndCards = totalFixed + totalCards;

  // 3. Calculate category breakdown for the selected month
  const monthExpenseTxs = transactions.filter(
    (t) => t.type === 'expense' && isTransactionInMonth(t, selectedMonth, creditCards)
  );

  // Unprojected fixed expenses (so that fixed utilities/streaming also count towards categories if not yet converted to transactions)
  const unprojectedFixed = fixedExpenses.filter(
    (f) =>
      f.active &&
      f.type === 'expense' &&
      !monthExpenseTxs.some(
        (t) => t.fixedExpenseId === f.id || t.id === `tx-fix-${f.id}-${selectedMonth}`
      )
  );

  const categoryMap: Record<
    string,
    {
      category?: Category;
      amount: number;
      count: number;
    }
  > = {};

  monthExpenseTxs.forEach((tx) => {
    const catId = tx.categoryId || 'uncategorized';
    if (!categoryMap[catId]) {
      const foundCat = categories.find((c) => c.id === catId);
      categoryMap[catId] = {
        category: foundCat,
        amount: 0,
        count: 0,
      };
    }
    categoryMap[catId].amount += tx.amount;
    categoryMap[catId].count += 1;
  });

  unprojectedFixed.forEach((f) => {
    const catId = f.categoryId || 'uncategorized';
    const fAmount = getFixedExpenseAmountForMonth(f, selectedMonth, transactions);
    if (!categoryMap[catId]) {
      const foundCat = categories.find((c) => c.id === catId);
      categoryMap[catId] = {
        category: foundCat,
        amount: 0,
        count: 0,
      };
    }
    categoryMap[catId].amount += fAmount;
    categoryMap[catId].count += 1;
  });

  const fallbackCategoryPalette = [
    '#FF9500', // Apple Orange
    '#34C759', // Apple Green
    '#007AFF', // Apple Blue
    '#AF52DE', // Apple Purple
    '#FF2D55', // Apple Pink
    '#5856D6', // Apple Indigo
    '#30B0C7', // Apple Teal
    '#FF3B30', // Apple Red
    '#8E8E93', // Apple Gray
    '#A2845E', // Apple Brown
  ];

  const categoryList = Object.entries(categoryMap)
    .filter(([_, data]) => data.amount > 0)
    .map(([catId, data], index) => {
      const name = data.category ? data.category.name : 'Outros / Sem Categoria';
      const color =
        data.category?.color || fallbackCategoryPalette[index % fallbackCategoryPalette.length];
      return {
        id: `cat-${catId}`,
        categoryId: catId,
        category: data.category,
        name,
        amount: data.amount,
        count: data.count,
        color,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const totalCategorySpend = categoryList.reduce((sum, c) => sum + c.amount, 0);

  // Total committed based on active view mode:
  // In 'detailed' (Por Cartão): SOMENTE o total dos cartões!
  // In 'category': total das categorias.
  // In 'macro': total fixos + cartões.
  const totalCommitted =
    viewMode === 'detailed'
      ? totalCards
      : viewMode === 'category'
      ? totalCategorySpend
      : totalFixedAndCards;

  // Build slices based on viewMode
  let slices: SliceData[] = [];

  if (viewMode === 'macro') {
    // Macro view: Gastos Fixos vs Total dos Cartões
    if (totalFixed > 0) {
      slices.push({
        id: 'macro-fixed',
        label: 'Gastos Fixos',
        amount: totalFixed,
        color: '#007AFF', // Apple System Blue
        kind: 'fixed',
      });
    }
    if (totalCards > 0) {
      slices.push({
        id: 'macro-cards',
        label: 'Faturas dos Cartões',
        amount: totalCards,
        color: '#AF52DE', // Apple System Purple
        kind: 'card',
      });
    }
  } else if (viewMode === 'detailed') {
    // Detailed view (Por Cartão): SOMENTE os cartões de crédito (SEM gastos fixos!)
    cardsWithSpend.forEach(({ card, spent }, idx) => {
      if (spent > 0) {
        const fallbackColors = [
          '#AF52DE', // Apple Purple
          '#FF9500', // Apple Orange
          '#FF2D55', // Apple Pink
          '#34C759', // Apple Green
          '#007AFF', // Apple Blue
          '#30B0C7', // Apple Teal
          '#5856D6', // Apple Indigo
        ];
        const color = card.color || fallbackColors[idx % fallbackColors.length];
        slices.push({
          id: `card-${card.id}`,
          label: card.name,
          amount: spent,
          color,
          kind: 'card',
          cardDetails: card,
        });
      }
    });
  } else {
    // Category view: Gastos por Categoria (Alimentação, Streaming, Diversão, etc.)
    categoryList.forEach((catItem) => {
      slices.push({
        id: catItem.id,
        label: catItem.name,
        amount: catItem.amount,
        color: catItem.color,
        kind: 'category',
        categoryDetails: catItem.category,
        count: catItem.count,
      });
    });
  }

  // Active slice calculation for donut center focus
  const activeSlice = activeSliceId ? slices.find((s) => s.id === activeSliceId) : null;

  // SVG Geometry - Apple Activity Rings Style with Uniform Angular Gaps & Rounded Caps
  const cx = 100;
  const cy = 100;
  const r = 70;
  const strokeWidth = 14;

  const N = slices.length;
  // Uniform visual gap between every adjacent pair of slices (~5.5 degrees)
  const gapAngle = N > 1 ? 0.095 : 0;
  const totalGaps = N * gapAngle;
  const availableAngle = 2 * Math.PI - totalGaps;

  // Calculate proportional angular span for each slice, ensuring minimum visible length
  const minSpan = 0.045; // ~2.6 degrees minimum
  let rawSpans = slices.map((s) => (totalCommitted > 0 ? (s.amount / totalCommitted) * availableAngle : 0));

  let excess = 0;
  let largeIndices: number[] = [];
  rawSpans.forEach((span, idx) => {
    if (span < minSpan && slices[idx].amount > 0) {
      excess += minSpan - span;
      rawSpans[idx] = minSpan;
    } else {
      largeIndices.push(idx);
    }
  });

  if (excess > 0 && largeIndices.length > 0) {
    const totalLarge = largeIndices.reduce((sum, idx) => sum + rawSpans[idx], 0);
    if (totalLarge > excess) {
      largeIndices.forEach((idx) => {
        rawSpans[idx] -= (rawSpans[idx] / totalLarge) * excess;
      });
    }
  }

  // Start at 12 o'clock (-Math.PI / 2) with half a gap so it's centered
  let currentAngle = -Math.PI / 2 + gapAngle / 2;

  const svgSlices = slices.map((slice, index) => {
    const fraction = totalCommitted > 0 ? slice.amount / totalCommitted : 0;
    const isOnlyOne = slices.length === 1 || fraction >= 0.999;

    if (isOnlyOne) {
      return {
        ...slice,
        fraction,
        isOnlyOne: true,
        path: '',
      };
    }

    const spanAngle = rawSpans[index];
    const startAngle = currentAngle;
    const endAngle = currentAngle + spanAngle;
    currentAngle += spanAngle + gapAngle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = spanAngle > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;

    return {
      ...slice,
      fraction,
      isOnlyOne: false,
      path,
    };
  });

  const fixedPercentage =
    totalFixedAndCards > 0 ? Math.round((totalFixed / totalFixedAndCards) * 100) : 0;
  const cardsPercentage =
    totalFixedAndCards > 0 ? Math.round((totalCards / totalFixedAndCards) * 100) : 0;

  const hasData = totalCommitted > 0 || totalFixedAndCards > 0;

  return (
    <div className="bg-white rounded-[24px] p-4 sm:p-5 border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
      {/* Header with Title and Mode Switcher (Apple HIG Segmented Bar) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${
              viewMode === 'category'
                ? 'bg-[#FF9500]/15 text-[#FF9500]'
                : viewMode === 'detailed'
                ? 'bg-[#AF52DE]/15 text-[#AF52DE]'
                : 'bg-[#007AFF]/15 text-[#007AFF]'
            }`}
          >
            {viewMode === 'category' ? (
              <Tag size={16} />
            ) : viewMode === 'detailed' ? (
              <CardIcon size={16} />
            ) : (
              <PieChartIcon size={16} />
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-800 tracking-wide uppercase">
              {viewMode === 'category'
                ? 'Gastos por Categoria'
                : viewMode === 'detailed'
                ? 'Faturas dos Cartões'
                : 'Gastos Fixos & Cartões'}
            </h4>
            <span className="text-[10px] text-slate-400">
              {viewMode === 'category'
                ? `Divisão das despesas em ${formatMonthYear(selectedMonth)}`
                : viewMode === 'detailed'
                ? `Faturas de crédito em ${formatMonthYear(selectedMonth)}`
                : `Comprometimento em ${formatMonthYear(selectedMonth)}`}
            </span>
          </div>
        </div>

        {/* View Mode Toggle: Geral vs Por Cartão vs Por Categoria (iOS Segmented Control) */}
        <div className="flex items-center bg-[#767680]/12 p-[3px] rounded-[10px] text-[10px] sm:text-[11px] self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => {
              setViewMode('macro');
              setPinnedSliceId(null);
              setHoveredSliceId(null);
            }}
            className={`px-2 sm:px-2.5 py-0.5 rounded-[7px] transition-all font-medium shrink-0 ${
              viewMode === 'macro'
                ? 'bg-white text-slate-900 shadow-[0_1px_4px_rgba(0,0,0,0.12)] font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Geral
          </button>
          <button
            onClick={() => {
              setViewMode('detailed');
              setPinnedSliceId(null);
              setHoveredSliceId(null);
            }}
            className={`px-2 sm:px-2.5 py-0.5 rounded-[7px] transition-all font-medium shrink-0 ${
              viewMode === 'detailed'
                ? 'bg-white text-slate-900 shadow-[0_1px_4px_rgba(0,0,0,0.12)] font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Por Cartão
          </button>
          <button
            onClick={() => {
              setViewMode('category');
              setPinnedSliceId(null);
              setHoveredSliceId(null);
            }}
            className={`px-2 sm:px-2.5 py-0.5 rounded-[7px] transition-all font-medium shrink-0 ${
              viewMode === 'category'
                ? 'bg-white text-slate-900 shadow-[0_1px_4px_rgba(0,0,0,0.12)] font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Por Categoria
          </button>
        </div>
      </div>

      {!hasData ? (
        /* Empty State */
        <div className="p-6 bg-[#F2F2F7] rounded-[18px] border border-dashed border-slate-200 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-200/60 text-slate-400 mx-auto flex items-center justify-center">
            <PieChartIcon size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Nenhum gasto ou fatura neste mês</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Lance despesas no cartão, pix ou adicione contas fixas recorrentes para ver a divisão do seu orçamento.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            {onNavigateToFixed && (
              <button
                onClick={onNavigateToFixed}
                className="px-3.5 py-1.5 bg-white border border-black/[0.08] text-slate-700 hover:bg-slate-50 rounded-[12px] text-xs font-semibold transition-all active:scale-95 shadow-2xs"
              >
                + Adicionar Fixo
              </button>
            )}
            {onNavigateToCards && (
              <button
                onClick={onNavigateToCards}
                className="px-3.5 py-1.5 bg-[#007AFF] text-white hover:bg-[#0062CC] rounded-[12px] text-xs font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.22)] active:scale-95"
              >
                Ver Cartões
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Donut Chart & Legend Section */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 justify-center">
            {/* SVG Donut Chart com Pontas Arredondadas (Activity Rings Style sem fundo escuro) */}
            <div className="flex flex-col items-center shrink-0">
              <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full transform transition-transform duration-300">
                  <g>
                    {/* Background Track Ring sutil e limpo */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill="none"
                      stroke="#E5E5EA"
                      strokeWidth={strokeWidth}
                    />

                    {/* Slices com pontas arredondadas e espaçamento perfeitamente uniforme */}
                    {svgSlices.map((slice) => {
                      const isSelected = activeSliceId === slice.id;

                      if (slice.isOnlyOne) {
                        return (
                          <circle
                            key={slice.id}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="none"
                            stroke={slice.color}
                            strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth}
                            className="cursor-pointer transition-all duration-300"
                            onClick={() =>
                              setPinnedSliceId((prev) => (prev === slice.id ? null : slice.id))
                            }
                            onMouseEnter={() => setHoveredSliceId(slice.id)}
                            onMouseLeave={() => setHoveredSliceId(null)}
                          >
                            <title>{`${slice.label}: ${formatCurrency(slice.amount)} (100%)`}</title>
                          </circle>
                        );
                      }

                      return (
                        <path
                          key={slice.id}
                          d={slice.path}
                          fill="none"
                          stroke={slice.color}
                          strokeWidth={isSelected ? strokeWidth + 2 : strokeWidth}
                          strokeLinecap="round"
                          className="cursor-pointer transition-all duration-200 hover:opacity-90 active:scale-95"
                          onClick={() =>
                            setPinnedSliceId((prev) => (prev === slice.id ? null : slice.id))
                          }
                          onMouseEnter={() => setHoveredSliceId(slice.id)}
                          onMouseLeave={() => setHoveredSliceId(null)}
                        >
                          <title>{`${slice.label}: ${formatCurrency(slice.amount)} (${Math.round(
                            slice.fraction * 100
                          )}%)`}</title>
                        </path>
                      );
                    })}
                  </g>
                </svg>

                {/* Donut Center Display: Valor em destaque limpo no centro */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 pointer-events-none select-none">
                  {activeSlice ? (
                    <div className="flex flex-col items-center justify-center max-w-[120px] px-1 animate-in fade-in duration-150">
                      <span
                        className="text-[10px] font-bold text-slate-700 uppercase tracking-wider truncate w-full text-center leading-tight"
                        title={activeSlice.label}
                      >
                        {activeSlice.label}
                      </span>
                      <span className="text-base sm:text-lg font-bold tabular-nums text-slate-900 leading-tight tracking-tight mt-0.5">
                        {hideBalance ? '••••' : formatCurrency(activeSlice.amount)}
                      </span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.2 rounded-full mt-1 text-white shadow-2xs"
                        style={{ backgroundColor: activeSlice.color }}
                      >
                        {totalCommitted > 0
                          ? `${Math.round((activeSlice.amount / totalCommitted) * 100)}%`
                          : '0%'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center max-w-[120px] px-1 animate-in fade-in duration-150">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {viewMode === 'detailed'
                          ? 'Total Cartões'
                          : viewMode === 'category'
                          ? 'Categorias'
                          : 'Total Geral'}
                      </span>
                      <span className="text-base sm:text-lg font-bold tabular-nums text-slate-900 leading-tight tracking-tight mt-0.5">
                        {hideBalance ? '••••' : formatCurrency(totalCommitted)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {viewMode === 'detailed'
                          ? `${cardsWithSpend.filter((c) => c.spent > 0).length} ${
                              cardsWithSpend.filter((c) => c.spent > 0).length === 1
                                ? 'cartão'
                                : 'cartões'
                            }`
                          : viewMode === 'category'
                          ? `${categoryList.length} categorias`
                          : 'Fixos + Cartões'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: Rendered specifically for each view mode */}
            {viewMode === 'category' ? (
              /* CATEGORY VIEW: Lista de Categorias com Ícones, Valores e Barras de Progresso */
              <div className="flex-1 w-full space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Divisão das Categorias
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                    {categoryList.length} {categoryList.length === 1 ? 'categoria' : 'categorias'}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {categoryList.slice(0, isExpandedCategories ? undefined : 4).map((item) => {
                    const percent =
                      totalCategorySpend > 0
                        ? Math.round((item.amount / totalCategorySpend) * 100)
                        : 0;
                    const isSelected = activeSliceId === item.id;

                    return (
                      <div
                        key={item.id}
                        onMouseEnter={() => setHoveredSliceId(item.id)}
                        onMouseLeave={() => setHoveredSliceId(null)}
                        onClick={() =>
                          setPinnedSliceId((prev) => (prev === item.id ? null : item.id))
                        }
                        className={`p-2 sm:p-2.5 rounded-[15px] border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-50 border-black/[0.12] shadow-2xs'
                            : 'bg-[#F2F2F7]/70 hover:bg-[#F2F2F7] border-black/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0 border border-black/5"
                              style={{ backgroundColor: `${item.color}20` }}
                            >
                              <CategoryIcon
                                name={item.category?.icon || 'Tag'}
                                size={14}
                                color={item.color}
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 truncate block leading-tight">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {item.count} {item.count === 1 ? 'lançamento' : 'lançamentos'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 text-right">
                            <span className="text-xs sm:text-sm font-semibold tabular-nums text-slate-900">
                              {hideBalance ? '••••' : formatCurrency(item.amount)}
                            </span>
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[6px] text-white shrink-0 shadow-2xs"
                              style={{ backgroundColor: item.color }}
                            >
                              {percent}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-black/[0.06] h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {categoryList.length > 4 && (
                  <button
                    onClick={() => setIsExpandedCategories(!isExpandedCategories)}
                    className="w-full py-1 text-[11px] font-semibold text-[#007AFF] hover:underline flex items-center justify-center gap-1"
                  >
                    <span>
                      {isExpandedCategories
                        ? 'Mostrar menos categorias'
                        : `Ver todas as ${categoryList.length} categorias`}
                    </span>
                    {isExpandedCategories ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}

                {onNavigateToCategories && (
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      onClick={onNavigateToCategories}
                      className="text-[10px] font-semibold text-slate-500 hover:text-[#007AFF] inline-flex items-center gap-0.5 transition-colors"
                    >
                      Gerenciar tags & categorias <ArrowRight size={10} />
                    </button>
                  </div>
                )}
              </div>
            ) : viewMode === 'detailed' ? (
              /* DETAILED VIEW (POR CARTÃO): SOMENTE OS CARTÕES DE CRÉDITO (SEM GASTOS FIXOS) */
              <div className="flex-1 w-full space-y-2.5">
                {/* Header dos Cartões */}
                <div
                  onClick={onNavigateToCards}
                  className="p-3 bg-[#AF52DE]/8 hover:bg-[#AF52DE]/12 rounded-[16px] border border-[#AF52DE]/15 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-[9px] bg-[#AF52DE] text-white flex items-center justify-center shadow-2xs">
                        <CardIcon size={13} />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-800">Total das Faturas</span>
                        <span className="text-[10px] text-slate-400 block">
                          {cardsWithSpend.filter((c) => c.spent > 0).length} de {creditCards.length}{' '}
                          cartões com fatura
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs sm:text-sm font-semibold tabular-nums text-slate-900 block">
                        {hideBalance ? '••••' : formatCurrency(totalCards)}
                      </span>
                      <span className="text-[10px] font-semibold text-[#AF52DE] group-hover:underline inline-flex items-center gap-0.5">
                        Ver faturas <ArrowRight size={10} />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cards Individual List */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {cardsWithSpend.filter((c) => c.spent > 0).length === 0 ? (
                    <div className="p-4 bg-[#F2F2F7] rounded-[16px] text-center border border-dashed border-slate-200">
                      <p className="text-xs font-semibold text-slate-700">Nenhum gasto em cartão no mês</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        As despesas lançadas nos cartões de crédito serão exibidas aqui.
                      </p>
                    </div>
                  ) : (
                    cardsWithSpend
                      .filter((c) => c.spent > 0)
                      .map(({ card, spent }) => {
                        const percentOfCommitted =
                          totalCards > 0 ? Math.round((spent / totalCards) * 100) : 0;
                        const limit = card.limit || 5000;
                        const percentOfLimit = Math.min(Math.round((spent / limit) * 100), 100);
                        const isSelected = activeSliceId === `card-${card.id}`;

                        return (
                          <div
                            key={card.id}
                            onMouseEnter={() => setHoveredSliceId(`card-${card.id}`)}
                            onMouseLeave={() => setHoveredSliceId(null)}
                            onClick={() =>
                              setPinnedSliceId((prev) =>
                                prev === `card-${card.id}` ? null : `card-${card.id}`
                              )
                            }
                            className={`p-2.5 px-3 rounded-[15px] border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-slate-50 border-black/[0.12] shadow-2xs'
                                : 'bg-[#F2F2F7]/70 hover:bg-[#F2F2F7] border-black/[0.03]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                                  style={{ backgroundColor: card.color }}
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-slate-800 truncate block leading-tight">
                                    {card.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 text-right">
                                <div>
                                  <span className="text-xs tabular-nums font-semibold text-slate-900 block leading-tight">
                                    {hideBalance ? '••••' : formatCurrency(spent)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {percentOfLimit}% do limite
                                  </span>
                                </div>
                                <span
                                  className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-[6px] shadow-2xs"
                                  style={{ backgroundColor: card.color }}
                                >
                                  {percentOfCommitted}%
                                </span>
                              </div>
                            </div>

                            {/* Limit progress bar */}
                            <div className="w-full bg-black/[0.06] h-1.5 rounded-full overflow-hidden mt-1.5">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${percentOfCommitted}%`,
                                  backgroundColor: card.color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            ) : (
              /* MACRO VIEW (GERAL): GASTOS FIXOS VS FATURAS DOS CARTÕES */
              <div className="flex-1 w-full space-y-2.5">
                {/* Card Gastos Fixos */}
                <div
                  onClick={onNavigateToFixed}
                  className="p-3 bg-[#007AFF]/8 hover:bg-[#007AFF]/12 rounded-[16px] border border-[#007AFF]/15 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-[9px] bg-[#007AFF] text-white flex items-center justify-center shadow-2xs">
                        <RefreshCw size={13} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-800">Gastos Fixos</span>
                          <span className="text-[10px] font-semibold bg-[#007AFF]/15 text-[#007AFF] px-1.5 py-0.2 rounded-[6px]">
                            {fixedPercentage}%
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {activeFixedList.length} contas cadastradas
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs sm:text-sm font-semibold tabular-nums text-slate-900 block">
                        {hideBalance ? '••••' : formatCurrency(totalFixed)}
                      </span>
                      <span className="text-[10px] font-semibold text-[#007AFF] group-hover:underline inline-flex items-center gap-0.5">
                        Ver fixos <ArrowRight size={10} />
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-black/[0.06] h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-[#007AFF] transition-all duration-300"
                      style={{ width: `${fixedPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Card Faturas dos Cartões */}
                <div
                  onClick={onNavigateToCards}
                  className="p-3 bg-[#AF52DE]/8 hover:bg-[#AF52DE]/12 rounded-[16px] border border-[#AF52DE]/15 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-[9px] bg-[#AF52DE] text-white flex items-center justify-center shadow-2xs">
                        <CardIcon size={13} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-800">Faturas de Cartão</span>
                          <span className="text-[10px] font-semibold bg-[#AF52DE]/15 text-[#AF52DE] px-1.5 py-0.2 rounded-[6px]">
                            {cardsPercentage}%
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {creditCards.length} {creditCards.length === 1 ? 'cartão' : 'cartões'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs sm:text-sm font-semibold tabular-nums text-slate-900 block">
                        {hideBalance ? '••••' : formatCurrency(totalCards)}
                      </span>
                      <span className="text-[10px] font-semibold text-[#AF52DE] group-hover:underline inline-flex items-center gap-0.5">
                        Ver faturas <ArrowRight size={10} />
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-black/[0.06] h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full rounded-full bg-[#AF52DE] transition-all duration-300"
                      style={{ width: `${cardsPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
