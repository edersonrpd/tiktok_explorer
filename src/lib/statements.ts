import type { StatementTransaction, StatementTransactionsData } from "../types/tiktok";
import {
  addMoney,
  isZero,
  moneyEquals,
  moneyOrZero,
  parseMoney,
  subtractMoney,
  ZERO,
  type Money,
} from "./money";

/**
 * Leitura do extrato de repasses (Get Transactions by Statement).
 *
 * DOIS PROBLEMAS PRÁTICOS QUE ESTE MÓDULO RESOLVE:
 *
 * 1. Todo valor monetário vem como STRING — inclusive negativos, zeros e,
 *    no exemplo da própria documentação, com espaço sobrando ("0 ").
 *    Somar com `Number` acumularia erro binário e o total deixaria de
 *    bater por centavos, justamente a conferência que a tela existe para
 *    fazer, então tudo passa por `money.ts` (inteiros em escala 4).
 *
 * 2. O detalhamento tem cerca de 70 campos (taxas de programas, impostos
 *    de mercados específicos), e num extrato brasileiro quase todos vêm
 *    "0". Exibir a lista inteira esconde justamente as poucas linhas que
 *    importam, então `nonZeroEntries` filtra o que é diferente de zero.
 */

/** Uma linha do detalhamento, já convertida e rotulada. */
export interface AmountEntry {
  field: string;
  label: string;
  value: Money;
  /** Valor bruto, como veio da API (é ele que reconcilia com a planilha). */
  raw: string;
}

/**
 * Entradas com valor diferente de zero, em ordem decrescente de impacto
 * (maior valor absoluto primeiro). Campos ausentes, ilegíveis ou zerados
 * somem. `labelFor` traduz o nome técnico do campo.
 */
export function nonZeroEntries(
  // `object` e não `Record<string, unknown>`: as interfaces do
  // detalhamento não têm index signature, então só esta forma aceita
  // passá-las direto, sem cast.
  source: object | undefined,
  labelFor: (field: string) => string,
): AmountEntry[] {
  if (source === undefined) return [];

  const entries: AmountEntry[] = [];
  for (const [field, raw] of Object.entries(source)) {
    if (typeof raw !== "string") continue; // ignora objetos aninhados
    const value = parseMoney(raw);
    if (value === undefined || isZero(value)) continue;
    entries.push({ field, label: labelFor(field), value, raw: raw.trim() });
  }

  return entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/**
 * Quantos campos do detalhamento `nonZeroEntries` escondeu — zerados ou
 * vazios. Serve para a tela dizer o que deixou de fora, em vez de o
 * usuário se perguntar se o campo existe e sumiu.
 */
export function hiddenFieldCount(source: object | undefined): number {
  if (source === undefined) return 0;
  return Object.values(source).filter(
    (raw) => typeof raw === "string" && isZero(parseMoney(raw)),
  ).length;
}

/** Totais por tipo de transação — a visão que responde "no que foi o desconto". */
export interface TypeTotal {
  type: string;
  count: number;
  settlement: Money;
  adjustment: Money;
  reserve: Money;
}

export function totalsByType(transactions: StatementTransaction[]): TypeTotal[] {
  const totals = new Map<string, TypeTotal>();

  for (const tx of transactions) {
    const type = tx.type ?? "(sem tipo)";
    const current = totals.get(type) ?? {
      type,
      count: 0,
      settlement: ZERO,
      adjustment: ZERO,
      reserve: ZERO,
    };
    current.count += 1;
    current.settlement = addMoney(current.settlement, parseMoney(tx.settlement_amount));
    current.adjustment = addMoney(current.adjustment, parseMoney(tx.adjustment_amount));
    current.reserve = addMoney(current.reserve, parseMoney(tx.reserve_amount));
    totals.set(type, current);
  }

  return [...totals.values()].sort((a, b) => b.count - a.count);
}

/**
 * Conferência das fórmulas publicadas na documentação, aplicada aos
 * valores desta resposta:
 *
 *   total_settlement = total_revenue - total_shipping - total_fee_tax - total_adjustment
 *   payable          = total_settlement + total_reserve
 *
 * Divergência aqui não é necessariamente erro — pode ser um campo que a
 * API não preencheu para o mercado da loja —, mas é exatamente o ponto
 * onde vale abrir o JSON bruto antes de lançar o valor na contabilidade.
 */
export interface FormulaCheck {
  label: string;
  expected: Money;
  returned: Money | undefined;
  matches: boolean;
}

export function checkStatementFormulas(data: StatementTransactionsData): FormulaCheck[] {
  const breakdown = data.total_settlement_breakdown;
  const settlement = parseMoney(data.total_settlement_amount);
  const reserve = parseMoney(data.total_reserve_amount);
  const payable = parseMoney(data.payable_amount);

  const checks: FormulaCheck[] = [];

  if (breakdown !== undefined) {
    const expected = subtractMoney(
      moneyOrZero(breakdown.total_revenue_amount),
      moneyOrZero(breakdown.total_shipping_cost_amount),
      moneyOrZero(breakdown.total_fee_tax_amount),
      moneyOrZero(breakdown.total_adjustment_amount),
    );
    checks.push({
      label: "receita − frete − taxas/impostos − ajustes = total repassado",
      expected,
      returned: settlement,
      matches: settlement !== undefined && moneyEquals(expected, settlement),
    });
  }

  if (settlement !== undefined && reserve !== undefined) {
    const expected = addMoney(settlement, reserve);
    checks.push({
      label: "total repassado + reserva = valor a pagar",
      expected,
      returned: payable,
      matches: payable !== undefined && moneyEquals(expected, payable),
    });
  }

  return checks;
}

/**
 * Uma linha por transação, separada por TAB, para colar direto numa
 * planilha e reconciliar com o ERP — o mesmo papel do botão que copia a
 * coluna `seller_sku` na tela de pedidos.
 */
export function transactionsTsv(transactions: StatementTransaction[]): string {
  const header = [
    "transaction_id",
    "type",
    "order_id",
    "order_create_time",
    "revenue",
    "shipping_cost",
    "fee_tax",
    "adjustment",
    "settlement",
    "reserve",
  ].join("\t");

  const rows = transactions.map((tx) =>
    [
      tx.id,
      tx.type ?? "",
      tx.order_id ?? tx.adjustment_order_id ?? tx.associated_order_id ?? "",
      tx.order_create_time !== undefined ? new Date(tx.order_create_time * 1000).toISOString() : "",
      // Valor bruto: é ele que bate com a planilha, sem reformatação.
      tx.revenue_amount ?? "",
      tx.shipping_cost_amount ?? "",
      tx.fee_tax_amount ?? "",
      tx.adjustment_amount ?? "",
      tx.settlement_amount ?? "",
      tx.reserve_amount ?? "",
    ].join("\t"),
  );

  return [header, ...rows].join("\n");
}
