import type {
  FeeTaxBreakdown,
  StatementTransaction,
  StatementTransactionsData,
} from "../types/tiktok";

/**
 * Leitura do extrato de repasses (Get Transactions by Statement).
 *
 * DOIS PROBLEMAS PRÁTICOS QUE ESTE MÓDULO RESOLVE:
 *
 * 1. Todo valor monetário vem como STRING — inclusive negativos, zeros e,
 *    no exemplo da própria documentação, com espaço sobrando ("0 ").
 *    Somar isso direto em JavaScript concatena texto, então toda leitura
 *    passa por `parseAmount`, que devolve `null` quando não há valor.
 *
 * 2. O detalhamento tem cerca de 70 campos (taxas de programas, impostos
 *    de mercados específicos), e num extrato brasileiro quase todos vêm
 *    "0". Exibir a lista inteira esconde justamente as poucas linhas que
 *    importam, então `nonZeroEntries` filtra o que é diferente de zero.
 */

/** Rótulo em português para um campo do detalhamento. */
export interface AmountEntry {
  field: string;
  label: string;
  value: number;
  /** Valor bruto, como veio da API (é ele que reconcilia com a planilha). */
  raw: string;
}

/**
 * Converte o valor da API em número. Aceita espaços em volta e devolve
 * `null` para ausente/vazio/ilegível — `null` é "não veio", diferente de
 * zero, que é "veio e é zero".
 */
export function parseAmount(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Soma tratando ausentes como zero. */
export function sumAmounts(values: Array<string | undefined>): number {
  return values.reduce<number>((total, value) => total + (parseAmount(value) ?? 0), 0);
}

/**
 * Entradas com valor diferente de zero, em ordem decrescente de impacto
 * (maior valor absoluto primeiro). Campos sem valor ou zerados somem.
 */
export function nonZeroEntries(
  // `object` e não `Record<string, unknown>`: as interfaces do
  // detalhamento não têm index signature, então só esta forma aceita
  // passá-las direto, sem cast.
  source: object | undefined,
  labels: Record<string, string>,
): AmountEntry[] {
  if (source === undefined) return [];

  const entries: AmountEntry[] = [];
  for (const [field, raw] of Object.entries(source)) {
    if (typeof raw !== "string") continue; // ignora objetos aninhados
    const value = parseAmount(raw);
    if (value === null || value === 0) continue;
    entries.push({ field, label: labels[field] ?? field, value, raw: raw.trim() });
  }

  return entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/** Quantos campos do detalhamento vieram zerados (contexto do filtro acima). */
export function zeroFieldCount(source: object | undefined): number {
  if (source === undefined) return 0;
  return Object.values(source).filter((raw) => typeof raw === "string" && parseAmount(raw) === 0)
    .length;
}

/** Junta taxas e impostos numa lista só, marcando de onde cada uma veio. */
export function feeTaxEntries(
  breakdown: FeeTaxBreakdown | undefined,
  labels: Record<string, string>,
): { fees: AmountEntry[]; taxes: AmountEntry[] } {
  return {
    fees: nonZeroEntries(breakdown?.fee, labels),
    taxes: nonZeroEntries(breakdown?.tax, labels),
  };
}

/** Totais por tipo de transação — a visão que responde "no que foi o desconto". */
export interface TypeTotal {
  type: string;
  count: number;
  settlement: number;
  adjustment: number;
  reserve: number;
}

export function totalsByType(transactions: StatementTransaction[]): TypeTotal[] {
  const totals = new Map<string, TypeTotal>();

  for (const tx of transactions) {
    const type = tx.type ?? "(sem tipo)";
    const current = totals.get(type) ?? {
      type,
      count: 0,
      settlement: 0,
      adjustment: 0,
      reserve: 0,
    };
    current.count += 1;
    current.settlement += parseAmount(tx.settlement_amount) ?? 0;
    current.adjustment += parseAmount(tx.adjustment_amount) ?? 0;
    current.reserve += parseAmount(tx.reserve_amount) ?? 0;
    totals.set(type, current);
  }

  return [...totals.values()].sort((a, b) => b.count - a.count);
}

/**
 * Conferência das fórmulas publicadas na documentação, aplicada aos
 * valores desta página:
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
  expected: number;
  returned: number | null;
  matches: boolean;
}

/** Diferença tolerada por arredondamento de centavos. */
const TOLERANCE = 0.01;

export function checkStatementFormulas(data: StatementTransactionsData): FormulaCheck[] {
  const breakdown = data.total_settlement_breakdown;
  const settlement = parseAmount(data.total_settlement_amount);
  const reserve = parseAmount(data.total_reserve_amount);
  const payable = parseAmount(data.payable_amount);

  const checks: FormulaCheck[] = [];

  if (breakdown !== undefined) {
    const expected =
      (parseAmount(breakdown.total_revenue_amount) ?? 0) -
      (parseAmount(breakdown.total_shipping_cost_amount) ?? 0) -
      (parseAmount(breakdown.total_fee_tax_amount) ?? 0) -
      (parseAmount(breakdown.total_adjustment_amount) ?? 0);
    checks.push({
      label: "receita − frete − taxas/impostos − ajustes = total repassado",
      expected,
      returned: settlement,
      matches: settlement !== null && Math.abs(expected - settlement) <= TOLERANCE,
    });
  }

  if (settlement !== null && reserve !== null) {
    const expected = settlement + reserve;
    checks.push({
      label: "total repassado + reserva = valor a pagar",
      expected,
      returned: payable,
      matches: payable !== null && Math.abs(expected - payable) <= TOLERANCE,
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
