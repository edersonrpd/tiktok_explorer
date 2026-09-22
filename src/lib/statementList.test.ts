import { describe, expect, it } from "vitest";
import {
  labelForPaymentStatus,
  paymentStatusTone,
  singleCurrency,
  statementListCsv,
  statementListFileName,
  statementListTotals,
  statementListTsv,
  statementListXlsx,
} from "./statementList";
import { toDecimalString } from "./money";
import type { Statement } from "../types/tiktok";

const decimal = (value: number | undefined) =>
  value === undefined ? undefined : toDecimalString(value);

const REPASSES: Statement[] = [
  {
    id: "7238804564097517339",
    statement_time: 1685548800,
    payment_status: "PAID",
    payment_time: 1685635200,
    payment_id: "PAY-1",
    currency: "BRL",
    settlement_amount: "130",
    revenue_amount: "200",
    fee_amount: "-30",
    adjustment_amount: "-10",
    shipping_cost_amount: "-30",
    net_sales_amount: "190",
  },
  {
    id: "7238804564097517340",
    statement_time: 1686153600,
    payment_status: "PROCESSING",
    currency: "BRL",
    settlement_amount: "70",
    revenue_amount: "100",
    fee_amount: "-20",
    adjustment_amount: "0",
    shipping_cost_amount: "-10",
    net_sales_amount: "95",
  },
];

describe("labelForPaymentStatus", () => {
  it("traduz os status documentados", () => {
    expect(labelForPaymentStatus("PAID")).toBe("Pago");
    expect(labelForPaymentStatus("PROCESSING")).toBe("Em processamento");
    expect(labelForPaymentStatus("FAILED")).toBe("Falhou");
  });

  it("mostra o valor cru se a API trouxer um status novo, em vez de sumir", () => {
    expect(labelForPaymentStatus("ON_HOLD")).toBe("ON_HOLD");
  });

  it("distingue ausente de um status", () => {
    expect(labelForPaymentStatus(undefined)).toBe("—");
  });
});

describe("paymentStatusTone", () => {
  it("dá a cor pelo estado do dinheiro", () => {
    expect(paymentStatusTone("PAID")).toBe("green");
    expect(paymentStatusTone("PROCESSING")).toBe("amber");
    expect(paymentStatusTone("FAILED")).toBe("red");
    expect(paymentStatusTone(undefined)).toBe("gray");
  });
});

describe("statementListTotals", () => {
  it("soma a página, já que a resposta não traz somatório nenhum", () => {
    const totals = statementListTotals(REPASSES);
    expect(decimal(totals.settlement)).toBe("200.00");
    expect(decimal(totals.revenue)).toBe("300.00");
    expect(decimal(totals.fee)).toBe("-50.00");
    expect(decimal(totals.netSales)).toBe("285.00");
  });

  it("conta os repasses que ainda não foram pagos", () => {
    expect(statementListTotals(REPASSES).pending).toBe(1);
  });

  it("devolve zeros para a lista vazia, sem quebrar", () => {
    expect(decimal(statementListTotals([]).settlement)).toBe("0.00");
  });
});

describe("singleCurrency", () => {
  it("devolve a moeda quando todos os repasses concordam", () => {
    expect(singleCurrency(REPASSES)).toBe("BRL");
  });

  it("devolve undefined quando a página mistura moedas", () => {
    expect(singleCurrency([{ id: "1", currency: "BRL" }, { id: "2", currency: "USD" }])).toBeUndefined();
  });
});

describe("exportação dos repasses", () => {
  const readRow = (tsv: string) => {
    const [header, row] = tsv.split("\n");
    const columns = header?.split("\t") ?? [];
    const cells = row?.split("\t") ?? [];
    return (name: string) => cells[columns.indexOf(name)];
  };

  it("usa cabeçalho em português e traduz o status com o código ao lado", () => {
    const at = readRow(statementListTsv(REPASSES));
    expect(at("ID do repasse")).toBe("7238804564097517339");
    expect(at("Status do pagamento")).toBe("Pago");
    expect(at("Status (código)")).toBe("PAID");
    expect(at("Valor transferido")).toBe("130.00");
  });

  it("o CSV sai com vírgula decimal, para o Excel pt-BR", () => {
    const csv = statementListCsv(REPASSES);
    const columns = csv.split("\r\n")[0]?.split(";") ?? [];
    const cells = csv.split("\r\n")[1]?.split(";") ?? [];
    expect(cells[columns.indexOf("Valor transferido")]).toBe("130,00");
  });

  it("o xlsx sai como ZIP", () => {
    const bytes = statementListXlsx(REPASSES);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it("carimba a data no nome do arquivo", () => {
    expect(statementListFileName("xlsx", new Date(2026, 8, 22))).toBe("repasses-2026-09-22.xlsx");
  });
});
