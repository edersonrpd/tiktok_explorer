import { describe, expect, it } from "vitest";
import {
  canCompareSums,
  checkSums,
  checkTransactionFormula,
  filterTransactions,
  isDelivered,
  pageSums,
  parseEstimatedSettlement,
  singleCurrency,
  summarizeFormulas,
  undetailedFeeTax,
  unsettledCsv,
  unsettledFileName,
  unsettledTotalsByType,
  unsettledTsv,
  unsettledXlsx,
} from "./unsettled";
import { toDecimalString } from "./money";
import type { UnsettledTransaction, UnsettledTransactionsData } from "../types/tiktok";

/** Valor monetário como decimal legível — os totais são Money (escala 4). */
const decimal = (value: number | undefined) =>
  value === undefined ? undefined : toDecimalString(value);

/**
 * Exemplo da própria documentação do Get Unsettled Transactions, copiado
 * sem alterações: é ele que prova que a fórmula publicada fecha com os
 * sinais que a API usa (custos já vêm negativos).
 */
const SAMPLE: UnsettledTransactionsData = {
  next_page_token:
    "6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq/N5M1kHYcZmtRyv9aVrNv65W7Q6tFA+7D1ud64MPNz5OaT",
  total_count: 2,
  sum_est_settlement_amount: "100",
  sum_est_revenue_amount: "10",
  sum_est_adjustment_amount: "-10",
  sum_est_fee_amount: "-10",
  transactions: [
    {
      type: "ORDER",
      id: "1636700041413599290",
      status: "UNSETTLED",
      currency: "USD",
      estimated_settlement: "1685548800",
      unsettled_reason: "waiting for deliveery",
      order_create_time: 1685548800,
      order_delivery_time: 1685548800,
      order_id: "576463220456522968",
      adjustment_id: "7238804564097517332",
      adjustment_order_id: "576463220456522968",
      est_adjustment_amount: "170",
      est_settlement_amount: "130",
      est_revenue_amount: "200",
      revenue_breakdown: {
        subtotal_before_discount_amount: "210",
        seller_discount_amount: "-10",
        refund_subtotal_before_discount_amount: "0",
        seller_discount_refund_amount: "0",
        cod_service_fee_amount: "0",
        refund_cod_service_fee_amount: "0",
        distant_item_fee_amount: "0",
      },
      est_shipping_cost_amount: "-70",
      shipping_cost_breakdown: {
        actual_shipping_fee_amount: "-50",
        international_leg_logistics_amount: "0",
        shipping_fee_discount_amount: "50",
        customer_paid_shipping_fee_amount: "70",
        return_shipping_fee_amount: "-10",
        replacement_shipping_fee_amount: "-10",
        exchange_shipping_fee_amount: "-10",
        signature_confirmation_fee_amount: "-5",
        shipping_insurance_fee_amount: "-5",
        distant_shipping_fee_amount: "0",
        shipping_app_service_fee_amount: "0",
        logistics_service_fee: "0",
        fbt_overall_merchant_subsidy: "0",
        fbt_key_merchant_subsidy: "0",
        supplementary_component: {
          customer_shipping_fee_offset_amount: "-6.99",
          shipping_fee_subsidy_amount: "0",
          platform_shipping_fee_discount_amount: "20",
          fbm_shipping_cost_amount: "0",
          fbt_shipping_cost_amount: "0",
          promo_shipping_incentive_amount: "30",
          fbt_fulfillment_fee_amount: "-50",
          seller_shipping_fee_discount_amount: "0",
        },
        sfr_reimbursement: "0",
        tiktok_shop_shipping_incentive_amount: "0",
      },
      est_fee_tax_amount: "-30",
      fee_tax_breakdown: {
        fee: {
          platform_commission_amount: "0",
          referral_fee_amount: "-2",
          transaction_fee_amount: "-2",
          credit_card_handling_fee_amount: "-2",
          affiliate_commission_amount: "-4",
          affiliate_commission_before_pit_amount: "-6",
          pit_withheld_from_ads_commission_amount: "2",
          affiliate_ads_commission_amount: "-3",
        },
        tax: {
          sales_tax_amount: "-10",
          sales_tax_payment_amount: "10",
          sales_tax_refund_amount: "0",
          vat_amount: "0",
        },
      },
    },
  ],
};

const sampleTransactions = SAMPLE.transactions ?? [];

