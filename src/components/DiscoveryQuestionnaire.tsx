import React from 'react';
import { Sparkles, HelpCircle, CheckCircle2, ArrowRight, Lightbulb, Smartphone, ShieldCheck, Zap } from 'lucide-react';

interface DiscoveryQuestionnaireProps {
  onQuickAction?: (action: string) => void;
}

export const DiscoveryQuestionnaire: React.FC<DiscoveryQuestionnaireProps> = () => {
  const questions = [
    {
      id: 'q1',
      title: '1. Cartão de Crédito e Fatura',
      desc: 'Você costuma lançar as compras do cartão no dia da compra ou prefere ver o valor acumulado na fatura do mês?',
      options: ['Lançar na hora do gasto (no dia)', 'Controlar fechamento e vencimento da fatura', 'Ambos'],
      tag: 'Fluxo',
    },
    {
      id: 'q2',
      title: '2. Compras Parceladas',
      desc: 'Costuma fazer compras parceladas (ex: 10x de R$ 120)? Gostaria que o app criasse as parcelas automaticamente para os próximos meses?',
      options: ['Sim, com cálculo automático das parcelas', 'Não, lanço apenas compras à vista'],
      tag: 'Automação',
    },
    {
      id: 'q3',
      title: '3. Gastos Fixos e Recorrentes',
      desc: 'Tem contas fixas todo mês (Aluguel, Internet, Netflix, Academia)? Quer que elas apareçam automaticamente no início de cada mês?',
      options: ['Sim, repetir contas fixas todo mês', 'Prefiro lançar manualmente quando pagar'],
      tag: 'Praticidade',
    },
    {
      id: 'q4',
      title: '4. Metas de Gastos e Economia (Orçamento)',
      desc: 'Deseja definir um valor máximo para categorias específicas (ex: "Não gastar mais de R$ 400 em Lanches/iFood neste mês") e receber alertas?',
      options: ['Sim, quero teto de gastos por categoria', 'Apenas registrar para visualizar o extrato'],
      tag: 'Planejamento',
    },
    {
      id: 'q5',
      title: '5. Leitor de Notificações / IA / Comprovantes',
      desc: 'Gostaria de fotografar a notinha do supermercado ou colar o texto do Pix do banco para a IA preencher o valor e categoria automaticamente?',
      options: ['Seria ótimo (com IA / foto de comprovante)', 'Prefiro digitar rapidamente'],
      tag: 'Inovação',
    },
    {
      id: 'q6',
      title: '6. Sincronização e Backup',
      desc: 'Hoje seus dados ficam salvos localmente e você pode exportar para o Excel a qualquer momento. Quer login com Google / nuvem para usar em mais de um celular?',
      options: ['Acesso na nuvem / sincronizado', 'Apenas no meu aparelho com exportação Excel'],
      tag: 'Nuvem',
    },
  ];

  const ideas = [
    {
      title: '🚀 Atalho Rápido na Tela Inicial do Celular (PWA/Android)',
      desc: 'Você pode instalar este app direto na tela inicial do seu Android pelo menu do navegador (Adicionar à Tela Principal) para abrir como um app nativo em 1 segundo.',
    },
    {
      title: '📊 Comparativo Mês a Mês',
      desc: 'Saber instantaneamente se você gastou mais ou menos em Alimentação/Mercado em relação ao mês anterior.',
    },
    {
      title: '💳 Extrato do Cartão vs. Dinheiro em Conta',
      desc: 'Saber quanto você já comprometeu da fatura do mês que vem para não ter surpresas na data de vencimento.',
    },
    {
      title: '🎯 Balanço Diário Seguro',
      desc: 'Cálculo de "Quanto posso gastar por dia até o fim do mês" baseado na sua renda e nos gastos já feitos.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="p-4.5 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl shadow-md space-y-2">
        <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
          <Sparkles size={16} />
          Evolução & Ideias para seu App
        </div>
        <h3 className="text-base font-extrabold leading-snug">
          O que mais podemos construir para substituir 100% sua planilha?
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          Pensamos nas necessidades mais comuns de quem migra do Excel para um app mobile ágil. Veja as perguntas estratégicas e as funcionalidades que podemos ativar a seguir:
        </p>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <HelpCircle size={15} className="text-blue-600" />
          Perguntas para Personalizar seu App:
        </h4>

        {questions.map((q) => (
          <div
            key={q.id}
            className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">{q.title}</span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                {q.tag}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{q.desc}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {q.options.map((opt, i) => (
                <div
                  key={i}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                  {opt}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Future Ideas */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <Lightbulb size={15} className="text-amber-500" />
          Outras ideias de recursos que podemos adicionar:
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {ideas.map((item, idx) => (
            <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <h5 className="text-xs font-bold text-slate-800">{item.title}</h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
