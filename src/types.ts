export type TransactionType = 'expense' | 'income';

export type PaymentMethod = 'pix' | 'credit' | 'debit' | 'cash' | 'transfer' | 'other';

export interface FinancialProfile {
  id: string;
  name: string;
  color: string;
  icon: string; // 'user' | 'briefcase' | 'users' | 'home' | 'heart' | 'baby' | 'shopping-bag' | 'wallet'
  description?: string;
  isDefault?: boolean;
  createdAt: string;
  userId?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  bankName: string;
  color: string;
  closingDay: number; // Dia de fechamento da fatura
  dueDay: number; // Dia de vencimento da fatura
  limit?: number;
  profileId?: string;
  closedInvoices?: string[]; // Lista de meses (YYYY-MM) com fatura fechada manualmente
  manualClosingDates?: Record<string, string>; // Data de fechamento manual por mês (ex: { '2026-08': '2026-08-20' })
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
  monthlyBudget?: number; // Teto de gasto mensal opcional
  isDefault?: boolean;
  profileId?: string;
}

export interface FixedExpense {
  id: string;
  description: string;
  merchant?: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  dueDay: number; // Dia do mês (1 a 31)
  paymentMethod: PaymentMethod;
  creditCardId?: string;
  active: boolean;
  profileId?: string;
  isVariable?: boolean; // Se oscila mês a mês (água, luz, internet, etc.)
  monthlyOverrides?: Record<string, number>; // Ajustes específicos por mês (ex: { '2026-09': 120, '2026-10': 145 })
  statusByMonth?: Record<string, 'estimated' | 'adjusted' | 'paid'>; // Status de cada mês
  startsOnMonth?: string;
  repeatMonthly?: boolean;
  monthlyVersions?: Record<string, RecurringTerms>;
}

export type RecurringTerms = Pick<FixedExpense,
  'description' | 'merchant' | 'amount' | 'categoryId' | 'dueDay' | 'paymentMethod' | 'creditCardId' | 'isVariable'>;

export interface InstallmentInfo {
  groupId: string;
  current: number;
  total: number;
  totalAmount: number;
  installmentAmount: number;
}

export interface Transaction {
  id: string;
  description: string;
  merchant?: string; // Local da compra (ex: Super Mercado Bomfrios)
  amount: number;
  type: TransactionType;
  categoryId: string;
  tags?: string[];
  date: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  creditCardId?: string; // ID do cartão de crédito usado
  isFixed?: boolean; // Se é um gasto fixo/recorrente
  fixedExpenseId?: string; // ID do gasto fixo mestre (para poder ajustar só neste mês ou em todos)
  projected?: boolean; // Somente na leitura do mês; nunca gravado no extrato
  notes?: string;
  installments?: InstallmentInfo;
  createdAt: string;
  profileId?: string;
}

export interface MonthSummary {
  monthKey: string; // YYYY-MM
  totalIncome: number;
  totalExpense: number;
  balance: number;
  dailyAverage: number;
  todayExpense: number;
}