describe("parseEstimatedSettlement", () => {
  it("lê um epoch como data quando o pedido já foi entregue", () => {
    expect(parseEstimatedSettlement("1685548800")).toEqual({ kind: "date", epoch: 1685548800 });
  });

  it("devolve a política textual quando a API ainda não calculou a data", () => {
    // Este é o caso MAIS comum desta consulta: pedido ainda não entregue.
    expect(parseEstimatedSettlement("15 days after delivery")).toEqual({
      kind: "policy",
      text: "15 days after delivery",
    });
  });

  it("distingue ausente/vazio de política", () => {
    expect(parseEstimatedSettlement(undefined)).toBeUndefined();
    expect(parseEstimatedSettlement("   ")).toBeUndefined();
  });
});

describe("isDelivered", () => {
  it("considera entregue quem tem order_delivery_time", () => {
    expect(isDelivered(sampleTransactions[0] as UnsettledTransaction)).toBe(true);
  });

  it("considera não entregue quando o campo não veio ou é zero", () => {
    expect(isDelivered({ id: "1" })).toBe(false);
    expect(isDelivered({ id: "1", order_delivery_time: 0 })).toBe(false);
  });
});

describe("checkTransactionFormula", () => {
  it("fecha a fórmula do exemplo da documentação (custos chegam negativos)", () => {
    // 200 − (−70) − (−30) − 170 = 130
    const check = checkTransactionFormula(sampleTransactions[0] as UnsettledTransaction);
    expect(check?.matches).toBe(true);
    expect(decimal(check?.expected)).toBe("130.00");
    expect(decimal(check?.returned)).toBe("130.00");
  });

  it("aponta divergência em vez de escondê-la", () => {
    const check = checkTransactionFormula({
      id: "1",
      est_revenue_amount: "100",
      est_settlement_amount: "90",
    });
    expect(check?.matches).toBe(false);
    expect(decimal(check?.expected)).toBe("100.00");
  });

  it("não confere quando est_settlement_amount não veio", () => {
    // Sem o valor retornado não há o que comparar — assumir zero acusaria
    // divergência onde só há campo ausente.
    expect(checkTransactionFormula({ id: "1", est_revenue_amount: "100" })).toBeUndefined();
  });
});

describe("summarizeFormulas", () => {
  it("conta conferidas, fechadas e divergentes", () => {
    const summary = summarizeFormulas([
      ...sampleTransactions,
      { id: "2", est_revenue_amount: "100", est_settlement_amount: "90" },
      { id: "3", est_revenue_amount: "50" },
    ]);
    expect(summary.checked).toBe(2);
    expect(summary.matching).toBe(1);
    expect(summary.diverging.map((d) => d.tx.id)).toEqual(["2"]);
  });
});

describe("pageSums", () => {
  it("soma os cinco valores estimados da página", () => {
    const sums = pageSums(sampleTransactions);
    expect(decimal(sums.revenue)).toBe("200.00");
    expect(decimal(sums.shipping)).toBe("-70.00");
    expect(decimal(sums.feeTax)).toBe("-30.00");
    expect(decimal(sums.adjustment)).toBe("170.00");
    expect(decimal(sums.settlement)).toBe("130.00");
  });
});

describe("canCompareSums", () => {
  it("recusa comparar quando ainda há próxima página", () => {
    // Os somatórios do cabeçalho são do conjunto inteiro: compará-los com
    // uma página só acusaria uma divergência que não existe.
    expect(canCompareSums(SAMPLE, sampleTransactions)).toBe(false);
  });

  it("recusa comparar quando total_count é maior que o que veio", () => {
    const data = { ...SAMPLE, next_page_token: undefined };
    expect(canCompareSums(data, sampleTransactions)).toBe(false);
  });

  it("aceita comparar quando a página é o conjunto inteiro", () => {
    const data = { ...SAMPLE, next_page_token: undefined, total_count: 1 };
    expect(canCompareSums(data, sampleTransactions)).toBe(true);
  });
});

