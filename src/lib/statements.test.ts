import { describe, expect, it } from "vitest";
import {
  checkStatementFormulas,
  nonZeroEntries,
  partitionFields,
  readFeeTax,
  statementFileName,
  totalsByType,
  transactionsCsv,
  transactionsTsv,
  transactionsXlsx,
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
  /** Lê a célula pelo NOME da coluna, não pela posição. */
  const readRow = (tsv: string) => {
    const [header, row] = tsv.split("\n");
    const columns = header?.split("\t") ?? [];
    const cells = row?.split("\t") ?? [];
    return (name: string) => cells[columns.indexOf(name)];
  };

  it("gera cabeçalho em português e uma linha por transação", () => {
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
    expect(tsv.split("\n")).toHaveLength(2);

    const at = readRow(tsv);
    expect(at("Pedido")).toBe("576463220456522968");
    expect(at("Tipo")).toBe("Pedido");
    expect(at("Tipo (código)")).toBe("ORDER");
    // Ponto decimal: o destino é colar numa planilha já aberta.
    expect(at("Repasse")).toBe("130.00");
  });

  it("usa o pedido do ajuste ou da reserva quando não há order_id", () => {
    const tsv = transactionsTsv([
      { id: "1", type: "RESERVE", associated_order_id: "78217892102382101" },
    ]);
    expect(readRow(tsv)("Pedido")).toBe("78217892102382101");
  });

  it("exporta a reserva, que só existe no extrato", () => {
    const tsv = transactionsTsv([
      {
        id: "1",
        type: "RESERVE",
        reserve_id: "7238804564097517339",
        reserve_amount: "-20",
        reserve_status: "COLLECTED",
        estimated_release_time: "1685548800",
      },
    ]);
    const at = readRow(tsv);
    expect(at("ID da reserva")).toBe("7238804564097517339");
    expect(at("Valor da reserva")).toBe("-20.00");
    expect(at("Status da reserva")).toBe("COLLECTED");
    // O campo vem como string, mas é epoch: sai como data legível.
    expect(at("Liberação prevista")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("traz a diferença não detalhada das tarifas, como na tela", () => {
    const tsv = transactionsTsv([
      {
        id: "1",
        type: "ORDER",
        fee_tax_amount: "-44.78",
        fee_tax_breakdown: {
          fee: {
            affiliate_commission_amount: "-16.08",
            affiliate_commission_before_pit_amount: "-16.08",
            platform_commission_amount: "-11.35",
            sfp_service_fee_amount: "-11.35",
          },
        },
      },
    ]);
    expect(readRow(tsv)("Tarifas sem detalhamento")).toBe("-6.00");
  });
});

describe("transactionsCsv e transactionsXlsx", () => {
  const linha = {
    id: "1636700041413599290",
    type: "ORDER",
    order_id: "576463220456522968",
    revenue_amount: "200",
    settlement_amount: "130",
  };

  it("o CSV usa ponto-e-vírgula e vírgula decimal, para o Excel pt-BR", () => {
    const csv = transactionsCsv([linha]);
    const [header, row] = csv.split("\r\n");
    const columns = header?.split(";") ?? [];
    const cells = row?.split(";") ?? [];
    expect(cells[columns.indexOf("Repasse")]).toBe("130,00");
    expect(csv).not.toContain("\t");
  });

  it("o xlsx sai como ZIP, que é o que um .xlsx é por dentro", () => {
    const bytes = transactionsXlsx([linha]);
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
  });
});

describe("statementFileName", () => {
  it("leva o ID do extrato no nome, para conferir vários lado a lado", () => {
    expect(statementFileName("7238804564097517339", "xlsx", new Date(2026, 8, 22))).toBe(
      "extrato-7238804564097517339-2026-09-22.xlsx",
    );
  });

  it("cai num nome genérico quando a resposta não trouxe o ID", () => {
    expect(statementFileName(undefined, "csv", new Date(2026, 8, 22))).toBe(
      "extrato-2026-09-22.csv",
    );
  });
});

/**
 * Tarifas de um pedido real de loja BR (586069337557206163). É o caso que
 * motivou a conferência: as linhas exibidas somavam -54,86, enquanto o
 * total declarado era -44,78.
 */
const TARIFAS_BR = {
  fee: {
    affiliate_commission_amount: "-16.08",
    affiliate_commission_before_pit_amount: "-16.08",
    pit_withheld_from_ads_commission_amount: "0",
    platform_commission_amount: "-11.35",
    sfp_service_fee_amount: "-11.35",
    transaction_fee_amount: "0",
  },
  tax: { vat_amount: "0", sales_tax_amount: "0" },
};

describe("readFeeTax", () => {
  const label = (field: string) => field;

  it("tira da soma a comissão de afiliado antes do IR, que duplica a de cima", () => {
    const { entries, reference } = readFeeTax(TARIFAS_BR, parseMoney("-44.78"), label);
    expect(entries.map((e) => e.field)).toEqual([
      "affiliate_commission_amount",
      "platform_commission_amount",
      "sfp_service_fee_amount",
    ]);
    expect(reference.map((e) => e.field)).toEqual(["affiliate_commission_before_pit_amount"]);
  });

  it("expõe o valor que a API cobra sem detalhar em campo nenhum", () => {
    // Linhas somam -38,78; o total declarado é -44,78.
    const { reconciliation } = readFeeTax(TARIFAS_BR, parseMoney("-44.78"), label);
    expect(decimal(reconciliation?.sum)).toBe("-38.78");
    expect(decimal(reconciliation?.total)).toBe("-44.78");
    expect(decimal(reconciliation?.undetailed)).toBe("-6.00");
    expect(reconciliation?.matches).toBe(false);
  });

  it("não acusa diferença quando as linhas fecham com o total", () => {
    const { reconciliation } = readFeeTax(
      { fee: { platform_commission_amount: "-5.21", sfp_service_fee_amount: "-5.21" } },
      parseMoney("-10.42"),
      label,
    );
    expect(reconciliation?.matches).toBe(true);
    expect(decimal(reconciliation?.undetailed)).toBe("0.00");
  });

  it("junta tarifas e impostos numa lista só, por ordem de impacto", () => {
    const { entries } = readFeeTax(
      { fee: { platform_commission_amount: "-5" }, tax: { vat_amount: "-25" } },
      parseMoney("-30"),
      label,
    );
    expect(entries.map((e) => e.field)).toEqual(["vat_amount", "platform_commission_amount"]);
  });

  it("conta os zerados de fee e tax juntos, que é o que a tela omite", () => {
    const { zeros } = readFeeTax(TARIFAS_BR, parseMoney("-44.78"), label);
    // pit_withheld + transaction_fee + vat + sales_tax
    expect(zeros).toBe(4);
  });

  it("não confere quando o total não veio, em vez de assumir zero", () => {
    expect(readFeeTax(TARIFAS_BR, undefined, label).reconciliation).toBeUndefined();
  });
});

describe("partitionFields", () => {
  it("separa os campos de referência dos que somam", () => {
    const { main, reference } = partitionFields(
      { a: "1", b: "2", c: "3" },
      ["b"],
    );
    expect(Object.keys(main)).toEqual(["a", "c"]);
    expect(Object.keys(reference)).toEqual(["b"]);
  });

  it("devolve dois objetos vazios quando não há detalhamento", () => {
    const { main, reference } = partitionFields(undefined, ["b"]);
    expect(main).toEqual({});
    expect(reference).toEqual({});
  });
});
