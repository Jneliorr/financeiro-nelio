import { Category, CreditCard, FixedExpense, Transaction } from '../types';

export const DEFAULT_CREDIT_CARDS: CreditCard[] = [
  {
    id: 'card-xp',
    name: 'Cartão XP',
    bankName: 'XP Investimentos',
    color: '#111827',
    closingDay: 25,
    dueDay: 5,
    limit: 10000,
  },
  {
    id: 'card-mercadopago',
    name: 'Cartão Mercado Pago',
    bankName: 'Mercado Pago',
    color: '#009EE3',
    closingDay: 20,
    dueDay: 28,
    limit: 5000,
  },
  {
    id: 'card-principal',
    name: 'Cartão Principal',
    bankName: 'Nubank',
    color: '#820AD1',
    closingDay: 25,
    dueDay: 5,
    limit: 5000,
  },
];

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-mercado',
    name: 'Mercado & Feira',
    icon: 'ShoppingCart',
    color: '#10B981',
    type: 'expense',
    monthlyBudget: 1200,
    isDefault: true,
  },
  {
    id: 'cat-alimentacao',
    name: 'Alimentação',
    icon: 'Utensils',
    color: '#F97316',
    type: 'expense',
    monthlyBudget: 800,
    isDefault: true,
  },
  {
    id: 'cat-lanches',
    name: 'Lanches & Delivery',
    icon: 'Pizza',
    color: '#EF4444',
    type: 'expense',
    monthlyBudget: 350,
    isDefault: true,
  },
  {
    id: 'cat-transporte',
    name: 'Transporte & Combustível',
    icon: 'Car',
    color: '#3B82F6',
    type: 'expense',
    monthlyBudget: 600,
    isDefault: true,
  },
  {
    id: 'cat-moradia',
    name: 'Moradia & Contas',
    icon: 'Home',
    color: '#6366F1',
    type: 'expense',
    monthlyBudget: 1800,
    isDefault: true,
  },
  {
    id: 'cat-saude',
    name: 'Saúde & Farmácia',
    icon: 'HeartPulse',
    color: '#EC4899',
    type: 'expense',
    monthlyBudget: 300,
    isDefault: true,
  },
  {
    id: 'cat-compras',
    name: 'Compras & Vestuário',
    icon: 'ShoppingBag',
    color: '#14B8A6',
    type: 'expense',
    monthlyBudget: 400,
    isDefault: true,
  },
  {
    id: 'cat-passeio',
    name: 'Passeio & Lazer',
    icon: 'Palmtree',
    color: '#8B5CF6',
    type: 'expense',
    monthlyBudget: 500,
    isDefault: true,
  },
  {
    id: 'cat-salario',
    name: 'Salário & Renda Fixa',
    icon: 'Wallet',
    color: '#059669',
    type: 'income',
    isDefault: true,
  },
  {
    id: 'cat-extra',
    name: 'Renda Extra & Freelance',
    icon: 'BadgePercent',
    color: '#0284C7',
    type: 'income',
    isDefault: true,
  },
  {
    id: 'cat-rendimentos',
    name: 'Investimentos & Rendimentos',
    icon: 'TrendingUp',
    color: '#10B981',
    type: 'income',
    isDefault: true,
  },
];

export const DEFAULT_FIXED_EXPENSES: FixedExpense[] = [];

export const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: string }> = {
  pix: { label: 'Pix', icon: 'Zap' },
  credit: { label: 'Cartão de Crédito', icon: 'CreditCard' },
  debit: { label: 'Cartão de Débito', icon: 'CreditCard' },
  cash: { label: 'Dinheiro', icon: 'Banknote' },
  transfer: { label: 'Transferência / TED', icon: 'ArrowLeftRight' },
  other: { label: 'Outro', icon: 'CircleDollarSign' },
};

// Production clean start: empty transactions
export const getInitialTransactions = (): Transaction[] => {
  return [];
};