describe("checkSums", () => {
  it("compara cada somatório do cabeçalho com a soma das transações", () => {
    const data: UnsettledTransactionsData = {
      ...SAMPLE,
      next_page_token: undefined,
      total_count: 1,
      sum_est_revenue_amount: "200",
      sum_est_fee_amount: "-30",
      sum_est_adjustment_amount: "170",
      sum_est_settlement_amount: "130",
    };
    const checks = checkSums(data, sampleTransactions);
    expect(checks.every((c) => c.matches)).toBe(true);
    expect(checks.map((c) => c.field)).toEqual([
      "sum_est_revenue_amount",
      "sum_est_fee_amount",
      "sum_est_adjustment_amount",
      "sum_est_settlement_amount",
    ]);
  });

  it("marca como divergente o somatório que não bate", () => {
    const data: UnsettledTransactionsData = {
      ...SAMPLE,
      next_page_token: undefined,
      total_count: 1,
      sum_est_settlement_amount: "999",
    };
    const settlement = checkSums(data, sampleTransactions).find(
      (c) => c.field === "sum_est_settlement_amount",
    );
    expect(settlement?.matches).toBe(false);
    expect(decimal(settlement?.fromPage)).toBe("130.00");
  });
});

describe("unsettledTotalsByType", () => {
  it("agrupa pedidos e ajustes separadamente", () => {
    const totals = unsettledTotalsByType([
      ...sampleTransactions,
      { id: "2", type: "PLATFORM_PENALTY", est_adjustment_amount: "-50", est_settlement_amount: "-50" },
      { id: "3", type: "PLATFORM_PENALTY", est_adjustment_amount: "-25", est_settlement_amount: "-25" },
    ]);
    expect(totals.map((t) => t.type)).toEqual(["PLATFORM_PENALTY", "ORDER"]);
    expect(totals[0]?.count).toBe(2);
    expect(decimal(totals[0]?.adjustment)).toBe("-75.00");
  });
});

describe("singleCurrency", () => {
  it("devolve a moeda quando todas as transações concordam", () => {
    expect(singleCurrency(sampleTransactions)).toBe("USD");
  });

  it("devolve undefined quando a página mistura moedas — somar não faria sentido", () => {
    expect(singleCurrency([{ id: "1", currency: "USD" }, { id: "2", currency: "BRL" }])).toBeUndefined();
  });

  it("ignora transações sem moeda em vez de desistir", () => {
    expect(singleCurrency([{ id: "1" }, { id: "2", currency: "BRL" }])).toBe("BRL");
  });
});

describe("unsettledTsv", () => {
  it("usa cabeçalho em português e ponto decimal, o formato de colar", () => {
    const lines = unsettledTsv(sampleTransactions).split("\n");
    const columns = lines[0]?.split("\t") ?? [];
    const cells = lines[1]?.split("\t") ?? [];
    const at = (name: string) => cells[columns.indexOf(name)];

    expect(columns).toContain("Repasse estimado");
    expect(at("Pedido")).toBe("576463220456522968");
    // Ponto, e não vírgula: aqui o destino é colar numa planilha aberta.
    expect(at("Repasse estimado")).toBe("130.00");
  });

  it("achata o motivo em uma linha, para não arrebentar a coluna", () => {
    const tsv = unsettledTsv([{ id: "1", unsettled_reason: "aguardando\tentrega\ndo pedido" }]);
    expect(tsv.split("\n")).toHaveLength(2);
    expect(tsv).toContain("aguardando entrega do pedido");
  });
});

