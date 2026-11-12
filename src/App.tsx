import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  FolderTree,
  FileSpreadsheet,
  Plus,
  Wallet,
  CreditCard as CardIcon,
  RefreshCw,
  LogIn,
  LogOut,
  Menu,
} from 'lucide-react';
import {
  Category,
  CreditCard,
  FixedExpense,
  Transaction,
  TransactionType,
} from './types';
import { DEFAULT_CATEGORIES, DEFAULT_CREDIT_CARDS, DEFAULT_FIXED_EXPENSES, getInitialTransactions } from './data/defaultData';
import { getCurrentMonthKey, formatCurrency, calculateInstallmentDate, formatMonthYear } from './utils/formatters';
import { createFixedExpenseTransactions, fixedRuleForMonth, getTransactionsWithMonthlyPlans, recurringTerms, reviseFixedRule } from './utils/fixedExpenseHelpers';
import { getTransactionBillingMonth } from './utils/creditCardHelpers';
import { DashboardView } from './components/DashboardView';
import { CardPurchaseDialog, type CardPurchaseDraft } from './components/CardPurchaseDialog';
import { TransactionsView } from './components/TransactionsView';
import { CategoriesView, DEFAULT_MERCHANTS_LIST } from './components/CategoriesView';
import { CardsView } from './components/CardsView';
import { FixedExpensesView, FixedFormRequest } from './components/FixedExpensesView';
import { QuickAddModal, SaveTransactionPayload } from './components/QuickAddModal';
import { SpreadsheetImportExportModal } from './components/SpreadsheetImportExportModal';
import { ImportCsvModal } from './components/ImportCsvModal';
import { AuthModal } from './components/AuthModal';
import {
  auth,
  db,
  loginWithGoogle,
  checkRedirectLogin,
  logoutUser,
  confirmUserSync,
  initializeUserFinance,
  FINANCE_COLLECTIONS,
  type FinanceCollection,
  sanitizeForFirestore,
  clearUserFirestoreTransactionsAndFixed,
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const STORAGE_KEYS = {
  TRANSACTIONS: 'financas_transactions_guest_v3',
  CATEGORIES: 'financas_categories_guest_v3',
  CREDIT_CARDS: 'financas_cards_guest_v3',
  FIXED_EXPENSES: 'financas_fixed_guest_v3',
};

const MAIN_NAV = [
  { id: 'dashboard', label: 'Visão geral', short: 'Início', icon: LayoutDashboard },
  { id: 'transactions', label: 'Extrato', short: 'Extrato', icon: ReceiptText },
  { id: 'fixed', label: 'Contas do mês', short: 'Contas', icon: RefreshCw },
  { id: 'cards', label: 'Cartões', short: 'Cartões', icon: CardIcon },
] as const;
type Tab = (typeof MAIN_NAV)[number]['id'] | 'categories';

const deduplicateTransactions = (list: Transaction[]): Transaction[] => {
  const seen = new Set<string>();
  const result: Transaction[] = [];
  for (const item of list) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
};

function readGuestList<T>(key: string, fallback: T[]): T[] {
  try {
    const saved = localStorage.getItem(key);
    const legacy = saved === null ? localStorage.getItem(key.replace('_guest_v3', '_v2')) : null;
    const data: unknown = JSON.parse(saved ?? legacy ?? 'null');
    if (Array.isArray(data)) {
      return data.filter((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string' &&
        (legacy === null || !entry.userId));
    }
  } catch (error) {
    console.warn('Não foi possível ler os dados locais.', error);
  }
  return fallback;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>();
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setCurrentUser);
    void checkRedirectLogin();
    return unsubscribe;
  }, []);

  if (currentUser === undefined) {
    return <p role="status" className="p-6 text-sage-600">Carregando sessão…</p>;
  }
  return (
    <React.Fragment key={currentUser ? `user-${currentUser.uid}` : 'guest'}>
      <FinanceApp currentUser={currentUser} />
    </React.Fragment>
  );
}

