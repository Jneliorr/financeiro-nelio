# Nelio R$

Aplicativo de finanças pessoais com extrato, cartões, gastos fixos e importação de lançamentos. Funciona no navegador e no Android via Capacitor.

## Como usar

1. Na **Visão geral**, use **Configurar salário** para cadastrar o valor e o dia em que recebe.
2. Em **Nova conta**, cadastre aluguel, internet e outras despesas mensais. Para luz ou água, ative **Valor variável** e use uma estimativa. Ao receber a conta, abra o item do mês para informar o valor real e marcar como pago.
3. Use **Lançar compra** para registrar um gasto no cartão. O formulário mostra a fatura conforme a data da compra e o fechamento do cartão. Use **Compra parcelada** se precisar dividir o valor.

## Como os dados se organizam

Salário e contas mensais são regras de recorrência. O app combina as regras com os lançamentos salvos ao abrir um mês, sem duplicar valores já registrados. Ajustes do mês têm prioridade sobre a estimativa; alterações no cadastro base valem a partir do mês escolhido e mantêm as versões anteriores. Compras são lançamentos individuais e entram no resumo pelo mês da fatura. Uma conta recorrente lançada no cartão entra no total das faturas uma única vez.

## Desenvolvimento

Use Node.js 22 ou posterior. Rode `npm install` e `npm run dev`, depois abra `http://localhost:3000`. A porta pode ser alterada com `PORT` no arquivo `.env`.

```sh
npm run lint
npm test
npm run build
npm start
```

`npm start` serve a versão compilada. Para atualizar e abrir o projeto nativo, instale o Android Studio com o SDK 36 e execute `npm run build:android`.

## Dados e autenticação

O modo local guarda os lançamentos no navegador. Sessões autenticadas usam o Firestore da conta conectada. Para transferir lançamentos do modo local para uma conta, exporte-os como CSV antes de entrar e importe o conteúdo na conta desejada.

A configuração do Firebase está em `firebase-applet-config.json`. Ao usar outro projeto, configure os provedores de login, os domínios autorizados e o banco indicado em `firestoreDatabaseId`. Aplique `firestore.rules` nesse banco. Para login Google no Android, configure também o cliente OAuth em `capacitor.config.ts` e os certificados de assinatura do aplicativo no Firebase.
