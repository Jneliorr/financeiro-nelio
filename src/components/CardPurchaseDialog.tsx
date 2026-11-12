import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, CreditCard as CreditCardIcon, X } from 'lucide-react';
import { Category, CreditCard } from '../types';
import { getTransactionBillingMonth } from '../utils/creditCardHelpers';
import { parseFinancialAmount, parseFinancialDate } from '../utils/delimitedData';
import { formatMonthYear, getTodayDateString } from '../utils/formatters';
import type { SaveTransactionPayload } from './QuickAddModal';

export interface CardPurchaseDraft {
  amount: string;
  description: string;
  cardId: string;
  categoryId: string;
  date: string;
}

interface Props {
  cards: CreditCard[];
  categories: Category[];
  lastCardId?: string;
  onClose: () => void;
  onAdvanced: (draft: CardPurchaseDraft) => void;
  onManageCards: () => void;
  onSave: (payload: SaveTransactionPayload) => Promise<boolean>;
}

export function CardPurchaseDialog({ cards, categories, lastCardId, onClose, onAdvanced, onManageCards, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [cardId, setCardId] = useState(cards.find((card) => card.id === lastCardId)?.id ?? cards[0]?.id ?? '');
  const expenseCategories = categories.filter((category) => category.type === 'expense');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? '');
  const [date, setDate] = useState(getTodayDateString);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  const payload = (value: number): SaveTransactionPayload => ({
    amount: value, description: description.trim(), categoryId, date, creditCardId: cardId,
    type: 'expense', paymentMethod: 'credit',
  });
  const selectedCard = cards.find((card) => card.id === cardId);
  const billingMonth = selectedCard && parseFinancialDate(date)
    ? getTransactionBillingMonth({ ...payload(0), id: '', createdAt: '' }, cards)
    : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const parsed = parseFinancialAmount(amount);
    if (parsed === null || parsed <= 0 || !description.trim() || !billingMonth ||
      !expenseCategories.some((item) => item.id === categoryId)) {
      setError('Preencha a descrição, o valor, a categoria, o cartão e a data da compra.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (await onSave(payload(parsed))) onClose();
      else setError('Não foi possível salvar. Tente novamente.');
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return <dialog ref={dialog} className="finance-dialog" aria-labelledby="card-purchase-title"
    onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className="finance-dialog-header">
      <div className="finance-metric-icon credit"><CreditCardIcon size={20} /></div>
      <button type="button" className="finance-icon-button" aria-label="Fechar" onClick={onClose} disabled={saving}><X size={20} /></button>
    </div>
    <h2 id="card-purchase-title">Lançar compra</h2>
    <p>Registre a compra e confira em qual fatura ela entra.</p>
    {!cards.length ? <div className="finance-dialog-empty">
      <p>Cadastre um cartão para registrar sua primeira compra.</p>
      <button type="button" className="finance-primary" onClick={onManageCards}>Ir para cartões <ArrowRight size={17} /></button>
    </div> : <form onSubmit={submit}>
      <div className="finance-dialog-grid">
        <label>Valor da compra (R$)<input required autoFocus inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label>Data da compra<input type="date" required value={date}
          onInput={(event) => setDate(event.currentTarget.value)} onChange={(event) => setDate(event.target.value)} /></label>
      </div>
      <label>Descrição<input required maxLength={120} placeholder="Ex.: Mercado da semana" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <div className="finance-dialog-grid">
        <label>Cartão<select required value={cardId} onChange={(event) => setCardId(event.target.value)}>
          {cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
        </select></label>
        <label>Categoria<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          {!expenseCategories.length && <option value="">Nenhuma categoria</option>}
          {expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select></label>
      </div>
      {billingMonth && <p className="finance-invoice-hint"><CreditCardIcon size={16} /> Fatura de <strong>{formatMonthYear(billingMonth)}</strong></p>}
      {error && <p role="alert" className="finance-form-error">{error}</p>}
      <div className="finance-dialog-actions">
        <button type="button" className="finance-link" onClick={() => onAdvanced({ amount, description, cardId, categoryId, date })} disabled={saving}>Compra parcelada</button>
        <button type="submit" className="finance-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar compra'}</button>
      </div>
    </form>}
  </dialog>;
}
