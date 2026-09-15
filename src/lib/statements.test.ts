import { describe, expect, it } from "vitest";
import {
  checkStatementFormulas,
  nonZeroEntries,
  parseAmount,
  sumAmounts,
  totalsByType,
  transactionsTsv,
  zeroFieldCount,
} from "./statements";
import type { StatementTransaction, StatementTransactionsData } from "../types/tiktok";

describe("parseAmount", () => {
  it("lê valores positivos, negativos e zero", () => {
    expect(parseAmount("150")).toBe(150);
    expect(parseAmount("-70.5")).toBe(-70.5);
    expect(parseAmount("0")).toBe(0);
  });

  it("tolera o espaço sobrando que a própria documentação mostra", () => {
    expect(parseAmount("0 ")).toBe(0);
  });

  it("distingue ausente/vazio (null) de zero", () => {
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
  });
});

describe("sumAmounts", () => {
  it("soma como número, não concatena string", () => {
    expect(sumAmounts(["10", "20", "-5"])).toBe(25);
  });

  it("trata ausentes como zero", () => {
    expect(sumAmounts(["10", undefined, ""])).toBe(10);
  });
});

describe("nonZeroEntries", () => {
  const labels = { platform_commission_amount: "Comissão", vat_amount: "VAT" };

  it("omite zerados e ordena pelo maior impacto", () => {
    const entries = nonZeroEntries(
      { platform_commission_amount: "-20", vat_amount: "-35", transaction_fee_amount: "0" },
      labels,
    );
    expect(entries.map((e) => e.field)).toEqual(["vat_amount", "platform_commission_amount"]);
  });

  it("mostra o nome original quando não há tradução", () => {
    const entries = nonZeroEntries({ campo_novo_da_api: "5" }, labels);
    expect(entries[0]?.label).toBe("campo_novo_da_api");
  });

  it("ignora objetos aninhados (ex.: supplementary_component)", () => {
    const entries = nonZeroEntries(
      { vat_amount: "10", supplementary_component: { a: "5" } },
      labels,
    );
    expect(entries).toHaveLength(1);
  });

  it("devolve lista vazia quando o detalhamento não veio", () => {
    expect(nonZeroEntries(undefined, labels)).toEqual([]);
  });
});

describe("zeroFieldCount", () => {
  it("conta quantos campos vieram zerados", () => {
    expect(zeroFieldCount({ a: "0", b: "0 ", c: "5", d: "" })).toBe(2);
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
    expect(totals[0]).toEqual({
      type: "ORDER",
      count: 2,
      settlement: 110,
      adjustment: 0,
      reserve: 0,
    });
    expect(totals.find((t) => t.type === "RESERVE")?.reserve).toBe(100);
    expect(totals.find((t) => t.type === "PLATFORM_PENALTY")?.adjustment).toBe(-50);
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
    expect(checks[0]?.expected).toBe(130);
    expect(checks[0]?.returned).toBe(999);
  });

  it("tolera diferença de arredondamento de um centavo", () => {
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
