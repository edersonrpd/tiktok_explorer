import type { UnsettledTransaction, UnsettledTransactionsData } from "../types/tiktok";
import { addMoney, moneyEquals, moneyOrZero, parseMoney, subtractMoney, ZERO, type Money } from "./money";

/**
 * Leitura de Get Unsettled Transactions (/finance/202507/orders/unsettled).
 *
 * O QUE MUDA EM RELAÇÃO AO EXTRATO, e por que este módulo existe separado
 * de `statements.ts`:
 *
 * 1. TUDO É ESTIMATIVA. Os campos têm prefixo `est_` porque o repasse
 *    ainda não foi fechado; o frete, em especial, só é conhecido depois da
 *    entrega. Um número daqui não pode ser lançado como realizado — daí a
 *    tela insistir nessa distinção.
 *
 * 2. OS SOMATÓRIOS DO CABEÇALHO SÃO DO CONJUNTO INTEIRO, não da página, e
 *    a resposta não traz somatório de frete. Comparar os quatro
 *    somatórios com a soma das transações exibidas só faz sentido quando a
 *    página é o conjunto inteiro — `canCompareSums` é quem decide isso, e
 *    sem ele a tela acusaria divergência em toda consulta paginada.
 *
 * 3. `estimated_settlement` NÃO É UM NÚMERO. Enquanto o pedido não é
 *    entregue, a API devolve o texto da política ("15 days after
 *    delivery"); depois passa a devolver um epoch. Tratar o campo como
 *    data quebraria a exibição justamente no caso mais comum desta
 *    consulta, que é o pedido ainda não entregue.
 *
 * A aritmética é a mesma do resto do app: inteiros em escala 4
 * (`money.ts`), nunca `Number` direto sobre os decimais em string.
 */

/* ------------------------------------------------------------------ */
/* estimated_settlement: data OU política                              */
/* ------------------------------------------------------------------ */

export type EstimatedSettlement =
  /** A API já calculou a data: o pedido foi entregue. */
  | { kind: "date"; epoch: number }
  /** Política textual ("x days after delivery"): ainda não entregue. */
  | { kind: "policy"; text: string };

/**
 * Interpreta `estimated_settlement`. Devolve `undefined` quando o campo
 * veio ausente ou vazio — o que é diferente de "vem como texto".
 *
 * Só dígitos vira data (epoch em SEGUNDOS, como no exemplo da
 * documentação); qualquer outra coisa é devolvida como política, sem
 * tentar adivinhar quantos dias são. Traduzir o texto seria chutar: a
 * documentação não fixa o formato dessa frase.
 */
export function parseEstimatedSettlement(
  raw: string | undefined,
): EstimatedSettlement | undefined {
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (value === "") return undefined;

  if (/^\d+$/.test(value)) {
    const epoch = Number(value);
    if (epoch > 0) return { kind: "date", epoch };
  }

  return { kind: "policy", text: value };
}

/**
 * Um pedido entregue é o que já tem frete real e data de liquidação
 * calculada; sem entrega, `est_shipping_cost_amount` é incompleto por
 * definição. A tela usa isso para marcar quais linhas ainda vão mudar.
 */
export function isDelivered(tx: UnsettledTransaction): boolean {
  return tx.order_delivery_time !== undefined && tx.order_delivery_time > 0;
}

/* ------------------------------------------------------------------ */
/* Conferência da fórmula, por transação                               */
/* ------------------------------------------------------------------ */

export interface FormulaCheck {
  expected: Money;
  returned: Money;
  matches: boolean;
}

/**
 * Confere, em UMA transação, a fórmula publicada para
 * `est_settlement_amount`:
 *
 *   est_settlement = est_revenue − est_shipping_cost − est_fee_tax − est_adjustment
 *
 * Os custos já chegam NEGATIVOS da API (frete "-70", taxas "-30"), então
 * a subtração soma — é assim que o exemplo da documentação fecha:
 * 200 − (−70) − (−30) − 170 = 130.
 *
 * Devolve `undefined` quando a transação não trouxe
 * `est_settlement_amount`: sem o valor retornado não há o que conferir, e
 * inventar zero acusaria divergência onde só há campo ausente.
 */