describe("filterTransactions", () => {
  const rows: UnsettledTransaction[] = [
    { id: "1", type: "ORDER", order_id: "576463220456522968" },
    { id: "2", type: "PLATFORM_PENALTY", adjustment_id: "7238804564097517332",
      adjustment_order_id: "576463220456522969" },
    { id: "3", type: "ORDER", order_id: "111111111111111111" },
  ];

  it("devolve tudo quando a busca está vazia", () => {
    expect(filterTransactions(rows, "   ")).toHaveLength(3);
  });

  it("acha o pedido pelo order_id", () => {
    expect(filterTransactions(rows, "576463220456522968").map((t) => t.id)).toEqual(["1"]);
  });

  it("acha o pedido quando ele aparece como adjustment_order_id", () => {
    // O mesmo pedido pode estar numa linha como order_id e em outra como
    // o pedido associado a um ajuste.
    expect(filterTransactions(rows, "576463220456522969").map((t) => t.id)).toEqual(["2"]);
  });

  it("casa por trecho, sem exigir o ID inteiro", () => {
    expect(filterTransactions(rows, "5764632204565229").map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("aceita vários IDs colados de planilha", () => {
    const found = filterTransactions(rows, "576463220456522968, 111111111111111111");
    expect(found.map((t) => t.id)).toEqual(["1", "3"]);
  });

  it("também filtra pelo tipo, sem diferenciar maiúsculas", () => {
    expect(filterTransactions(rows, "platform_penalty").map((t) => t.id)).toEqual(["2"]);
  });

  it("devolve vazio quando nada casa, em vez de devolver tudo", () => {
    expect(filterTransactions(rows, "999")).toEqual([]);
  });
});

/**
 * Pedido real de uma loja BR (586069337557206163). Ele é o caso que
 * motivou a conferência de tarifas: quatro linhas que somam -54,86,
 * enquanto `est_fee_tax_amount` é -44,78.
 */
const PEDIDO_BR: UnsettledTransaction = {
  id: "7685384271058355976",
  type: "ORDER",
  status: "UNSETTLED",
  currency: "BRL",
  order_id: "586069337557206163",
  estimated_settlement: "Delivered + 7 days",
  unsettled_reason: "WAITING_FOR_PACKAGE_DELIVERY",
  order_create_time: 1789392500,
  est_revenue_amount: "189.2",
  est_shipping_cost_amount: "0",
  est_fee_tax_amount: "-44.78",
  est_settlement_amount: "144.42",
  fee_tax_breakdown: {
    fee: {
      affiliate_commission_amount: "-16.08",
      affiliate_commission_before_pit_amount: "-16.08",
      pit_withheld_from_ads_commission_amount: "0",
      platform_commission_amount: "-11.35",
      sfp_service_fee_amount: "-11.35",
      transaction_fee_amount: "0",
    },
    tax: { vat_amount: "0", sales_tax_amount: "0" },
  },
};

describe("undetailedFeeTax", () => {
  it("devolve a diferença do pedido real", () => {
    expect(decimal(undetailedFeeTax(PEDIDO_BR))).toBe("-6.00");
  });

  it("devolve undefined quando a transação não traz est_fee_tax_amount", () => {
    expect(undetailedFeeTax({ id: "1" })).toBeUndefined();
  });
});

describe("unsettledCsv", () => {
  const csv = unsettledCsv([PEDIDO_BR]);
  const [header, row] = csv.split("\r\n");
  const columns = header?.split(";") ?? [];
  const cells = row?.split(";") ?? [];
  const at = (name: string) => cells[columns.indexOf(name)];

  it("traz os cabeçalhos em português", () => {
    expect(columns).toContain("Repasse estimado");
    expect(columns).toContain("Tarifas sem detalhamento");
    expect(columns).not.toContain("est_settlement");
  });

  it("usa ponto-e-vírgula, que é o separador do Excel em português", () => {
    expect(csv).not.toContain("\t");
  });

  it("usa vírgula decimal, senão o Excel pt-BR lê o valor como texto", () => {
    expect(at("Receita estimada")).toBe("189,20");
    expect(at("Repasse estimado")).toBe("144,42");
  });

  it("traz o valor não detalhado como coluna própria", () => {
    expect(at("Tarifas sem detalhamento")).toBe("-6,00");
  });

  it("traduz o tipo e mantém o código ao lado, para filtrar", () => {
    expect(at("Tipo")).toBe("Pedido");
    expect(at("Tipo (código)")).toBe("ORDER");
  });

  it("não converte decimal em coluna que não é dinheiro", () => {
    // "Delivered + 7 days" não pode virar número.
    expect(at("Liquidação prevista")).toBe("Delivered + 7 days");
  });

  it("termina as linhas com CRLF, como o Excel espera", () => {
    expect(csv).toContain("\r\n");
  });
});

describe("unsettledFileName", () => {
  it("carimba a data e a extensão pedida", () => {
    expect(unsettledFileName("csv", new Date(2026, 8, 22))).toBe(
      "transacoes-a-liquidar-2026-09-22.csv",
    );
    expect(unsettledFileName("xlsx", new Date(2026, 8, 22))).toBe(
      "transacoes-a-liquidar-2026-09-22.xlsx",
    );
  });
});

describe("unsettledXlsx", () => {
  it("gera um arquivo ZIP, que é o que um .xlsx é por dentro", () => {
    const bytes = unsettledXlsx([PEDIDO_BR]);
    // "PK" — a assinatura de todo ZIP.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("é determinístico com a mesma data, para o arquivo ser comparável", () => {
    const when = new Date(2026, 8, 22, 10, 0, 0);
    const a = unsettledXlsx([PEDIDO_BR], when);
    const b = unsettledXlsx([PEDIDO_BR], when);
    expect(a).toEqual(b);
  });

  it("não quebra com a lista vazia", () => {
    expect(unsettledXlsx([]).length).toBeGreaterThan(500);
  });
});
