import React, { useState } from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  X,
  Check,
  AlertCircle,
  Trash2,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Transaction, Category, CreditCard, FixedExpense, PaymentMethod, TransactionType } from '../types';
import { formatCurrency, getTodayDateString } from '../utils/formatters';
import { normalizeHeader, parseDelimitedRows, parseFinancialAmount, parseFinancialDate, quoteSpreadsheetCell, readSpreadsheetText } from '../utils/delimitedData';

const PAYMENT_METHODS: Partial<Record<string, PaymentMethod>> = {
  pix: 'pix',
  credit: 'credit',
  'cartao de credito': 'credit',
  debit: 'debit',
  debito: 'debit',
  cash: 'cash',
  dinheiro: 'cash',
  transfer: 'transfer',
  transferencia: 'transfer',
  'transferencia / ted': 'transfer',
};

interface SpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  creditCards?: CreditCard[];
  fixedExpenses?: FixedExpense[];
  onImportTransactions: (imported: Transaction[]) => Promise<boolean>;
  onResetData: () => void;
  onClearDatabaseAndStartFresh: () => Promise<void>;
  onOpenImportCsvModal?: () => void;
}

export const SpreadsheetImportExportModal: React.FC<SpreadsheetModalProps> = ({
  isOpen,
  onClose,
  transactions,
  categories,
  creditCards = [],
  fixedExpenses = [],
  onImportTransactions,
  onResetData,
  onClearDatabaseAndStartFresh,
  onOpenImportCsvModal,
}) => {
  const [activeTab, setActiveTab] = useState<'hybrid' | 'export' | 'import' | 'clean'>('hybrid');
  const [pastedText, setPastedText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importedPreview, setImportedPreview] = useState<Transaction[]>([]);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Generate TSV row format for easy copy-paste into Google Sheets / Excel
  const getSpreadsheetHeaders = () => [
    'Data',
    'Mês Referência',
    'Tipo',
    'Descrição',
    'Estabelecimento',
    'Categoria',
    'Valor (R$)',
    'Forma de Pagamento',
    'Cartão',
    'Parcela',
    'Gasto Fixo',
  ];

  const getSpreadsheetRowData = (t: Transaction) => {
    const cat = categories.find((c) => c.id === t.categoryId);
    const catName = cat ? cat.name : 'Geral';
    const card = creditCards.find((c) => c.id === t.creditCardId);
    const cardName = card ? card.name : t.creditCardId ? 'Cartão' : '-';
    const tipoStr = t.type === 'expense' ? 'Despesa' : 'Receita';
    const valorStr = t.amount.toFixed(2).replace('.', ',');
    const desc = t.description || '';
    const merchant = t.merchant || '';
    const parcelaStr = t.installments ? `${t.installments.current}/${t.installments.total}` : '-';
    const fixoStr = t.isFixed ? 'Sim' : 'Não';
    const mesRef = t.date.substring(0, 7);

    return [
      t.date,
      mesRef,
      tipoStr,
      desc,
      merchant,
      catName,
      valorStr,
      t.paymentMethod || 'Outro',
      cardName,
      parcelaStr,
      fixoStr,
    ];
  };

  // Export to Excel / Google Sheets CSV (UTF-8 with BOM for PT-BR accents)
  const handleExportCSV = () => {
    const headers = getSpreadsheetHeaders();
    const rows = transactions.map((t) => {
      const row = getSpreadsheetRowData(t);
      return row.map((cell) => quoteSpreadsheetCell(cell, ';')).join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `financas_espelho_planilha_${getTodayDateString()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Copy rows formatted with TAB (\t) for direct Ctrl+V into Google Sheets or Excel
  const handleCopyForGoogleSheets = () => {
    const headers = getSpreadsheetHeaders();
    const rows = transactions.map((t) => getSpreadsheetRowData(t).map((cell) => quoteSpreadsheetCell(cell, '\t')).join('\t'));
    const tsvContent = [headers.join('\t'), ...rows].join('\n');

    navigator.clipboard.writeText(tsvContent).then(() => {
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 3000);
    });
  };

  const handleParsePastedData = () => {
    setImportedPreview([]);
    try {
      const rows = parseDelimitedRows(pastedText);
      const headers = (rows[0] ?? []).map(normalizeHeader);
      const findColumn = (pattern: RegExp) => headers.findIndex((header) => pattern.test(header));
      const dateColumn = findColumn(/^(data( do lancamento)?|date)$/);
      const amountColumn = findColumn(/^(valor( .*)?|amount|preco)$/);
      const hasHeader = dateColumn >= 0 && amountColumn >= 0;
      const descriptionColumn = findColumn(/^(descricao|description|historico)$/);
      const merchantColumn = findColumn(/^(estabelecimento|merchant|local)$/);
      const categoryColumn = findColumn(/^(categoria|category)$/);
      const typeColumn = findColumn(/^(tipo|type)$/);
      const paymentColumn = findColumn(/^(forma de pagamento|pagamento)$/);
      const cardColumn = findColumn(/^(cartao|card)$/);
      const dataRows = hasHeader ? rows.slice(1) : rows;
      const createdAt = new Date().toISOString();
      const parsed = dataRows.flatMap((row): Transaction[] => {
        const date = hasHeader ? parseFinancialDate(row[dateColumn] ?? '') : row.map(parseFinancialDate).find(Boolean);
        const amount = hasHeader ? parseFinancialAmount(row[amountColumn] ?? '') : row.map(parseFinancialAmount).reverse().find((value) => value !== null);
        if (!date || !amount) return [];

        const categoryName = readSpreadsheetText(row[categoryColumn] ?? '');
        const category = categories.find((item) => categoryName
          ? normalizeHeader(item.name) === normalizeHeader(categoryName)
          : !hasHeader && row.some((cell) => normalizeHeader(cell) === normalizeHeader(item.name)));
        const explicitType = normalizeHeader(row[typeColumn] ?? '');
        const type: TransactionType = /^(receita|income|entrada)$/.test(explicitType)
          ? 'income'
          : /^(despesa|expense|saida)$/.test(explicitType)
            ? 'expense'
            : category?.type ?? 'expense';
        const description = hasHeader ? row[descriptionColumn] : row.find((cell) =>
          cell && !parseFinancialDate(cell) && parseFinancialAmount(cell) === null && cell !== category?.name);
        const method = normalizeHeader(row[paymentColumn] ?? '');
        const paymentMethod = Object.hasOwn(PAYMENT_METHODS, method) ? PAYMENT_METHODS[method] : 'other';
        const cardName = normalizeHeader(readSpreadsheetText(row[cardColumn] ?? ''));
        const card = cardName ? creditCards.find((item) => normalizeHeader(item.name) === cardName || item.id === cardName) : undefined;

        return [{
          id: 'import-' + crypto.randomUUID(),
          description: readSpreadsheetText(description || row[merchantColumn] || 'Lançamento importado'),
          merchant: row[merchantColumn] ? readSpreadsheetText(row[merchantColumn]) : undefined,
          amount: Math.abs(amount),
          type,
          categoryId: category?.id ?? categories.find((item) => item.type === type)?.id ?? 'cat-outros',
          date,
          paymentMethod,
          creditCardId: paymentMethod === 'credit' ? card?.id : undefined,
          createdAt,
        }];
      });

      setImportedPreview(parsed);
      const skipped = dataRows.length - parsed.length;
      setImportStatus(parsed.length
        ? parsed.length + ' lançamentos prontos para importar.' + (skipped ? ' ' + skipped + ' linhas ignoradas por data ou valor inválido.' : '')
        : 'Nenhuma linha válida. Confira se as linhas têm data e valor.');
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : 'Erro ao ler os dados da planilha.');
    }
  };

  const handleConfirmImport = async () => {
    if (!importedPreview.length || isImporting) return;
    setIsImporting(true);
    try {
      if (!await onImportTransactions(importedPreview)) {
        setImportStatus('A importação ficou incompleta. Tente confirmar novamente.');
        return;
      }
      setImportedPreview([]);
      setPastedText('');
      setImportStatus(null);
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  const handleExecuteWipeDatabase = async () => {
    setIsWiping(true);
    setWipeError(null);
    try {
      await onClearDatabaseAndStartFresh();
      onClose();
    } catch {
      setWipeError('A limpeza ficou incompleta. Verifique a conexão e tente novamente.');
    } finally {
      setIsWiping(false);
      setConfirmStep(false);
    }
  };

  const totalDespesas = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const totalReceitas = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-sage-950/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-sage-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-sage-100 flex items-center justify-between bg-sage-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-pine-100 text-pine-700 flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-sage-800">
                Central de Planilhas & Base de Dados
              </h3>
              <p className="text-[11px] text-sage-500">
                Modo Híbrido: Agilidade no App + Integração com Google Sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-sage-400 hover:text-sage-600 rounded-xl hover:bg-sage-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-sage-100 px-4 bg-white text-xs font-semibold overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('hybrid')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'hybrid'
                ? 'border-pine-600 text-pine-600'
                : 'border-transparent text-sage-500 hover:text-sage-800'
            }`}
          >
            <Sparkles size={14} />
            Modo Híbrido (Google Sheets)
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'export'
                ? 'border-pine-600 text-pine-600'
                : 'border-transparent text-sage-500 hover:text-sage-800'
            }`}
          >
            <Download size={14} />
            Exportar CSV / Excel
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'import'
                ? 'border-pine-600 text-pine-600'
                : 'border-transparent text-sage-500 hover:text-sage-800'
            }`}
          >
            <Upload size={14} />
            Importar Planilha
          </button>

          <button
            onClick={() => setActiveTab('clean')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'clean'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-rose-500 hover:text-rose-700'
            }`}
          >
            <Trash2 size={14} />
            Começar do Zero
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* ============================================================== */}
          {/* TAB 1: MODO HÍBRIDO (GOOGLE SHEETS)                             */}
          {/* ============================================================== */}
          {activeTab === 'hybrid' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-pine-50 rounded-2xl border border-pine-100 text-xs text-pine-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-pine-900">
                  <Sparkles size={15} className="text-pine-600" />
                  Como funciona a Opção Híbrida (App + Planilha):
                </div>
                <p className="text-[11px] leading-relaxed text-pine-900/90">
                  Você lança compras rapidamente no app com 1 clique sem lentidão. Quando quiser analisar no computador, você pode <strong>gerar o espelho completo da planilha</strong> ou <strong>copiar todas as linhas</strong> diretamente para colar no seu Google Sheets no Google Drive!
                </p>
              </div>

              {/* Status do Espelho Atual */}
              <div className="p-3.5 bg-sage-50 rounded-2xl border border-sage-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-sage-700">Espelho Atual dos Dados:</span>
                  <span className="text-[11px] font-bold text-sage-500">
                    {transactions.length} lançamentos registrados
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2 bg-white rounded-xl border border-sage-200">
                    <span className="text-[10px] text-sage-400 block">Total Receitas</span>
                    <strong className="text-pine-600 tabular-nums text-xs">
                      +{formatCurrency(totalReceitas)}
                    </strong>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-sage-200">
                    <span className="text-[10px] text-sage-400 block">Total Despesas</span>
                    <strong className="text-rose-600 tabular-nums text-xs">
                      -{formatCurrency(totalDespesas)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Ações Rápidas de Sincronização com Google Sheets */}
              <div className="space-y-2">
                <button
                  onClick={handleCopyForGoogleSheets}
                  className="w-full py-2.5 px-3 bg-pine-600 hover:bg-pine-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  {copiedToClipboard ? (
                    <>
                      <Check size={16} />
                      Copiado! Basta dar Ctrl+V na sua Planilha Google
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copiar Dados para Colar no Google Sheets (Ctrl+C)
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="py-2.5 px-3 border border-sage-200 hover:bg-sage-50 text-sage-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Download size={14} />
                    Baixar Planilha (.csv)
                  </button>

                  <a
                    href="https://sheets.new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 border border-pine-200 bg-pine-50/50 hover:bg-pine-100 text-pine-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors text-center"
                  >
                    <ExternalLink size={14} />
                    Abrir Google Sheets
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: EXPORTAR CSV / EXCEL                                    */}
          {/* ============================================================== */}
          {activeTab === 'export' && (
            <div className="space-y-3">
              <p className="text-xs text-sage-600">
                Baixe o arquivo compatível com Excel, LibreOffice e Google Planilhas. O arquivo é gerado em UTF-8 com separador ponto-e-vírgula formatado para o padrão brasileiro de moedas (R$ 0,00).
              </p>
              <div className="p-3 bg-sage-50 rounded-xl border border-sage-200 text-xs tabular-nums space-y-1 text-sage-600">
                <p className="font-bold text-sage-800">Colunas incluídas:</p>
                <p className="text-[11px] text-sage-500">
                  Data | Mês Referência | Tipo | Descrição | Estabelecimento | Categoria | Valor | Forma Pagamento | Cartão | Parcela | Gasto Fixo
                </p>
              </div>
              <button
                onClick={handleExportCSV}
                className="w-full py-2.5 bg-sage-900 hover:bg-sage-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Download size={16} />
                Baixar Planilha Completa ({transactions.length} linhas)
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: IMPORTAR PLANILHA                                       */}
          {/* ============================================================== */}
          {activeTab === 'import' && (
            <div className="space-y-3">
              <p className="text-xs text-sage-600">
                Copie as linhas da sua planilha antiga (ou do extrato) e cole na caixa abaixo:
              </p>

              <textarea
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  setImportedPreview([]);
                  setImportStatus(null);
                }}
                disabled={isImporting}
                placeholder="Cole aqui linhas copiadas da sua planilha (ex: 2026-09-15 Aluguel Moradia 1500,00)..."
                rows={4}
                className="w-full p-2.5 border border-sage-200 rounded-xl text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-pine-600/20 focus:border-pine-600"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleParsePastedData}
                  disabled={!pastedText.trim()}
                  className="flex-1 py-2 bg-pine-600 hover:bg-pine-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
                >
                  Analisar Linhas Coladas
                </button>
                {onOpenImportCsvModal && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenImportCsvModal();
                    }}
                    className="py-2 px-3 border border-sage-200 text-sage-700 hover:bg-sage-50 rounded-xl text-xs font-semibold"
                  >
                    Importar Fatura XP (CSV)
                  </button>
                )}
              </div>

              {importStatus && (
                <div className="p-2.5 bg-sage-100 rounded-xl text-xs text-sage-700 flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-pine-600 shrink-0" />
                  <span>{importStatus}</span>
                </div>
              )}

              {importedPreview.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-sage-100">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Prévia ({importedPreview.length} lançamentos):</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] border border-sage-200 rounded-xl p-2 bg-sage-50">
                    {importedPreview.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex justify-between py-0.5">
                        <span className="truncate max-w-[200px]">
                          {item.date} - {item.description}
                        </span>
                        <strong className="tabular-nums">{formatCurrency(item.amount)}</strong>
                      </div>
                    ))}
                    {importedPreview.length > 5 && (
                      <p className="text-[10px] text-sage-400 text-center pt-1">
                        ...e mais {importedPreview.length - 5} lançamentos
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="w-full py-2 bg-pine-600 hover:bg-pine-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Check size={14} />
                    Confirmar e Importar {importedPreview.length} Lançamentos
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: LIMPAR BASE E COMEÇAR DO ZERO                            */}
          {/* ============================================================== */}
          {activeTab === 'clean' && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert size={18} className="text-rose-600 shrink-0" />
                  Zerar lançamentos e gastos fixos
                </div>

                <p className="text-xs text-rose-800 leading-relaxed">
                  Esta ação <strong>apaga permanentemente todos os lançamentos e gastos fixos</strong> da conta atual ou do modo local, conforme a sessão aberta.
                </p>

                <div className="p-2.5 bg-white/80 rounded-xl border border-rose-200 text-[11px] text-rose-900 space-y-1">
                  <p className="font-bold">O que acontece ao limpar:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-800">
                    <li>Extrato e Dashboard ficam zerados (saldo R$ 0,00).</li>
                    <li>
                      Categorias e cartões são mantidos.
                    </li>
                  </ul>
                </div>

                {wipeError && <p role="alert" className="text-xs text-rose-800">{wipeError}</p>}
                {!confirmStep ? (
                  <button
                    onClick={() => setConfirmStep(true)}
                    className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <Trash2 size={16} />
                    Zerar Tudo e Começar do Zero
                  </button>
                ) : (
                  <div className="p-3 bg-rose-100/80 rounded-xl border border-rose-300 space-y-2">
                    <p className="text-xs font-bold text-rose-950 text-center">
                      Tem certeza absoluta? Não há como desfazer esta limpeza.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmStep(false)}
                        disabled={isWiping}
                        className="flex-1 py-2 bg-white text-sage-700 border border-sage-300 rounded-xl text-xs font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleExecuteWipeDatabase}
                        disabled={isWiping}
                        className="flex-1 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {isWiping ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        Sim, Limpar Banco de Dados
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Botão secundário de restaurar padrões se desejar */}
              <div className="p-3 bg-sage-50 rounded-2xl border border-sage-200 text-xs space-y-2">
                <span className="font-bold text-sage-700 block">
                  Restaurar Categorias e Cartões Originais
                </span>
                <p className="text-[11px] text-sage-500">
                  Adiciona as categorias e os cartões padrão que estiverem faltando.
                </p>
                <button
                  onClick={() => {
                    if (confirm('Deseja restaurar as categorias e cartões padrão?')) {
                      onResetData();
                      onClose();
                    }
                  }}
                  className="py-1.5 px-3 border border-sage-300 text-sage-700 hover:bg-sage-100 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  Restaurar Padrões
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