function FinanceApp({ currentUser }: { currentUser: User | null }) {
  const userId = currentUser?.uid;
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'offline'>(userId ? 'syncing' : 'offline');
  const [categories, setCategories] = useState<Category[]>(() =>
    userId ? [] : readGuestList(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES)
  );
  const [creditCards, setCreditCards] = useState<CreditCard[]>(() =>
    userId ? [] : readGuestList(STORAGE_KEYS.CREDIT_CARDS, DEFAULT_CREDIT_CARDS)
  );
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>(() =>
    userId ? [] : readGuestList(STORAGE_KEYS.FIXED_EXPENSES, DEFAULT_FIXED_EXPENSES)
  );
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    userId ? [] : deduplicateTransactions(readGuestList(STORAGE_KEYS.TRANSACTIONS, getInitialTransactions()))
  );

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [fixedFormRequest, setFixedFormRequest] = useState<FixedFormRequest | null>(null);
  const [isCardPurchaseOpen, setIsCardPurchaseOpen] = useState(false);
  const [cardPurchaseDraft, setCardPurchaseDraft] = useState<CardPurchaseDraft | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<TransactionType>('expense');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);
  const [isImportCsvModalOpen, setIsImportCsvModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const currentMonth = getCurrentMonthKey();
  useEffect(() => { window.scrollTo(0, 0); }, [activeTab]);
  const plannedTransactions = useMemo(
    () => getTransactionsWithMonthlyPlans(fixedExpenses, categories, transactions, selectedMonth, currentMonth),
    [fixedExpenses, categories, transactions, selectedMonth, currentMonth],
  );
  const lastCardId = useMemo(() => transactions.reduce<Transaction | undefined>((latest, entry) => (
    entry.type === 'expense' && entry.paymentMethod === 'credit' && entry.creditCardId && !entry.fixedExpenseId &&
      (!latest || entry.createdAt > latest.createdAt) ? entry : latest
  ), undefined)?.creditCardId, [transactions]);

  const merchantsKey = userId ? `financas_custom_merchants_${userId}` : 'financas_custom_merchants';
  const [merchants, setMerchants] = useState<string[]>(() => {
    const saved = localStorage.getItem(merchantsKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return Array.from(new Set(parsed.filter((entry) => typeof entry === 'string')));
        }
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_MERCHANTS_LIST;
  });

  useEffect(() => {
    localStorage.setItem(merchantsKey, JSON.stringify(merchants));
  }, [merchants, merchantsKey]);

  const handleAddMerchant = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setMerchants((prev) => {
      if (prev.some((m) => m.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, trimmed];
    });
    showToast(`Estabelecimento "${trimmed}" salvo!`);
  };

  const handleUpdateMerchant = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setMerchants((prev) => prev.map((m) => m.toLowerCase() === oldName.toLowerCase() ? trimmed : m));
    showToast(`Estabelecimento alterado para "${trimmed}"!`);
  };

  const handleDeleteMerchant = (name: string) => {
    setMerchants((prev) => prev.filter((m) => m.toLowerCase() !== name.toLowerCase()));
    showToast(`Estabelecimento removido.`);
  };

  const handleResetMerchants = () => {
    setMerchants(DEFAULT_MERCHANTS_LIST);
    showToast('Estabelecimentos padrão restaurados!');
  };

  const showToast = setToastMessage;
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // The guest workspace is stored separately from all signed-in sessions.
  useEffect(() => {
    if (!userId) localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories, userId]);

  useEffect(() => {
    if (!userId) localStorage.setItem(STORAGE_KEYS.CREDIT_CARDS, JSON.stringify(creditCards));
  }, [creditCards, userId]);

  useEffect(() => {
    if (!userId) localStorage.setItem(STORAGE_KEYS.FIXED_EXPENSES, JSON.stringify(fixedExpenses));
  }, [fixedExpenses, userId]);

  useEffect(() => {
    if (!userId) localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions, userId]);

  useEffect(() => {
    if (!userId) return;
    const updateCollection = {
      categories: (rows: unknown[]) => setCategories(rows as Category[]),
      creditCards: (rows: unknown[]) => setCreditCards(rows as CreditCard[]),
      fixedExpenses: (rows: unknown[]) => setFixedExpenses(rows as FixedExpense[]),
      transactions: (rows: unknown[]) => setTransactions(deduplicateTransactions(rows as Transaction[])),
    };
    const serverCollections = new Map<FinanceCollection, boolean>();
    const receivedCollections = new Set<FinanceCollection>();
    const pendingCollections = new Set<FinanceCollection>();
    let initializing = false;
    let initialized = false;
    let active = true;

    function updateStatus() {
      if (active && initialized && serverCollections.size === FINANCE_COLLECTIONS.length) {
        setSyncStatus(pendingCollections.size ? 'syncing' : 'synced');
      }
    }

    const unsubscribes = FINANCE_COLLECTIONS.map((name) => onSnapshot(
      collection(db, 'users', userId, name),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!active) return;
        if (!receivedCollections.has(name) || snapshot.docChanges().length) {
          updateCollection[name](snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })));
          receivedCollections.add(name);
        }
        if (snapshot.metadata.hasPendingWrites) pendingCollections.add(name);
        else pendingCollections.delete(name);

        if (snapshot.metadata.fromCache) {
          serverCollections.delete(name);
          setSyncStatus('offline');
          return;
        }

        serverCollections.set(name, !snapshot.empty);
        if (!initialized && !initializing && serverCollections.size === FINANCE_COLLECTIONS.length) {
          initializing = true;
          void initializeUserFinance(userId, [...serverCollections.values()].some(Boolean))
            .then(() => {
              initialized = true;
              updateStatus();
            })
            .catch((error) => {
              console.warn('Falha ao inicializar dados da conta.', error);
              if (active) setSyncStatus('offline');
            })
            .finally(() => { initializing = false; });
        }
        updateStatus();
      },
      (error) => {
        serverCollections.delete(name);
        console.warn('Falha ao sincronizar coleção.', name, error);
        if (active) setSyncStatus('offline');
      },
    ));

    return () => {
      active = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [userId]);

  const reportCloudError = (error: unknown) => {
    console.error('Falha ao salvar no Firebase.', error);
    setSyncStatus('offline');
    showToast('Falha ao sincronizar a alteração com a nuvem.');
  };

  const writeToCloud = async (name: FinanceCollection, item: { id: string }, isDelete = false) => {
    if (!userId) return true;
    try {
      const ref = doc(db, 'users', userId, name, item.id);
      if (isDelete) await deleteDoc(ref);
      else await setDoc(ref, sanitizeForFirestore({ ...item, userId }));
      return true;
    } catch (error) {
      reportCloudError(error);
      return false;
    }
  };

  const writeTxToCloud = (tx: Transaction, isDelete = false) => writeToCloud('transactions', tx, isDelete);
  const writeCatToCloud = (cat: Category, isDelete = false) => writeToCloud('categories', cat, isDelete);
  const writeCardToCloud = (card: CreditCard, isDelete = false) => writeToCloud('creditCards', card, isDelete);
  const writeFixedToCloud = (fixed: FixedExpense, isDelete = false) => writeToCloud('fixedExpenses', fixed, isDelete);

  const writeTransactionsToCloud = async (items: Transaction[], isDelete = false) => {
    if (!userId) return true;
    try {
      for (let offset = 0; offset < items.length; offset += 400) {
        const batch = writeBatch(db);
        for (const item of items.slice(offset, offset + 400)) {
          const ref = doc(db, 'users', userId, 'transactions', item.id);
          if (isDelete) batch.delete(ref);
          else batch.set(ref, sanitizeForFirestore({ ...item, userId }));
        }
        await batch.commit();
      }
      return true;
    } catch (error) {
      reportCloudError(error);
      return false;
    }
  };

  const handleManualSyncToCloud = async () => {
    if (!userId) {
      setIsAuthModalOpen(true);
      return;
    }
    setSyncStatus('syncing');
    try {
      await confirmUserSync(userId);
      setSyncStatus('synced');
      showToast('Conexão com a nuvem confirmada.');
    } catch (error) {
      reportCloudError(error);
    }
  };

  const handleOpenAdd = (type: TransactionType = 'expense') => {
    setQuickAddType(type);
    setEditingTransaction(null);
    setIsQuickAddOpen(true);
  };

  const openFixedForm = (request: FixedFormRequest) => {
    setFixedFormRequest(request);
    setActiveTab('fixed');
  };
  const adjustFixed = (id: string, month: string) => {
    setSelectedMonth(month);
    openFixedForm({ kind: 'adjust', id });
  };
  const editTransaction = (transaction: Transaction) => {
    if (transaction.fixedExpenseId && fixedExpenses.some((rule) => rule.id === transaction.fixedExpenseId)) {
      adjustFixed(transaction.fixedExpenseId, transaction.date.slice(0, 7));
      return;
    }
    setEditingTransaction(transaction);
    setQuickAddType(transaction.type);
    setIsQuickAddOpen(true);
  };

  const addTransactions = async (entries: Transaction[]) => {
    if (!userId) setTransactions((prev) => deduplicateTransactions([...entries, ...prev]));
    return writeTransactionsToCloud(entries);
  };

  const handleSaveTransaction = async (payload: SaveTransactionPayload) => {
    const { installmentConfig, ...data } = payload;

    if (editingTransaction) {
      const updated: Transaction = { ...editingTransaction, ...data };
      if (!userId) setTransactions((prev) => prev.map((entry) => entry.id === updated.id ? updated : entry));
      if (!await writeTxToCloud(updated)) return false;

      if (updated.isFixed || updated.fixedExpenseId) {
        const month = updated.date.slice(0, 7);
        const fixedId = updated.fixedExpenseId ?? updated.id.match(/^tx-fix-(.+)-[0-9]{4}-[0-9]{2}$/)?.[1];
        const fixed = fixedExpenses.find((entry) => entry.id === fixedId);
        if (fixed) {
          const updatedFixed: FixedExpense = {
            ...fixed,
            monthlyOverrides: { ...fixed.monthlyOverrides, [month]: updated.amount },
            statusByMonth: { ...fixed.statusByMonth, [month]: 'adjusted' },
          };
          if (!userId) setFixedExpenses((prev) => prev.map((entry) => entry.id === fixed.id ? updatedFixed : entry));
          if (!await writeFixedToCloud(updatedFixed)) return false;
        }
      }
      showToast('Lançamento atualizado!');
      return true;
    }

    if (installmentConfig?.isInstallment && installmentConfig.totalInstallments > 1) {
      const total = installmentConfig.totalInstallments;
      const groupId = 'grp-' + crypto.randomUUID();
      const totalCents = installmentConfig.valueMode === 'total'
        ? Math.round(data.amount * total * 100)
        : Math.round(data.amount * 100) * total;
      const baseCents = Math.floor(totalCents / total);
      const remainder = totalCents % total;
      const entries = Array.from({ length: total }, (_, index): Transaction => {
        const amount = (baseCents + Number(index < remainder)) / 100;
        return {
          ...data,
          id: 'tx-inst-' + groupId + '-' + (index + 1),
          amount,
          date: calculateInstallmentDate(data.date, index),
          installments: {
            groupId,
            current: index + 1,
            total,
            totalAmount: totalCents / 100,
            installmentAmount: amount,
          },
          createdAt: new Date().toISOString(),
        };
      });
      if (!await addTransactions(entries)) return false;
      setSelectedMonth(getTransactionBillingMonth(entries[0], creditCards));
      showToast(total + ' parcelas geradas!');
      return true;
    }

    const entry: Transaction = { ...data, id: 'tx-' + crypto.randomUUID(), createdAt: new Date().toISOString() };
    if (!await addTransactions([entry])) return false;
    const billingMonth = getTransactionBillingMonth(entry, creditCards);
    setSelectedMonth(billingMonth);
    showToast(entry.paymentMethod === 'credit'
      ? 'Compra salva na fatura de ' + formatMonthYear(billingMonth) + '.'
      : 'Lançamento adicionado!');
    return true;
  };

  const handleDeleteTransaction = async (id: string, deleteAllInstallments = false) => {
    const target = transactions.find((entry) => entry.id === id);
    if (!target) return;
    const group = deleteAllInstallments && target.installments?.groupId;
    const removed = group ? transactions.filter((entry) => entry.installments?.groupId === group) : [target];
    const removedIds = new Set(removed.map((entry) => entry.id));
    if (!userId) setTransactions((prev) => prev.filter((entry) => !removedIds.has(entry.id)));
    if (await writeTransactionsToCloud(removed, true)) {
      showToast(group ? removed.length + ' parcelas excluídas.' : 'Lançamento excluído.');
    }
  };

  const handleAddCategory = async (cat: Omit<Category, 'id'>) => {
    const newCat: Category = { ...cat, id: `cat-${Date.now()}` };
    if (!userId) setCategories((prev) => [...prev, newCat]);
    if (await writeCatToCloud(newCat)) showToast(`Tag "${newCat.name}" criada!`);
  };

  const handleUpdateCategory = async (id: string, updated: Partial<Category>) => {
    const target = categories.find((c) => c.id === id);
    if (!target) return;
    if (!userId) setCategories((prev) => prev.map((c) => c.id === id ? { ...c, ...updated } : c));
    if (await writeCatToCloud({ ...target, ...updated })) showToast('Tag atualizada!');
  };

  const handleDeleteCategory = async (id: string) => {
    const target = categories.find((c) => c.id === id);
    if (!target) return;
    if (!userId) setCategories((prev) => prev.filter((c) => c.id !== id));
    if (await writeCatToCloud(target, true)) showToast('Tag removida.');
  };

  const saveFixedAndTransactions = async (fixed: FixedExpense, entries: Transaction[]) => {
    if (!userId) {
      setFixedExpenses((prev) => prev.some((item) => item.id === fixed.id)
        ? prev.map((item) => item.id === fixed.id ? fixed : item)
        : [...prev, fixed]);
      if (entries.length) setTransactions((prev) => deduplicateTransactions([...entries, ...prev]));
      return true;
    }
    if (!entries.length) return writeFixedToCloud(fixed);

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', userId, 'fixedExpenses', fixed.id), sanitizeForFirestore({ ...fixed, userId }));
      for (const entry of entries) {
        batch.set(doc(db, 'users', userId, 'transactions', entry.id), sanitizeForFirestore({ ...entry, userId }));
      }
      await batch.commit();
      return true;
    } catch (error) {
      reportCloudError(error);
      return false;
    }
  };

  const handleAddFixedExpense = async (fixed: Omit<FixedExpense, 'id'>) => {
    const entry: FixedExpense = { ...fixed, id: 'fixed-' + crypto.randomUUID(), startsOnMonth: selectedMonth };
    if (entry.repeatMonthly) entry.monthlyVersions = { [selectedMonth]: recurringTerms(entry) };
    const entries = entry.active && entry.repeatMonthly === false
      ? createFixedExpenseTransactions([entry], categories, transactions, selectedMonth, 1) : [];
    if (!await saveFixedAndTransactions(entry, entries)) return false;
    showToast(entry.type === 'income' ? 'Entrada fixa cadastrada!' : 'Gasto fixo cadastrado!');
    return true;
  };

  const updateExistingProjections = (target: FixedExpense, updated: FixedExpense, fromMonth: string) =>
    transactions.flatMap((entry) => {
      const month = entry.date.slice(0, 7);
      const isLinked = entry.fixedExpenseId === target.id || entry.id === `tx-fix-${target.id}-${month}`;
      if (!isLinked || month < fromMonth || updated.statusByMonth?.[month] === 'paid') return [];
      const rule = fixedRuleForMonth(updated, month);
      const previousRule = fixedRuleForMonth(target, month);
      const amount = updated.monthlyOverrides?.[month] ?? (entry.amount === previousRule.amount ? rule.amount : entry.amount);
      const [projection] = createFixedExpenseTransactions([rule], categories, [], month, 1);
      return [{ ...entry, ...projection, id: entry.id, amount, createdAt: entry.createdAt }];
    });

  const handleUpdateFixedExpense = async (id: string, updated: Partial<FixedExpense>) => {
    const target = fixedExpenses.find((entry) => entry.id === id);
    if (!target) return false;
    const entry = reviseFixedRule(target, updated, selectedMonth, transactions, currentMonth);
    const entries = updateExistingProjections(target, entry, selectedMonth);
    if (!await saveFixedAndTransactions(entry, entries)) return false;
    showToast(entry.type === 'income' ? 'Entrada fixa atualizada!' : 'Gasto fixo atualizado!');
    return true;
  };

  const handleUpdateFixedMonthlyAmount = async (
    fixedId: string,
    monthKey: string,
    newAmount: number,
    updateDefault: boolean,
    status: 'estimated' | 'adjusted' | 'paid' = 'adjusted'
  ) => {
    const target = fixedExpenses.find((f) => f.id === fixedId);
    if (!target) return false;

    const updatedFixed: FixedExpense = {
      ...(updateDefault ? reviseFixedRule(target, { amount: newAmount }, monthKey, transactions, currentMonth) : target),
      monthlyOverrides: {
        ...(target.monthlyOverrides || {}),
        [monthKey]: newAmount,
      },
      statusByMonth: {
        ...(target.statusByMonth || {}),
        [monthKey]: status,
      },
    };

    const existingTx = transactions.find(
      (entry) =>
        (entry.fixedExpenseId === fixedId || entry.id === 'tx-fix-' + fixedId + '-' + monthKey) &&
        entry.date.slice(0, 7) === monthKey
    );
    const updatedTx = existingTx
      ? { ...existingTx, amount: newAmount }
      : createFixedExpenseTransactions([fixedRuleForMonth(updatedFixed, monthKey)], categories, [], monthKey, 1)[0];

    const future = updateDefault
      ? updateExistingProjections(target, updatedFixed, calculateInstallmentDate(monthKey + '-01', 1).slice(0, 7)) : [];
    if (!await saveFixedAndTransactions(updatedFixed, [updatedTx, ...future])) return false;
    showToast('Valor de ' + formatMonthYear(monthKey) + ' atualizado para ' + formatCurrency(newAmount) + '.');
    return true;
  };

  const handleDeleteFixedExpense = async (id: string, deleteGeneratedTxs = true) => {
    const fixed = fixedExpenses.find((entry) => entry.id === id);
    if (!fixed) return;
    if (deleteGeneratedTxs) {
      const removed = transactions.filter((entry) => entry.fixedExpenseId === id || entry.id.startsWith('tx-fix-' + id + '-'));
      const removedIds = new Set(removed.map((entry) => entry.id));
      if (!userId) setTransactions((prev) => prev.filter((entry) => !removedIds.has(entry.id)));
      if (!await writeTransactionsToCloud(removed, true)) return;
    }
    if (!userId) setFixedExpenses((prev) => prev.filter((entry) => entry.id !== id));
    if (await writeFixedToCloud(fixed, true)) showToast('Gasto fixo removido.');
  };

  const handleAddCreditCard = async (card: Omit<CreditCard, 'id'>) => {
    const cardId = `card-${Date.now()}`;
    const newCard: CreditCard = { ...card, id: cardId };
    if (!userId) setCreditCards((prev) => [...prev, newCard]);
    if (!await writeCardToCloud(newCard)) return;
    showToast(`Cartão ${newCard.name} adicionado com sucesso!`);
    return newCard;
  };

  const handleUpdateCreditCard = async (id: string, updated: Partial<CreditCard>) => {
    const target = creditCards.find((c) => c.id === id);
    if (!target) return;
    if (!userId) setCreditCards((prev) => prev.map((c) => c.id === id ? { ...c, ...updated } : c));
    if (await writeCardToCloud({ ...target, ...updated })) showToast('Cartão atualizado com sucesso!');
  };

  const handleDeleteCreditCard = async (id: string) => {
    const cardToDelete = creditCards.find((c) => c.id === id);
    if (!cardToDelete) return;
    if (!userId) setCreditCards((prev) => prev.filter((c) => c.id !== id));
    if (await writeCardToCloud(cardToDelete, true)) showToast('Cartão excluído com sucesso.');
  };

  const handleBulkUpdateCardId = async (transactionIds: string[], targetCardId: string) => {
    const targetCard = creditCards.find((card) => card.id === targetCardId);
    if (!targetCard) return;
    const ids = new Set(transactionIds);
    const updated = transactions.filter((entry) => ids.has(entry.id)).map((entry): Transaction => ({
      ...entry,
      creditCardId: targetCardId,
      paymentMethod: 'credit',
    }));
    if (!userId) {
      const updates = new Map(updated.map((entry) => [entry.id, entry]));
      setTransactions((prev) => prev.map((entry) => updates.get(entry.id) ?? entry));
    }
    if (await writeTransactionsToCloud(updated)) {
      showToast(updated.length + ' lançamento(s) vinculados ao ' + targetCard.name + '!');
    }
  };

  const handleImportTransactions = async (imported: Transaction[]) => {
    if (!await addTransactions(imported)) return false;
    showToast(imported.length + ' lançamentos importados!');
    return true;
  };

  const handleResetData = async () => {
    const newCategories = DEFAULT_CATEGORIES.filter((item) => !categories.some((entry) => entry.id === item.id));
    const newCards = DEFAULT_CREDIT_CARDS.filter((item) => !creditCards.some((entry) => entry.id === item.id));
    if (userId) {
      try {
        const batch = writeBatch(db);
        for (const item of newCategories) batch.set(doc(db, 'users', userId, 'categories', item.id), { ...item, userId });
        for (const item of newCards) batch.set(doc(db, 'users', userId, 'creditCards', item.id), { ...item, userId });
        await batch.commit();
      } catch (error) {
        reportCloudError(error);
        return;
      }
    } else {
      setCategories((prev) => [...prev, ...newCategories]);
      setCreditCards((prev) => [...prev, ...newCards]);
    }
    showToast('Categorias e cartões padrão disponíveis.');
  };

  const handleClearDatabaseAndStartFresh = async () => {
    if (userId) {
      setSyncStatus('syncing');
      try {
        await clearUserFirestoreTransactionsAndFixed(userId);
        setSyncStatus('synced');
      } catch (error) {
        reportCloudError(error);
        throw error;
      }
    } else {
      setTransactions([]);
      setFixedExpenses([]);
    }
    showToast('Lançamentos e gastos fixos apagados.');
  };

  const handleGoogleAuth = async () => {
    if (currentUser && !currentUser.isAnonymous) {
      await logoutUser();
      showToast('Desconectado com sucesso.');
    } else {
      try {
        const cred = await loginWithGoogle();
        if (cred && cred.user) {
          showToast(`Conectado como ${cred.user.displayName || cred.user.email}!`);
        }
      } catch (err: any) {
        console.error('Google Auth error in App:', err);
        setIsAuthModalOpen(true);
      }
    }
  };

  const pageTitle = activeTab === 'categories' ? 'Categorias' : MAIN_NAV.find((item) => item.id === activeTab)?.label;
  const openCardPurchase = () => setIsCardPurchaseOpen(true);
  const syncLabel = !userId ? 'Modo local' : syncStatus === 'synced' ? 'Nuvem conectada' :
    syncStatus === 'syncing' ? 'Sincronizando' : 'Sem conexão';
  const accountLabel = currentUser && !currentUser.isAnonymous ? 'Sair da conta' : 'Conectar conta';

  return (
    <div className="finance-app">
      <aside className="finance-sidebar">
        <button type="button" className="finance-brand" onClick={() => setActiveTab('dashboard')}>
          <span className="finance-logo"><Wallet size={21} strokeWidth={1.8} /></span>
          <span><strong>Nelio R$</strong><small>Finanças pessoais</small></span>
        </button>

        <p className="finance-nav-label">ESPAÇO PESSOAL</p>
        <nav className="finance-nav" aria-label="Menu principal">
          {MAIN_NAV.map(({ id, label, icon: Icon }) => <button key={id} type="button"
            aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}><Icon size={19} />{label}</button>)}
          <button type="button" aria-current={activeTab === 'categories' ? 'page' : undefined}
            onClick={() => setActiveTab('categories')}><FolderTree size={19} />Categorias</button>
        </nav>

        <div className="finance-sidebar-bottom">
          <p className="finance-nav-label">FERRAMENTAS</p>
          <nav className="finance-nav" aria-label="Ferramentas">
            <button type="button" onClick={() => setIsSpreadsheetModalOpen(true)}><FileSpreadsheet size={18} />Importar e exportar</button>
            <button type="button" onClick={() => setIsImportCsvModalOpen(true)}><CardIcon size={18} />Importar fatura XP</button>
          </nav>
          <button type="button" className="finance-account" onClick={handleGoogleAuth}>
            <span className="finance-account-avatar">{currentUser?.photoURL ? <img src={currentUser.photoURL} alt="" referrerPolicy="no-referrer" /> :
              currentUser && !currentUser.isAnonymous ? <LogOut size={17} /> : <LogIn size={17} />}</span>
            <span><strong>{currentUser?.displayName || accountLabel}</strong><small>{syncLabel}</small></span>
          </button>
        </div>
      </aside>

      <div className="finance-workspace">
        <header className="finance-topbar">
          <div className="finance-topbar-title">
            <span className="finance-logo finance-mobile-brand"><Wallet size={17} /></span>
            <span className="finance-desktop-title">{pageTitle}</span><strong className="finance-mobile-title">Nelio R$</strong>
          </div>
          <div className="finance-topbar-actions">
            <button type="button" className="finance-sync" onClick={handleManualSyncToCloud}><span /> {syncLabel}</button>
            <button type="button" className="finance-primary finance-top-add" onClick={openCardPurchase}><Plus size={18} /><span>Lançar compra</span></button>
            <details className="finance-mobile-menu">
              <summary className="finance-icon-button" aria-label="Mais opções"><Menu size={21} /></summary>
              <div onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}>
                <button type="button" onClick={() => setActiveTab('categories')}><FolderTree size={17} />Categorias</button>
                <button type="button" onClick={() => setIsSpreadsheetModalOpen(true)}><FileSpreadsheet size={17} />Importar e exportar</button>
                <button type="button" onClick={() => setIsImportCsvModalOpen(true)}><CardIcon size={17} />Importar fatura XP</button>
                <button type="button" onClick={handleGoogleAuth}><LogIn size={17} />{accountLabel}</button>
              </div>
            </details>
          </div>
        </header>

        <main className={activeTab === 'dashboard' ? 'finance-main' : 'finance-main finance-detail'} key={activeTab}>
          {activeTab !== 'dashboard' && <div className="finance-page-heading finance-subpage"><h1>{pageTitle}</h1></div>}
          {activeTab === 'dashboard' && <DashboardView
            categories={categories} creditCards={creditCards} fixedExpenses={fixedExpenses} transactions={plannedTransactions}
            selectedMonth={selectedMonth} onChangeMonth={setSelectedMonth} onAddCardPurchase={openCardPurchase}
            onAddFixed={() => openFixedForm({ kind: 'new', type: 'expense' })}
            onSetSalary={() => openFixedForm({ kind: 'new', type: 'income' })} onAdjustFixed={adjustFixed}
            onEditTransaction={editTransaction} onNavigateToTransactions={() => setActiveTab('transactions')}
            onNavigateToFixed={() => setActiveTab('fixed')}
          />}

          {activeTab === 'transactions' && <TransactionsView
            categories={categories} creditCards={creditCards} transactions={plannedTransactions} selectedMonth={selectedMonth}
            onChangeMonth={setSelectedMonth} onOpenQuickAdd={handleOpenAdd} onEditTransaction={editTransaction}
            onDeleteTransaction={handleDeleteTransaction} onOpenSpreadsheetModal={() => setIsSpreadsheetModalOpen(true)}
            onOpenImportCsvModal={() => setIsImportCsvModalOpen(true)}
          />}

          {activeTab === 'cards' && <CardsView
            categories={categories} creditCards={creditCards} transactions={plannedTransactions} selectedMonth={selectedMonth}
            onChangeMonth={setSelectedMonth} onAddCreditCard={handleAddCreditCard} onUpdateCreditCard={handleUpdateCreditCard}
            onDeleteCreditCard={handleDeleteCreditCard} onOpenImportCsvModal={() => setIsImportCsvModalOpen(true)}
            onBulkUpdateCardId={handleBulkUpdateCardId} onEditTransaction={editTransaction} onDeleteTransaction={handleDeleteTransaction}
          />}

          {activeTab === 'fixed' && <FixedExpensesView
            fixedExpenses={fixedExpenses} categories={categories} creditCards={creditCards} selectedMonth={selectedMonth}
            onChangeMonth={setSelectedMonth} transactions={transactions} onAddFixedExpense={handleAddFixedExpense}
            onUpdateFixedExpense={handleUpdateFixedExpense} onUpdateFixedMonthlyAmount={handleUpdateFixedMonthlyAmount}
            onDeleteFixedExpense={handleDeleteFixedExpense} formRequest={fixedFormRequest} onConsumeFormRequest={() => setFixedFormRequest(null)}
          />}

          {activeTab === 'categories' && <CategoriesView
            categories={categories} creditCards={creditCards} transactions={plannedTransactions} currentMonthKey={selectedMonth}
            onAddCategory={handleAddCategory} onUpdateCategory={handleUpdateCategory} onDeleteCategory={handleDeleteCategory}
            merchants={merchants} onAddMerchant={handleAddMerchant} onUpdateMerchant={handleUpdateMerchant}
            onDeleteMerchant={handleDeleteMerchant} onResetMerchants={handleResetMerchants}
          />}
        </main>
      </div>

      <nav className="finance-bottom-nav" aria-label="Navegação rápida">
        {MAIN_NAV.map(({ id, short, icon: Icon }) => <button key={id} type="button"
          aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}><Icon size={20} />{short}</button>)}
      </nav>

      {toastMessage && <div role="status" className="finance-toast">{toastMessage}</div>}
      {isCardPurchaseOpen && <CardPurchaseDialog
        cards={creditCards} categories={categories} lastCardId={lastCardId} onClose={() => setIsCardPurchaseOpen(false)}
        onSave={handleSaveTransaction}
        onManageCards={() => { setIsCardPurchaseOpen(false); setActiveTab('cards'); }}
        onAdvanced={(draft) => { setIsCardPurchaseOpen(false); setCardPurchaseDraft(draft); handleOpenAdd('expense'); }}
      />}
      <QuickAddModal isOpen={isQuickAddOpen} onClose={() => { setIsQuickAddOpen(false); setEditingTransaction(null); setCardPurchaseDraft(null); }}
        onSave={handleSaveTransaction} categories={categories} creditCards={creditCards} initialData={editingTransaction}
        initialType={quickAddType} cardPurchaseDraft={cardPurchaseDraft} selectedMonth={selectedMonth} merchants={merchants} onAddMerchant={handleAddMerchant} />
      <SpreadsheetImportExportModal isOpen={isSpreadsheetModalOpen} onClose={() => setIsSpreadsheetModalOpen(false)}
        transactions={transactions} categories={categories} creditCards={creditCards} fixedExpenses={fixedExpenses}
        onImportTransactions={handleImportTransactions} onResetData={handleResetData}
        onClearDatabaseAndStartFresh={handleClearDatabaseAndStartFresh} onOpenImportCsvModal={() => setIsImportCsvModalOpen(true)} />
      <ImportCsvModal isOpen={isImportCsvModalOpen} onClose={() => setIsImportCsvModalOpen(false)}
        creditCards={creditCards} categories={categories} onImportTransactions={handleImportTransactions} onAddCreditCard={handleAddCreditCard} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSuccess={() => showToast('Autenticado com sucesso!')} />
    </div>
  );
}