export function checkTransactionFormula(tx: UnsettledTransaction): FormulaCheck | undefined {
  const returned = parseMoney(tx.est_settlement_amount);
  if (returned === undefined) return undefined;

  const expected = subtractMoney(
    moneyOrZero(tx.est_revenue_amount),
    moneyOrZero(tx.est_shipping_cost_amount),
    moneyOrZero(tx.est_fee_tax_amount),
    moneyOrZero(tx.est_adjustment_amount),
  );

  return { expected, returned, matches: moneyEquals(expected, returned) };
}

export interface FormulaSummary {
  /** Transações em que a fórmula pôde ser conferida. */
  checked: number;
  /** Quantas fecharam. */
  matching: number;
  /** As que não fecharam, para a tela apontar quais são. */
  diverging: Array<{ tx: UnsettledTransaction; check: FormulaCheck }>;
}

export function summarizeFormulas(transactions: UnsettledTransaction[]): FormulaSummary {
  const summary: FormulaSummary = { checked: 0, matching: 0, diverging: [] };

  for (const tx of transactions) {
    const check = checkTransactionFormula(tx);
    if (check === undefined) continue;
    summary.checked += 1;
    if (check.matches) summary.matching += 1;
    else summary.diverging.push({ tx, check });
  }

  return summary;
}

/* ------------------------------------------------------------------ */
/* Somas da página × somatórios do cabeçalho                           */
/* ------------------------------------------------------------------ */

export interface PageSums {
  revenue: Money;
  shipping: Money;
  feeTax: Money;
  adjustment: Money;
  settlement: Money;
}

/** Soma, nesta página, cada um dos cinco valores estimados. */
export function pageSums(transactions: UnsettledTransaction[]): PageSums {
  const sums: PageSums = {
    revenue: ZERO,
    shipping: ZERO,
    feeTax: ZERO,
    adjustment: ZERO,
    settlement: ZERO,
  };

  for (const tx of transactions) {
    sums.revenue = addMoney(sums.revenue, parseMoney(tx.est_revenue_amount));
    sums.shipping = addMoney(sums.shipping, parseMoney(tx.est_shipping_cost_amount));
    sums.feeTax = addMoney(sums.feeTax, parseMoney(tx.est_fee_tax_amount));
    sums.adjustment = addMoney(sums.adjustment, parseMoney(tx.est_adjustment_amount));
    sums.settlement = addMoney(sums.settlement, parseMoney(tx.est_settlement_amount));
  }

  return sums;
}

/**
 * Os somatórios do cabeçalho valem para o conjunto filtrado INTEIRO,
 * enquanto `transactions` é só a página. Compará-los sem esta checagem
 * acusaria divergência em toda consulta que tenha mais de uma página —
 * um alarme falso pior do que não conferir.
 *
 * Só há o que comparar quando esta página é o conjunto inteiro: sem
 * `next_page_token` e com `total_count` batendo com o que veio.
 */
export function canCompareSums(
  data: UnsettledTransactionsData,
  transactions: UnsettledTransaction[],
): boolean {
  const token = data.next_page_token ?? "";
  if (token !== "") return false;
  if (data.total_count === undefined) return false;
  return data.total_count === transactions.length;
}

export interface SumCheck {
  field: keyof UnsettledTransactionsData;
  label: string;
  /** Somatório declarado no cabeçalho. */
  returned: Money | undefined;
  /** Soma das transações desta página. */
  fromPage: Money;
  matches: boolean;
}

/**
 * Confere os somatórios do cabeçalho contra a soma das transações.
 * Chame apenas quando `canCompareSums` for verdadeiro.
 *
 * `sum_est_fee_amount` é o somatório de taxas/impostos: a resposta NÃO
 * traz somatório de frete, então o custo de frete não tem contraparte no
 * cabeçalho para ser conferido — ele aparece na tela somado da página e
 * marcado como tal.
 */
