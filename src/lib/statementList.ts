import type { Statement } from "../types/tiktok";
import { addMoney, parseMoney, ZERO, type Money } from "./money";
import {
  exportFileName,
  textCell,
  toCsv,
  toTsv,
  toXlsx,
  type ExportColumn,
} from "./spreadsheet";

/**
 * Leitura da lista de repasses (Get Statements).
 *
 * O PAPEL DESTA CONSULTA na aplicação é ser o ponto de partida das
 * finanças. As outras duas telas de repasse já exigem um código:
 * `/statements/{id}/statement_transactions` pede o ID do repasse, e sem
 * ele não há o que consultar. É aqui que esse ID nasce — a consulta é por
 * janela de datas, e cada linha traz o `id` que abre o extrato.
 *
 * Por isso a tela desta lista não é só uma tabela: ela monta, por linha, o
 * caminho da consulta de extrato daquele repasse, pronto para assinar.
 */

/** `payment_status` — situação da transferência ao vendedor. */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: "Pago",
  PROCESSING: "Em processamento",
  FAILED: "Falhou",
};

export function labelForPaymentStatus(status: string | undefined): string {
  if (status === undefined || status === "") return "—";
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

/** Cor do selo na tela, pela situação do pagamento. */
export function paymentStatusTone(status: string | undefined): "green" | "amber" | "red" | "gray" {
  switch (status) {
    case "PAID":
      return "green";
    case "PROCESSING":
      return "amber";
    case "FAILED":
      return "red";
    default:
      return "gray";
  }
}

/**
 * Soma dos repasses DESTA PÁGINA. A resposta não traz somatório nenhum —
 * diferente das transações a liquidar —, então todo total exibido é
 * calculado aqui e a tela precisa dizer que é da página.
 */
export interface StatementListTotals {
  settlement: Money;
  revenue: Money;
  fee: Money;
  adjustment: Money;
  shippingCost: Money;
  netSales: Money;
  /** Quantos repasses ainda não foram pagos (qualquer status != PAID). */
  pending: number;
}

export function statementListTotals(statements: Statement[]): StatementListTotals {
  const totals: StatementListTotals = {
    settlement: ZERO,
    revenue: ZERO,
    fee: ZERO,
    adjustment: ZERO,
    shippingCost: ZERO,
    netSales: ZERO,
    pending: 0,
  };

  for (const statement of statements) {
    totals.settlement = addMoney(totals.settlement, parseMoney(statement.settlement_amount));
    totals.revenue = addMoney(totals.revenue, parseMoney(statement.revenue_amount));
    totals.fee = addMoney(totals.fee, parseMoney(statement.fee_amount));
    totals.adjustment = addMoney(totals.adjustment, parseMoney(statement.adjustment_amount));
    totals.shippingCost = addMoney(totals.shippingCost, parseMoney(statement.shipping_cost_amount));
    totals.netSales = addMoney(totals.netSales, parseMoney(statement.net_sales_amount));
    if (statement.payment_status !== "PAID") totals.pending += 1;
  }

  return totals;
}

/**
 * Moeda da página. Como nas transações a liquidar, ela vem por linha e não
 * no cabeçalho; `undefined` quando a página mistura moedas, porque aí
 * somar deixa de fazer sentido.
 */
export function singleCurrency(statements: Statement[]): string | undefined {
  let found: string | undefined;

  for (const statement of statements) {
    const currency = statement.currency;
    if (currency === undefined || currency === "") continue;
    if (found === undefined) found = currency;
    else if (found !== currency) return undefined;
  }

  return found;
}

/* ------------------------------------------------------------------ */
/* Exportação                                                          */
/* ------------------------------------------------------------------ */

export const STATEMENT_LIST_COLUMNS: Array<ExportColumn<Statement>> = [
  { header: "ID do repasse", width: 22, cell: (s) => textCell(s.id) },
  { header: "Gerado em", width: 18, cell: (s) => ({ kind: "date", value: s.statement_time }) },
  {
    header: "Status do pagamento",
    width: 20,
    cell: (s) => textCell(labelForPaymentStatus(s.payment_status)),
  },
  { header: "Status (código)", width: 18, cell: (s) => textCell(s.payment_status) },
  { header: "Pago em", width: 18, cell: (s) => ({ kind: "date", value: s.payment_time }) },
  { header: "ID do pagamento", width: 22, cell: (s) => textCell(s.payment_id) },
  { header: "Moeda", width: 8, cell: (s) => textCell(s.currency) },
  {
    header: "Vendas líquidas",
    width: 18,
    cell: (s) => ({ kind: "money", value: parseMoney(s.net_sales_amount) }),
  },
  {
    header: "Receita",
    width: 16,
    cell: (s) => ({ kind: "money", value: parseMoney(s.revenue_amount) }),
  },
  {
    header: "Custo de frete",
    width: 16,
    cell: (s) => ({ kind: "money", value: parseMoney(s.shipping_cost_amount) }),
  },
  {
    header: "Tarifas",
    width: 16,
    cell: (s) => ({ kind: "money", value: parseMoney(s.fee_amount) }),
  },
  {
    header: "Ajustes",
    width: 16,
    cell: (s) => ({ kind: "money", value: parseMoney(s.adjustment_amount) }),
  },
  {
    header: "Valor transferido",
    width: 18,
    cell: (s) => ({ kind: "money", value: parseMoney(s.settlement_amount) }),
  },
];

export function statementListTsv(statements: Statement[]): string {
  return toTsv(STATEMENT_LIST_COLUMNS, statements);
}

export function statementListCsv(statements: Statement[]): string {
  return toCsv(STATEMENT_LIST_COLUMNS, statements);
}

export function statementListXlsx(statements: Statement[], modified?: Date): Uint8Array {
  return toXlsx(STATEMENT_LIST_COLUMNS, statements, "Repasses", modified);
}

export function statementListFileName(extension: "csv" | "xlsx", now?: Date): string {
  return exportFileName("repasses", extension, now);
}
