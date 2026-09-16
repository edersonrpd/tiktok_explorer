import { describe, expect, it } from "vitest";
import type { SkuTransaction } from "../types/tiktok";
import {
  amountsEqual,
  breakdownLines,
  isZeroAmount,
  labelForAmountKey,
  mergeBreakdowns,
  nonZeroLines,
  orderFeeLines,
  sumAmounts,
} from "./fees";

describe("sumAmounts", () => {
  it("soma sem erro de ponto flutuante", () => {
    // Em number, 0.1 + 0.2 daria 0.30000000000000004.
    expect(sumAmounts(["0.1", "0.2"])).toBe("0.3");
    expect(sumAmounts(["0.07", "0.01", "0.02"])).toBe("0.10");
  });

  it("alinha casas decimais diferentes", () => {
    expect(sumAmounts(["1.5", "2"])).toBe("3.5");
    expect(sumAmounts(["13.45", "0.005"])).toBe("13.455");
  });

  it("soma negativos — taxas chegam com sinal", () => {
    expect(sumAmounts(["-2", "1.25"])).toBe("-0.75");
    expect(sumAmounts(["-0.30", "0.30"])).toBe("0.00");
  });

  it("ignora valores ausentes ou não numéricos", () => {
    expect(sumAmounts([undefined, "3", "", "abc"])).toBe("3");
    expect(sumAmounts([])).toBe("0");
    expect(sumAmounts([undefined])).toBe("0");
  });

  it("preserva valores grandes sem perder precisão", () => {
    expect(sumAmounts(["9007199254740993.01", "0.01"])).toBe("9007199254740993.02");
  });
});

describe("isZeroAmount", () => {
  it("trata como zero o ausente, o vazio e o não numérico", () => {
    expect(isZeroAmount(undefined)).toBe(true);
    expect(isZeroAmount("")).toBe(true);
    expect(isZeroAmount("abc")).toBe(true);
  });

  it("reconhece zero em qualquer escala e com sinal", () => {
    expect(isZeroAmount("0")).toBe(true);
    expect(isZeroAmount("0.00")).toBe(true);
    expect(isZeroAmount("-0")).toBe(true);
  });

  it("não confunde centavo com zero", () => {
    expect(isZeroAmount("0.01")).toBe(false);
    expect(isZeroAmount("-0.01")).toBe(false);
  });
});

describe("mergeBreakdowns", () => {
  it("soma a mesma rubrica entre SKUs", () => {
    const lines = mergeBreakdowns([
      { referral_fee_amount: "-1.50", transaction_fee_amount: "-0.20" },
      { referral_fee_amount: "-2.50", transaction_fee_amount: "-0.30" },
    ]);

    expect(lines.map((l) => [l.key, l.amount])).toEqual([
      ["referral_fee_amount", "-4.00"],
      ["transaction_fee_amount", "-0.50"],
    ]);
  });

  it("ordena pela maior taxa em valor absoluto, não pelo sinal", () => {
    const lines = mergeBreakdowns([
      { pequena: "-0.10", grande: "-9.99", media: "5.00" },
    ]);

    expect(lines.map((l) => l.key)).toEqual(["grande", "media", "pequena"]);
  });

  it("mantém rubrica que só aparece em um dos SKUs", () => {
    const lines = mergeBreakdowns([
      { referral_fee_amount: "-1.00" },
      { referral_fee_amount: "-1.00", mall_service_fee_amount: "-0.50" },
    ]);

    expect(lines.find((l) => l.key === "mall_service_fee_amount")?.amount).toBe("-0.50");
  });

  it("ignora grupos ausentes", () => {
    expect(mergeBreakdowns([undefined, undefined])).toEqual([]);
  });

  it("traz rubrica desconhecida com a chave crua preservada", () => {
    const [line] = mergeBreakdowns([{ br_nova_taxa_amount: "-1.00" }]);

    expect(line?.key).toBe("br_nova_taxa_amount");
    expect(line?.label).toBe("Br nova taxa");
  });
});

describe("breakdownLines e nonZeroLines", () => {
  it("lista as rubricas de um SKU só", () => {
    expect(breakdownLines({ vat_amount: "-3.00" })).toEqual([
      { key: "vat_amount", label: "VAT", amount: "-3.00" },
    ]);
  });

  it("descarta as rubricas zeradas que a API manda às dezenas", () => {
    const lines = breakdownLines({
      referral_fee_amount: "-1.00",
      mall_service_fee_amount: "0",
      transaction_fee_amount: "0.00",
    });

    expect(lines).toHaveLength(3);
    expect(nonZeroLines(lines).map((l) => l.key)).toEqual(["referral_fee_amount"]);
  });
});

describe("orderFeeLines", () => {
  const skus: SkuTransaction[] = [
    {
      sku_id: "1",
      fee_tax_breakdown: {
        fee: { referral_fee_amount: "-1.00" },
        tax: { vat_amount: "-0.50" },
      },
    },
    {
      sku_id: "2",
      fee_tax_breakdown: {
        fee: { referral_fee_amount: "-2.00", transaction_fee_amount: "-0.10" },
      },
    },
  ];

  it("separa taxas de impostos e soma o pedido inteiro", () => {
    const { fees, taxes } = orderFeeLines(skus);

    expect(fees.map((l) => [l.key, l.amount])).toEqual([
      ["referral_fee_amount", "-3.00"],
      ["transaction_fee_amount", "-0.10"],
    ]);
    expect(taxes.map((l) => [l.key, l.amount])).toEqual([["vat_amount", "-0.50"]]);
  });

  it("devolve listas vazias quando o pedido não tem SKUs", () => {
    expect(orderFeeLines([])).toEqual({ fees: [], taxes: [] });
  });
});

describe("amountsEqual", () => {
  it("compara pelo valor, não pelo texto", () => {
    expect(amountsEqual("-3", "-3.00")).toBe(true);
    expect(amountsEqual("0", "0.0000")).toBe(true);
  });

  it("distingue valores diferentes, inclusive por um centavo", () => {
    expect(amountsEqual("-3.00", "-3.01")).toBe(false);
    expect(amountsEqual("3", "-3")).toBe(false);
  });

  it("trata ausente e não numérico como incomparáveis a um número", () => {
    expect(amountsEqual(undefined, "0")).toBe(false);
    expect(amountsEqual(undefined, undefined)).toBe(true);
  });
});

describe("labelForAmountKey", () => {
  it("usa o rótulo conhecido, com a região quando ela restringe a rubrica", () => {
    expect(labelForAmountKey("affiliate_commission_amount")).toBe("Comissão de afiliado (creator)");
    expect(labelForAmountKey("platform_commission_amount")).toBe("Comissão da plataforma (UK)");
  });

  it("humaniza chave desconhecida em vez de escondê-la", () => {
    expect(labelForAmountKey("some_new_service_fee_amount")).toBe("Some new service fee");
  });
});
