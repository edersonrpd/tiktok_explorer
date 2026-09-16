import { describe, expect, it } from "vitest";
import {
  checkStatementFormulas,
  nonZeroEntries,
  totalsByType,
  transactionsTsv,
  hiddenFieldCount,
} from "./statements";
import { labelFrom } from "./statementLabels";
import { parseMoney, toDecimalString } from "./money";
import type { StatementTransaction, StatementTransactionsData } from "../types/tiktok";

/** Valor monetário como decimal legível — os totais são Money (escala 4). */
const decimal = (value: number | undefined) =>
  value === undefined ? undefined : toDecimalString(value);

describe("leitura dos valores do extrato", () => {
  it("lê positivos, negativos e zero via parseMoney", () => {
    expect(decimal(parseMoney("150"))).toBe("150.00");
    expect(decimal(parseMoney("-70.5"))).toBe("-70.50");
    expect(decimal(parseMoney("0"))).toBe("0.00");
  });

  it("tolera o espaço sobrando que a própria documentação mostra", () => {
    expect(decimal(parseMoney("0 "))).toBe("0.00");
  });

  it("distingue ausente/vazio (undefined) de zero", () => {
    expect(parseMoney(undefined)).toBeUndefined();
    expect(parseMoney("")).toBeUndefined();
    expect(parseMoney("   ")).toBeUndefined();
    expect(parseMoney("n/a")).toBeUndefined();
  });
});

describe("nonZeroEntries", () => {
  const label = labelFrom({ platform_commission_amount: "Comissão", vat_amount: "VAT" });

  it("omite zerados e ordena pelo maior impacto", () => {
    const entries = nonZeroEntries(
      { platform_commission_amount: "-20", vat_amount: "-35", transaction_fee_amount: "0" },
      label,
    );
    expect(entries.map((e) => e.field)).toEqual(["vat_amount", "platform_commission_amount"]);
  });

  it("cai no rótulo genérico quando não há tradução, em vez de sumir", () => {
    const entries = nonZeroEntries({ campo_novo_da_api: "5" }, label);
    expect(entries[0]?.label).toBe("Campo novo da api");
  });

  it("ignora objetos aninhados (ex.: supplementary_component)", () => {
    const entries = nonZeroEntries(
      { vat_amount: "10", supplementary_component: { a: "5" } },
      label,
    );
    expect(entries).toHaveLength(1);
  });

  it("devolve lista vazia quando o detalhamento não veio", () => {
    expect(nonZeroEntries(undefined, label)).toEqual([]);
  });
});

describe("hiddenFieldCount", () => {
  it("conta o que a lista escondeu: zerados e vazios", () => {
    expect(hiddenFieldCount({ a: "0", b: "0 ", c: "5", d: "" })).toBe(3);
  });

  it("não conta nada quando o detalhamento não veio", () => {
    expect(hiddenFieldCount(undefined)).toBe(0);
  });
});

describe("totalsByType", () => {
  const transactions: StatementTransaction[] = [
    { id: "1", type: "ORDER", settlement_amount: "130" },
    { id: "2", type: "ORDER", settlement_amount: "-20" },
    { id: "3", type: "RESERVE", reserve_amount: "100" },
    { id: "4", type: "PLATFORM_PENALTY", adjustment_amount: "-50" },
  ];

  it("agrupa por tipo somando repasse, ajuste e reserva", () => {
    const totals = totalsByType(transactions);
    expect(totals[0]?.type).toBe("ORDER");
    expect(totals[0]?.count).toBe(2);
    expect(decimal(totals[0]?.settlement)).toBe("110.00");
    expect(decimal(totals.find((t) => t.type === "RESERVE")?.reserve)).toBe("100.00");
    expect(decimal(totals.find((t) => t.type === "PLATFORM_PENALTY")?.adjustment)).toBe("-50.00");
  });

  it("não perde transações sem tipo", () => {
    expect(totalsByType([{ id: "1" }])[0]?.type).toBe("(sem tipo)");
  });
});

describe("checkStatementFormulas", () => {
  it("confirma as fórmulas quando os valores fecham", () => {
    // receita 200 − frete (−70) − taxas (−30) − ajustes 170 = 130
    const data: StatementTransactionsData = {
      total_settlement_amount: "130",
      total_reserve_amount: "20",
      payable_amount: "150",
      total_settlement_breakdown: {
        total_revenue_amount: "200",
        total_shipping_cost_amount: "-70",
        total_fee_tax_amount: "-30",
        total_adjustment_amount: "170",
      },
    };
    expect(checkStatementFormulas(data).every((c) => c.matches)).toBe(true);
  });

  it("aponta divergência entre o calculado e o retornado", () => {
    const data: StatementTransactionsData = {
      total_settlement_amount: "999",
      total_reserve_amount: "20",
      payable_amount: "150",
      total_settlement_breakdown: {
        total_revenue_amount: "200",
        total_shipping_cost_amount: "-70",
        total_fee_tax_amount: "-30",
        total_adjustment_amount: "170",
      },
    };
    const checks = checkStatementFormulas(data);
    expect(checks[0]?.matches).toBe(false);
    expect(decimal(checks[0]?.expected)).toBe("130.00");
    expect(decimal(checks[0]?.returned)).toBe("999.00");
  });

  it("tolera diferença abaixo de um centavo", () => {
    const data: StatementTransactionsData = {
      total_settlement_amount: "130.00",
      total_reserve_amount: "0",
      payable_amount: "130.00",
      total_settlement_breakdown: {
        total_revenue_amount: "130.009",
        total_shipping_cost_amount: "0",
        total_fee_tax_amount: "0",
        total_adjustment_amount: "0",
      },
    };
    expect(checkStatementFormulas(data).every((c) => c.matches)).toBe(true);
  });

  it("não inventa conferência quando o detalhamento não veio", () => {
    expect(checkStatementFormulas({})).toEqual([]);
  });
});

describe("transactionsTsv", () => {
  it("gera cabeçalho e uma linha por transação com os valores brutos", () => {
    const tsv = transactionsTsv([
      {
        id: "1636700041413599290",
        type: "ORDER",
        order_id: "576463220456522968",
        revenue_amount: "200",
        shipping_cost_amount: "-70",
        fee_tax_amount: "-30",
        settlement_amount: "130",
      },
    ]);
    const lines = tsv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]?.startsWith("transaction_id\ttype\torder_id")).toBe(true);
    expect(lines[1]?.split("\t")).toContain("576463220456522968");
    // Valor bruto, sem reformatação — é o que bate com a planilha.
    expect(lines[1]?.split("\t")[8]).toBe("130");
  });

  it("usa o pedido do ajuste ou da reserva quando não há order_id", () => {
    const tsv = transactionsTsv([
      { id: "1", type: "RESERVE", associated_order_id: "78217892102382101" },
    ]);
    expect(tsv.split("\n")[1]?.split("\t")[2]).toBe("78217892102382101");
  });
});
