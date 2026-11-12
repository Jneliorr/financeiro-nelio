import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Check,
  CreditCard as CardIcon,
  AlertCircle,
  Sparkles,
  Layers,
  ChevronDown,
  FileText,
  Calendar,
  DollarSign,
  Tag,
  Store,
  RefreshCw,
} from 'lucide-react';
import { Category, CreditCard, Transaction, TransactionType } from '../types';
import { calculateInstallmentDate, formatCurrency } from '../utils/formatters';
import { normalizeHeader, parseDelimitedRows, parseFinancialAmount, parseFinancialDate } from '../utils/delimitedData';

interface ParsedRow {
  id: string;
  selected: boolean;
  rawDate: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  description: string;
  rawAmount: string;
  amount: number;
  type: TransactionType;
  rawParcela: string;
  currentInstallment: number;
  totalInstallments: number;
  categoryId: string;
  tags: string[];
}

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditCards: CreditCard[];
  categories: Category[];
  onImportTransactions: (transactions: Transaction[]) => Promise<boolean>;
  onAddCreditCard: (card: Omit<CreditCard, 'id'>) => Promise<CreditCard | undefined>;
}

const XP_SAMPLE_CSV = `Data;Estabelecimento;Valor;Parcela
01/08/2026;ALLPARK MATRIZ -;R$ 16,00;-
03/08/2026;MERCADOLIVRE*MERCADOLIVRE;R$ 45,03;-
03/08/2026;RECANTO DO CAFE;R$ 5,25;-
05/08/2026;COMERCIO VAREJISTA DE;R$ 5,92;-
05/08/2026;MERCADOLIVRE*SABORDATERRA;R$ 91,57;-
05/08/2026;BOMFRIOS PRIME;R$ 76,53;-
05/08/2026;BOMFRIOS PRIME;R$ 4,50;-
06/08/2026;BOMFRIOS PRIME;R$ 5,79;-
07/08/2026;CASTROVALENTIM;R$ 11,99;-
07/08/2026;BOMFRIOS PRIME;R$ 40,55;-
07/08/2026;BOMFRIOS PRIME;R$ 5,20;-
07/08/2026;DL*GOOGLE GOOGLE;R$ 23,99;-
11/08/2026;BOMFRIOS PRIME;R$ 39,70;-
11/08/2026;CASA DO GRAO;R$ 15,39;-
12/08/2026;BOMFRIOS PRIME;R$ 80,70;-
12/08/2026;TIM*TIM;R$ 30,00;-
13/08/2026;CASTROVALENTIM;R$ 7,90;-
13/08/2026;LINKEDIN;R$ 34,99;-
13/08/2026;MERCADOLIVRE*DECCOMODAINT;R$ 69,99;-
13/08/2026;SHOPEE *GTSFEEL;R$ 95,52;1 de 12
14/08/2026;OLDSCHOOL BARBEARIA;R$ 35,00;-
16/08/2026;ZP*INTERUXT 58145;R$ 35,00;-
16/08/2026;ZP*INTERUXT 58145;R$ 34,00;-
16/08/2026;MP*ESPACOHARMONI;R$ 9,90;-
17/08/2026;COMERCIO VAREJISTA DE;R$ 10,00;-
29/07/2026;DR LANCHES ITABORAI;R$ 9,00;-
30/07/2026;LOJAS AMERICANAS;R$ 21,97;-
30/07/2026;DL*UBERRIDES;R$ 7,94;-
31/07/2026;CASA DO GRAO;R$ 9,79;-`;

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  isOpen,
  onClose,
  creditCards,
  categories,
  onImportTransactions,
  onAddCreditCard,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string>(() => {
    const xpCard = creditCards.find((c) => c.name.toLowerCase().includes('xp'));
    return xpCard?.id || creditCards[0]?.id || '';
  });

  const [inputMode, setInputMode] = useState<'paste' | 'file'>('paste');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [projectFutureInstallments, setProjectFutureInstallments] = useState(true);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Helper to auto-categorize based on merchant string
  const autoDetectCategory = (merchantStr: string): string => {
    const m = merchantStr.toLowerCase();

    // Mercado / Alimentos básicos
    if (
      m.includes('bomfrios') ||
      m.includes('mercado') ||
      m.includes('atacadao') ||
      m.includes('carrefour') ||
      m.includes('assai') ||
      m.includes('casa do grao') ||
      m.includes('grao') ||
      m.includes('hortifruti') ||
      m.includes('varejista') ||
      m.includes('castrovalentim') ||
      m.includes('sabordaterra')
    ) {
      const cat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('mercado') ||
          c.name.toLowerCase().includes('feira') ||
          c.name.toLowerCase().includes('alimentação')
      );
      if (cat) return cat.id;
    }

    // Lanches / Delivery / Café
    if (
      m.includes('lanche') ||
      m.includes('cafe') ||
      m.includes('café') ||
      m.includes('recanto') ||
      m.includes('ifood') ||
      m.includes('restaurante') ||
      m.includes('pizza') ||
      m.includes('burger')
    ) {
      const cat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('lanche') ||
          c.name.toLowerCase().includes('delivery') ||
          c.name.toLowerCase().includes('alimentação')
      );
      if (cat) return cat.id;
    }

    // Transporte / Carro / Uber / Estacionamento
    if (
      m.includes('allpark') ||
      m.includes('uber') ||
      m.includes('99') ||
      m.includes('estacionamento') ||
      m.includes('posto') ||
      m.includes('combustivel') ||
      m.includes('gasolina') ||
      m.includes('pedagio') ||
      m.includes('mobilidade')
    ) {
      const cat = categories.find((c) => c.name.toLowerCase().includes('transporte'));
      if (cat) return cat.id;
    }

    // Compras / E-commerce / Roupas
    if (
      m.includes('shopee') ||
      m.includes('mercadolivre') ||
      m.includes('amazon') ||
      m.includes('americanas') ||
      m.includes('lojas') ||
      m.includes('deccomodaint') ||
      m.includes('aliexpress') ||
      m.includes('shein') ||
      m.includes('magalu')
    ) {
      const cat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('compras') ||
          c.name.toLowerCase().includes('vestuário') ||
          c.name.toLowerCase().includes('shopping')
      );
      if (cat) return cat.id;
    }

    // Contas / Assinaturas / Tecnologia
    if (
      m.includes('tim') ||
      m.includes('claro') ||
      m.includes('vivo') ||
      m.includes('google') ||
      m.includes('linkedin') ||
      m.includes('netflix') ||
      m.includes('spotify') ||
      m.includes('internet')
    ) {
      const cat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('moradia') ||
          c.name.toLowerCase().includes('contas') ||
          c.name.toLowerCase().includes('assinatura')
      );
      if (cat) return cat.id;
    }

    // Cuidados Pessoais / Barbearia / Salão
    if (
      m.includes('barbearia') ||
      m.includes('oldschool') ||
      m.includes('salao') ||
      m.includes('espacoharmoni') ||
      m.includes('estetica')
    ) {
      const cat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('saúde') ||
          c.name.toLowerCase().includes('passeio') ||
          c.name.toLowerCase().includes('compras')
      );
      if (cat) return cat.id;
    }

    // Saúde / Farmácia
    if (m.includes('farmacia') || m.includes('drogaria') || m.includes('saude') || m.includes('droga')) {
      const cat = categories.find((c) => c.name.toLowerCase().includes('saúde'));
      if (cat) return cat.id;
    }

    // Default to first expense category
    const defaultExpense = categories.find((c) => c.type === 'expense');
    return defaultExpense?.id || categories[0]?.id || 'cat-outros';
  };

  const handleParseCsv = (content: string) => {
    setParseError(null);
    setParsedRows([]);
    if (!content.trim()) return;

    try {
      const rows = parseDelimitedRows(content);
      const headers = (rows[0] ?? []).map(normalizeHeader);
      const dateColumn = headers.findIndex((value) => /^(data( (da compra|do lancamento))?|date)$/.test(value));
      const amountColumn = headers.findIndex((value) => /^(valor( .*)?|amount|preco)$/.test(value));
      const hasHeader = dateColumn >= 0 && amountColumn >= 0;
      const merchantColumn = headers.findIndex((value) => /^(estabelecimento|local|descricao|merchant|historico)$/.test(value));
      const installmentsColumn = headers.findIndex((value) => /^parcelas?$/.test(value));
      const dataRows = hasHeader ? rows.slice(1) : rows;

      const parsed = dataRows.flatMap((cells): ParsedRow[] => {
        const rawDate = cells[hasHeader ? dateColumn : 0] ?? '';
        const rawAmount = cells[hasHeader ? amountColumn : 2] ?? '';
        const rawParcela = cells[hasHeader ? installmentsColumn : 3] ?? '';
        const date = parseFinancialDate(rawDate);
        const amount = parseFinancialAmount(rawAmount);
        if (!date || !amount) return [];

        const installmentText = rawParcela.trim();
        const installment = installmentText.match(/^(\d+)\s*(?:de|\/)\s*(\d+)$/i);
        const current = installment ? Number(installment[1]) : 1;
        const total = installment ? Number(installment[2]) : /^\d+$/.test(installmentText) ? Number(installmentText) : 1;
        if (current < 1 || total < current || total > 120) return [];
        const merchant = cells[hasHeader ? merchantColumn : 1] || 'Lançamento da fatura';
        const type: TransactionType = amount < 0 ? 'income' : 'expense';
        const categoryId = type === 'income'
          ? categories.find((category) => category.type === 'income')?.id ?? 'cat-extra'
          : autoDetectCategory(merchant);
        const category = categories.find((entry) => entry.id === categoryId);
        return [{
          id: crypto.randomUUID(),
          selected: true,
          rawDate,
          date,
          merchant,
          description: merchant,
          rawAmount,
          amount: Math.abs(amount),
          type,
          rawParcela,
          currentInstallment: current,
          totalInstallments: total,
          categoryId,
          tags: category ? ['#' + category.name.split(' ')[0]] : [],
        }];
      });

      setParsedRows(parsed);
      if (!parsed.length) setParseError('Nenhuma linha válida. Confira datas, valores e parcelas.');
      else if (parsed.length !== dataRows.length) {
        setParseError((dataRows.length - parsed.length) + ' linhas ignoradas por data, valor ou parcela inválida.');
      }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo.');
    }
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsedRows([]);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      handleParseCsv(content);
    };
    reader.onerror = () => setParseError('Não foi possível ler o arquivo selecionado.');
    reader.readAsText(file, 'UTF-8');
  };

  // Toggle individual row
  const toggleRow = (id: string) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  // Toggle all rows
  const toggleAll = (select: boolean) => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: select })));
  };

  // Change category for a row
  const handleRowCategoryChange = (id: string, newCatId: string) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const cat = categories.find((c) => c.id === newCatId);
        const tag = cat ? `#${cat.name.split(' ')[0]}` : '#XP';
        return {
          ...r,
          categoryId: newCatId,
          tags: [tag],
        };
      })
    );
  };

  // Create XP Card if doesn't exist
  const handleCreateXPCard = async () => {
    const newCard = await onAddCreditCard({
      name: 'Cartão XP',
      bankName: 'XP Investimentos',
      color: '#111827',
      closingDay: 20,
      dueDay: 28,
      limit: 10000,
    });
    if (newCard) {
      setSelectedCardId(newCard.id);
    }
  };

  const selectedCard = creditCards.find((card) => card.id === selectedCardId)
    ?? creditCards.find((card) => /\bxp\b/i.test(card.name))
    ?? creditCards[0];

  const handleExecuteImport = async () => {
    const selected = parsedRows.filter((row) => row.selected);
    if (!selected.length || isProcessing) return;
    if (!selectedCard) {
      setParseError('Cadastre ou selecione um cartão para importar a fatura.');
      return;
    }

    setIsProcessing(true);
    const createdAt = new Date().toISOString();
    const entries = selected.flatMap((row) => {
      const groupId = 'grp-csv-' + row.id;
      const total = row.totalInstallments;
      const last = projectFutureInstallments ? total : row.currentInstallment;
      return Array.from({ length: last - row.currentInstallment + 1 }, (_, offset): Transaction => {
        const current = row.currentInstallment + offset;
        return {
          id: 'tx-csv-' + row.id + '-' + current,
          description: row.description,
          merchant: row.merchant,
          amount: row.amount,
          type: row.type,
          categoryId: row.categoryId,
          tags: row.tags,
          date: calculateInstallmentDate(row.date, offset),
          paymentMethod: 'credit',
          creditCardId: selectedCard.id,
          installments: total > 1 ? {
            groupId,
            current,
            total,
            totalAmount: Math.round(row.amount * 100) * total / 100,
            installmentAmount: row.amount,
          } : undefined,
          createdAt,
        };
      });
    });

    try {
      if (await onImportTransactions(entries)) {
        setParsedRows([]);
        setCsvText('');
        setFileName(null);
        setParseError(null);
        onClose();
      } else {
        setParseError('A importação ficou incompleta. Tente confirmar novamente.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedCount = parsedRows.filter((r) => r.selected).length;
  const totalSelectedAmount = parsedRows
    .filter((r) => r.selected)
    .reduce((sum, r) => sum + (r.type === 'expense' ? r.amount : -r.amount), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sage-950/70 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-sage-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="finance-gradient px-5 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-white/10 border border-white/20 text-pine-200 flex items-center justify-center font-bold">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm sm:text-base">Importar Fatura de Cartão (XP / CSV)</h3>
                <span className="px-2 py-0.5 bg-white/10 text-pine-200 rounded-full text-[10px] font-extrabold border border-white/20">
                  Mapeamento Automático
                </span>
              </div>
              <p className="text-[11px] text-sage-300">
                Suporta colunas: <strong>Data • Estabelecimento • Valor • Parcela</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-pine-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Card Selection */}
          <div className="p-3.5 bg-sage-50 rounded-2xl border border-sage-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-sage-700 uppercase tracking-wider flex items-center gap-1.5">
                <CardIcon size={14} className="text-pine-600" />
                Vincular Gastos ao Cartão:
              </label>
              {!creditCards.some((c) => c.name.toLowerCase().includes('xp')) && (
                <button
                  type="button"
                  onClick={handleCreateXPCard}
                  className="text-[10px] text-pine-600 font-bold hover:underline flex items-center gap-1"
                >
                  + Criar Cartão XP
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedCard?.id ?? ''}
                disabled={isProcessing}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-sage-300 rounded-xl text-xs font-bold text-sage-800 shadow-2xs focus:ring-2 focus:ring-pine-600"
              >
                {creditCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    💳 {card.name} ({card.bankName || 'Banco'})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-sage-200 text-[11px] text-sage-600">
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: selectedCard?.color || '#111827' }}
                />
                <span className="truncate">
                  {selectedCard
                    ? `Fecha dia ${selectedCard.closingDay} • Vence dia ${selectedCard.dueDay}`
                    : 'Selecione o cartão de crédito'}
                </span>
              </div>
            </div>
          </div>

          {/* Input Method Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sage-600 uppercase tracking-wider">
                Origem dos Dados:
              </span>
              <div className="flex items-center gap-1 bg-sage-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    inputMode === 'paste' ? 'bg-pine-600 text-white shadow-xs' : 'text-sage-600'
                  }`}
                >
                  📋 Colar Texto CSV
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('file')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    inputMode === 'file' ? 'bg-pine-600 text-white shadow-xs' : 'text-sage-600'
                  }`}
                >
                  📂 Enviar Arquivo .CSV
                </button>
              </div>
            </div>

            {inputMode === 'file' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-sage-300 hover:border-pine-600 bg-sage-50/70 hover:bg-sage-50 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-pine-100 text-pine-600 flex items-center justify-center mx-auto">
                  <Upload size={20} />
                </div>
                <div>
                  <p className="font-bold text-sage-700 text-xs">
                    {fileName ? `Arquivo selecionado: ${fileName}` : 'Clique para selecionar o arquivo da XP (.csv)'}
                  </p>
                  <p className="text-[10px] text-sage-400">Arraste ou selecione o arquivo exportado do seu cartão</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-sage-500">
                    Cole as linhas com <code>Data;Estabelecimento;Valor;Parcela</code>:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvText(XP_SAMPLE_CSV);
                      handleParseCsv(XP_SAMPLE_CSV);
                    }}
                    className="text-[10px] font-bold text-pine-600 hover:text-pine-800 flex items-center gap-1 bg-pine-50 px-2 py-1 rounded-lg border border-pine-600/30"
                  >
                    <Sparkles size={11} /> Preencher com Exemplo da XP
                  </button>
                </div>

                <textarea
                  rows={5}
                  value={csvText}
                  onChange={(e) => {
                    setCsvText(e.target.value);
                    handleParseCsv(e.target.value);
                  }}
                  placeholder="Data;Estabelecimento;Valor;Parcela&#10;01/08/2026;ALLPARK MATRIZ -;R$ 16,00;-&#10;13/08/2026;SHOPEE *GTSFEEL;R$ 95,52;1 de 12"
                  className="w-full p-3 border border-sage-200 rounded-2xl text-[11px] tabular-nums leading-relaxed bg-sage-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pine-600"
                />
              </div>
            )}
          </div>

          {/* Projection Option for Installments */}
          <div className="p-3 bg-pine-50/80 rounded-2xl border border-pine-600/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-pine-600 shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-pine-950">
                  Projetar Parcelas Futuras Automaticamente
                </p>
                <p className="text-[10px] text-pine-800">
                  Ex: Se houver compra "1 de 12", cria automaticamente as parcelas 2 a 12 nos meses seguintes no extrato.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={projectFutureInstallments}
              onChange={(e) => setProjectFutureInstallments(e.target.checked)}
              className="w-4 h-4 text-pine-600 rounded-md focus:ring-pine-600 shrink-0 cursor-pointer"
            />
          </div>

          {/* Error Message */}
          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-xs">
              <AlertCircle size={15} className="shrink-0 text-rose-500" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between bg-sage-100 p-2.5 rounded-xl text-sage-700">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs">
                    {selectedCount} de {parsedRows.length} lançamentos selecionados
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAll(true)}
                    className="text-[10px] text-pine-600 font-bold hover:underline"
                  >
                    Marcar Todos
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => toggleAll(false)}
                    className="text-[10px] text-sage-500 font-bold hover:underline"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              {/* Total preview card */}
              <div className="p-3 bg-sage-900 text-white rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-sage-400 block uppercase font-bold tracking-wider">
                    Total da Fatura a Importar
                  </span>
                  <span className="text-base font-extrabold text-pine-200 tabular-nums">
                    {formatCurrency(totalSelectedAmount)}
                  </span>
                </div>
                <div className="text-right text-[10px] text-sage-300">
                  <span className="block font-bold">Cartão: {selectedCard?.name || 'XP'}</span>
                  <span>{selectedCount} transações prontas</span>
                </div>
              </div>

              {/* Editable rows list */}
              <div className="border border-sage-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-sage-100 bg-white">
                {parsedRows.map((row) => (
                  <div
                    key={row.id}
                    className={`p-2.5 flex items-center justify-between gap-2 hover:bg-sage-50 transition-colors ${
                      !row.selected ? 'opacity-40 bg-sage-50/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleRow(row.id)}
                        className="w-4 h-4 text-pine-600 rounded-md focus:ring-pine-600 shrink-0 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sage-800 text-xs truncate">
                            {row.merchant}
                          </span>
                          {row.totalInstallments > 1 && (
                            <span className="px-1.5 py-0.2 bg-pine-100 text-pine-800 rounded-md text-[9px] font-bold shrink-0">
                              {row.currentInstallment}/{row.totalInstallments}x
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-sage-400 flex-wrap">
                          <span className="tabular-nums">{row.date}</span>
                          {selectedCard && parseInt(row.date.split('-')[2] || '0', 10) >= (selectedCard.closingDay || 25) && (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded">
                              Pós-fechamento (Fatura seguinte)
                            </span>
                          )}
                          <span>•</span>
                          <select
                            value={row.categoryId}
                            onChange={(e) => handleRowCategoryChange(row.id, e.target.value)}
                            className="bg-transparent border-b border-sage-200 text-sage-600 font-semibold text-[10px] focus:outline-none focus:border-pine-600"
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
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="tabular-nums font-bold text-xs text-rose-600">
                        -{formatCurrency(row.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-sage-100 bg-sage-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-sage-200 text-sage-700 font-bold rounded-xl text-xs hover:bg-sage-100"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={selectedCount === 0 || !selectedCard || isProcessing}
            onClick={handleExecuteImport}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all ${
              parsedRows.length === 0 || selectedCount === 0 || isProcessing
                ? 'bg-sage-300 text-sage-500 cursor-not-allowed'
                : 'bg-pine-600 hover:bg-pine-800 text-white shadow-pine-500/20'
            }`}
          >
            <Check size={16} />
            {isProcessing
              ? 'Importando...'
              : `Importar ${selectedCount} Lançamentos no Cartão XP`}
          </button>
        </div>
      </div>
    </div>
  );
};
