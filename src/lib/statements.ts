import type {
  FeeTaxBreakdown,
  StatementTransaction,
  StatementTransactionsData,
} from "../types/tiktok";
import { FEE_REFERENCE_FIELDS, labelForType } from "./statementLabels";
import {
  exportFileName,
  textCell,
  toCsv,
  toTsv,
  toXlsx,
  type ExportColumn,
} from "./spreadsheet";
import {
  addMoney,
  isZero,
  moneyEquals,
  moneyOrZero,
  parseMoney,
  roundToCents,
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
 * Separa de um detalhamento os campos que NÃO somam no total — os que
 * descrevem de outro ângulo uma linha que já está contada.
 *
 * Devolve dois objetos no mesmo formato da entrada, para que cada metade
 * passe por `nonZeroEntries`/`hiddenFieldCount` normalmente. Sem isso, a
 * soma das linhas exibidas fica maior que o total que a API declara, e a
 * tela parece errada quando quem duplica é a resposta.
 */
export function partitionFields(
  source: object | undefined,
  referenceFields: readonly string[],
): { main: Record<string, unknown>; reference: Record<string, unknown> } {
  const main: Record<string, unknown> = {};
  const reference: Record<string, unknown> = {};
  if (source === undefined) return { main, reference };

  for (const [field, value] of Object.entries(source)) {
    if (referenceFields.includes(field)) reference[field] = value;
    else main[field] = value;
  }

  return { main, reference };
}

/**
 * Compara a soma das linhas de um detalhamento com o total que a API
 * declara para aquele bloco.
 *
 * Esta conferência existe porque o total NEM SEMPRE é a soma do que vem
 * detalhado: há cobranças que entram em `est_fee_tax_amount` sem
 * aparecer em nenhum dos campos de `fee`/`tax`. Mostrar a diferença como
 * uma linha explícita é o que impede o usuário de somar as linhas na mão,
 * não bater com o repasse e não saber onde procurar.
 */
export interface BreakdownReconciliation {
  /** Soma das linhas que a API detalhou. */
  sum: Money;
  /** Total declarado pela API para o bloco. */
  total: Money;
  /** O que o total tem além das linhas detalhadas (total − soma). */
  undetailed: Money;
  matches: boolean;
}

export function reconcileBreakdown(
  entries: AmountEntry[],
  total: Money | undefined,
): BreakdownReconciliation | undefined {
  if (total === undefined) return undefined;

  const sum = addMoney(...entries.map((entry) => entry.value));
  const undetailed = subtractMoney(total, sum);

  return { sum, total, undetailed, matches: isZero(roundToCents(undetailed)) };
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

/* ------------------------------------------------------------------ */
/* Tarifas e impostos: o que a API detalha e o que ela não detalha     */
/* ------------------------------------------------------------------ */

/**
 * Confere o total de tarifas/impostos contra a soma das linhas de `fee` e
 * `tax`. Serve aos dois endpoints que devolvem esse bloco — o extrato
 * (`fee_tax_amount`) e as transações a liquidar (`est_fee_tax_amount`).
 *
 * POR QUE ISSO PRECISA APARECER NA TELA: as duas contas não fecham, e não
 * é erro de leitura. Em pedidos reais de uma loja BR observam-se duas
 * coisas ao mesmo tempo:
 *
 * 1. `affiliate_commission_before_pit_amount` repete o valor de
 *    `affiliate_commission_amount` (é a mesma comissão antes do IR do
 *    criador). Somar as duas conta a comissão em dobro — por isso os
 *    campos de `FEE_REFERENCE_FIELDS` ficam fora da soma.
 * 2. Mesmo descontando a duplicação, sobra um valor FIXO por pedido que o
 *    total inclui e que nenhum dos ~35 campos de `fee` reporta.
 *
 * Em vez de esconder a diferença, ela vira uma linha explícita. Somar as
 * linhas na mão e não bater com o repasse, sem saber onde procurar, é o
 * problema que esta função existe para evitar.
 */
export interface FeeTaxReading {
  /** Linhas que somam, de `fee` e `tax` juntas, maior impacto primeiro. */
  entries: AmountEntry[];
  /** Linhas que só detalham outra (comissão de afiliado antes do IR, IR retido). */
  reference: AmountEntry[];
  /** Soma × total declarado, com a diferença não detalhada. */
  reconciliation: BreakdownReconciliation | undefined;
  /** Campos de `fee` e `tax` omitidos por virem zerados ou vazios. */
  zeros: number;
}

export function readFeeTax(
  breakdown: FeeTaxBreakdown | undefined,
  total: Money | undefined,
  labelFor: (field: string) => string,
): FeeTaxReading {
  const { main, reference } = partitionFields(breakdown?.fee, FEE_REFERENCE_FIELDS);

  const entries = [
    ...nonZeroEntries(main, labelFor),
    ...nonZeroEntries(breakdown?.tax, labelFor),
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return {
    entries,
    reference: nonZeroEntries(reference, labelFor),
    reconciliation: reconcileBreakdown(entries, total),
    zeros: hiddenFieldCount(breakdown?.fee) + hiddenFieldCount(breakdown?.tax),
  };
}

/**
 * Quanto do total de tarifas/impostos a API não detalhou. Vai para a
 * exportação como coluna própria: é o valor que o financeiro procuraria
 * na mão ao reconstruir a taxa a partir das linhas e não chegar ao total.
 */
export function undetailedFeeTaxOf(
  breakdown: FeeTaxBreakdown | undefined,
  total: Money | undefined,
): Money | undefined {
  // O rótulo não importa para somar; só os valores entram na conta.
  return readFeeTax(breakdown, total, (field) => field).reconciliation?.undetailed;
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

/* ------------------------------------------------------------------ */
/* Exportação para planilha                                            */
/* ------------------------------------------------------------------ */

/**
 * Colunas da exportação do extrato, com cabeçalho em português. Mesma
 * ideia da tela de a liquidar: a maquinaria dos três formatos está em
 * spreadsheet.ts e aqui só se declara o que cada coluna é.
 *
 * A diferença em relação à outra tela está no que existe aqui e lá não:
 * reserva (retida/liberada) e valores já REALIZADOS, sem o prefixo de
 * estimativa — este repasse já foi fechado.
 */
export const STATEMENT_COLUMNS: Array<ExportColumn<StatementTransaction>> = [
  { header: "ID da transação", width: 22, cell: (tx) => textCell(tx.id) },
  { header: "Tipo", width: 26, cell: (tx) => textCell(labelForType(tx.type)) },
  { header: "Tipo (código)", width: 26, cell: (tx) => textCell(tx.type) },
  {
    header: "Pedido",
    width: 22,
    cell: (tx) => textCell(tx.order_id ?? tx.adjustment_order_id ?? tx.associated_order_id),
  },
  { header: "Ajuste", width: 22, cell: (tx) => textCell(tx.adjustment_id) },
  { header: "Criado em", width: 18, cell: (tx) => ({ kind: "date", value: tx.order_create_time }) },
  {
    header: "Receita",
    width: 16,
    cell: (tx) => ({ kind: "money", value: parseMoney(tx.revenue_amount) }),
  },
  {
    header: "Custo de frete",
    width: 16,
    cell: (tx) => ({ kind: "money", value: parseMoney(tx.shipping_cost_amount) }),
  },
  {
    header: "Tarifas e impostos",
    width: 20,
    cell: (tx) => ({ kind: "money", value: parseMoney(tx.fee_tax_amount) }),
  },
  {
    // A mesma diferença que a tela mostra no detalhamento: o total inclui
    // cobranças que nenhum campo de fee/tax reporta.
    header: "Tarifas sem detalhamento",
    width: 24,
    cell: (tx) => ({
      kind: "money",
      value: undetailedFeeTaxOf(tx.fee_tax_breakdown, parseMoney(tx.fee_tax_amount)),
    }),
  },
  {
    header: "Ajuste (valor)",
    width: 16,
    cell: (tx) => ({ kind: "money", value: parseMoney(tx.adjustment_amount) }),
  },
  {
    header: "Repasse",
    width: 16,
    cell: (tx) => ({ kind: "money", value: parseMoney(tx.settlement_amount) }),
  },
  { header: "ID da reserva", width: 22, cell: (tx) => textCell(tx.reserve_id) },
  {
    header: "Valor da reserva",
    width: 18,
    cell: (tx) => ({ kind: "money", value: parseMoney(tx.reserve_amount) }),
  },
  // Cru, como o badge da tela mostra: COLLECTED / RELEASED.
  { header: "Status da reserva", width: 18, cell: (tx) => textCell(tx.reserve_status) },
  {
    header: "Liberação prevista",
    width: 20,
    // Epoch em segundos, mas a API devolve como string neste campo.
    cell: (tx) => ({ kind: "date", value: Number(tx.estimated_release_time) || undefined }),
  },
];

export function transactionsTsv(transactions: StatementTransaction[]): string {
  return toTsv(STATEMENT_COLUMNS, transactions);
}

export function transactionsCsv(transactions: StatementTransaction[]): string {
  return toCsv(STATEMENT_COLUMNS, transactions);
}

export function transactionsXlsx(
  transactions: StatementTransaction[],
  modified?: Date,
): Uint8Array {
  return toXlsx(STATEMENT_COLUMNS, transactions, "Extrato", modified);
}

/** O ID do extrato entra no nome: é comum conferir vários lado a lado. */
export function statementFileName(
  statementId: string | undefined,
  extension: "csv" | "xlsx",
  now?: Date,
): string {
  const base = statementId === undefined || statementId === "" ? "extrato" : `extrato-${statementId}`;
  return exportFileName(base, extension, now);
}