export function checkSums(
  data: UnsettledTransactionsData,
  transactions: UnsettledTransaction[],
): SumCheck[] {
  const sums = pageSums(transactions);

  const pairs: Array<[keyof UnsettledTransactionsData, string, Money]> = [
    ["sum_est_revenue_amount", "Receita estimada", sums.revenue],
    ["sum_est_fee_amount", "Taxas e impostos estimados", sums.feeTax],
    ["sum_est_adjustment_amount", "Ajustes estimados", sums.adjustment],
    ["sum_est_settlement_amount", "Repasse estimado", sums.settlement],
  ];

  return pairs.map(([field, label, fromPage]) => {
    const returned = parseMoney(data[field] as string | undefined);
    return {
      field,
      label,
      returned,
      fromPage,
      matches: returned !== undefined && moneyEquals(returned, fromPage),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Totais por tipo                                                     */
/* ------------------------------------------------------------------ */

export interface UnsettledTypeTotal {
  type: string;
  count: number;
  settlement: Money;
  revenue: Money;
  adjustment: Money;
}

/** Agrupa a página por `type` — separa pedidos dos ajustes da plataforma. */
export function unsettledTotalsByType(
  transactions: UnsettledTransaction[],
): UnsettledTypeTotal[] {
  const totals = new Map<string, UnsettledTypeTotal>();

  for (const tx of transactions) {
    const type = tx.type ?? "(sem tipo)";
    const current = totals.get(type) ?? {
      type,
      count: 0,
      settlement: ZERO,
      revenue: ZERO,
      adjustment: ZERO,
    };
    current.count += 1;
    current.settlement = addMoney(current.settlement, parseMoney(tx.est_settlement_amount));
    current.revenue = addMoney(current.revenue, parseMoney(tx.est_revenue_amount));
    current.adjustment = addMoney(current.adjustment, parseMoney(tx.est_adjustment_amount));
    totals.set(type, current);
  }

  return [...totals.values()].sort((a, b) => b.count - a.count);
}

/**
 * Moeda da resposta. Aqui ela vem POR TRANSAÇÃO, não no cabeçalho como no
 * extrato — a tela precisa de uma para formatar os somatórios. Devolve a
 * moeda quando todas as transações concordam; `undefined` se a página
 * misturar moedas (aí somar já não faria sentido) ou se nenhuma informar.
 */
export function singleCurrency(transactions: UnsettledTransaction[]): string | undefined {
  let found: string | undefined;

  for (const tx of transactions) {
    const currency = tx.currency;
    if (currency === undefined || currency === "") continue;
    if (found === undefined) found = currency;
    else if (found !== currency) return undefined;
  }

  return found;
}

/* ------------------------------------------------------------------ */
/* Exportação para planilha                                            */
/* ------------------------------------------------------------------ */

/**
 * Uma linha por transação, separada por TAB, com os valores BRUTOS — é
 * assim que o financeiro reconcilia no Excel, sem reformatação pelo meio.
 */
export function unsettledTsv(transactions: UnsettledTransaction[]): string {
  const header = [
    "transaction_id",
    "type",
    "status",
    "currency",
    "order_id",
    "adjustment_id",
    "order_create_time",
    "order_delivery_time",
    "estimated_settlement",
    "unsettled_reason",
    "est_revenue",
    "est_shipping_cost",
    "est_fee_tax",
    "est_adjustment",
    "est_settlement",
  ].join("\t");

  const rows = transactions.map((tx) =>
    [
      tx.id,
      tx.type ?? "",
      tx.status ?? "",
      tx.currency ?? "",
      tx.order_id ?? tx.adjustment_order_id ?? "",
      tx.adjustment_id ?? "",
      isoOrEmpty(tx.order_create_time),
      isoOrEmpty(tx.order_delivery_time),
      // Sai como veio: pode ser epoch ou a frase da política, e é a string
      // original que explica por que o valor ainda não é definitivo.
      tx.estimated_settlement ?? "",
      // O motivo é texto livre da API e pode conter TAB/quebra de linha,
      // que arrebentariam a coluna na planilha.
      (tx.unsettled_reason ?? "").replace(/\s+/g, " ").trim(),
      tx.est_revenue_amount ?? "",
      tx.est_shipping_cost_amount ?? "",
      tx.est_fee_tax_amount ?? "",
      tx.est_adjustment_amount ?? "",
      tx.est_settlement_amount ?? "",
    ].join("\t"),
  );

  return [header, ...rows].join("\n");
}

function isoOrEmpty(epochSeconds: number | undefined): string {
  if (epochSeconds === undefined || epochSeconds <= 0) return "";
  return new Date(epochSeconds * 1000).toISOString();
}
