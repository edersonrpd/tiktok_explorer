import { describe, expect, it } from "vitest";
import {
  buildBuyerBreakdown,
  buildSellerStatement,
  buildShippingFunding,
  effectiveRate,
  parseFeeInput,
} from "./orderStatement";
import { parseMoney, toDecimalString } from "./money";
import type { Order } from "../types/tiktok";

/**
 * Pedido real de referência (números conferidos contra o extrato do HUB
 * oficial): itens R$ 17,65, frete cheio R$ 13,30 com R$ 12,00 de subsídio
 * da plataforma, comprador paga R$ 18,95, comissões R$ 6,82 e o líquido
 * do vendedor é R$ 10,83.
 */
const order: Order = {
  id: "585720918505260295",
  status: "AWAITING_SHIPMENT",
  shipping_type: "TIKTOK",
  shipping_provider: "iMile BR",
  fulfillment_type: "FULFILLMENT_BY_SELLER",
  payment: {
    currency: "BRL",
    original_shipping_fee: "13.3",
    original_total_product_price: "17.65",
    platform_discount: "0",
    seller_discount: "0",
    shipping_fee: "1.3",
    shipping_fee_cofunded_discount: "0",
    shipping_fee_platform_discount: "12",
    shipping_fee_seller_discount: "0",
    sub_total: "17.65",
    total_amount: "18.95",
  },
  line_items: [
    {
      id: "585720918505325831",
      currency: "BRL",
      original_price: "17.65",
      sale_price: "17.65",
      platform_discount: "0",
      seller_discount: "0",
      seller_sku: "GRELHA 200MM",
      sku_id: "1735454964054459620",
      display_status: "AWAITING_SHIPMENT",
    },
  ],
};

const brl = (value: string) => parseMoney(value)!;

describe("buildBuyerBreakdown", () => {
  it("fecha itens, frete e total com os campos da API", () => {
    const breakdown = buildBuyerBreakdown(order);
    const [items, shipping] = breakdown.sections;

    expect(toDecimalString(items!.computed)).toBe("17.65");
    expect(items!.matches).toBe(true);

    // 13,30 − 12,00 de subsídio = 1,30 cobrado do comprador.
    expect(toDecimalString(shipping!.computed)).toBe("1.30");
    expect(shipping!.matches).toBe(true);

    expect(toDecimalString(breakdown.computedTotal)).toBe("18.95");
    expect(breakdown.totalMatches).toBe(true);
  });

  it("acusa divergência quando o total não fecha", () => {
    const broken: Order = { ...order, payment: { ...order.payment, total_amount: "20.00" } };
    expect(buildBuyerBreakdown(broken).totalMatches).toBe(false);
  });

  it("cai na soma das linhas quando falta original_total_product_price", () => {
    const withoutTotal: Order = {
      ...order,
      payment: { ...order.payment, original_total_product_price: undefined },
    };
    const [items] = buildBuyerBreakdown(withoutTotal).sections;
    expect(toDecimalString(items!.computed)).toBe("17.65");
  });

  it("não cria linha para campo que a API não mandou", () => {
    const [items] = buildBuyerBreakdown({ ...order, payment: { currency: "BRL" } }).sections;
    expect(items!.rows.filter((r) => r.field === "seller_discount")).toHaveLength(0);
  });
});

describe("buildSellerStatement", () => {
  it("reproduz o extrato oficial do pedido de referência", () => {
    const statement = buildSellerStatement(order, brl("6.82"));

    expect(toDecimalString(statement.credit)).toBe("18.95");
    expect(toDecimalString(statement.debit)).toBe("8.12");
    expect(toDecimalString(statement.net)).toBe("10.83");
    expect(statement.feeKnown).toBe(true);
  });

  it("com etiqueta do TikTok o frete entra e sai, fechando em zero", () => {
    const statement = buildSellerStatement(order, undefined);
    const shippingLines = statement.lines.filter((l) => l.amount === brl("1.3"));

    expect(shippingLines.map((l) => l.side).sort()).toEqual(["credit", "debit"]);
    // Sem comissão informada, o líquido é só a mercadoria.
    expect(toDecimalString(statement.net)).toBe("17.65");
    expect(statement.feeKnown).toBe(false);
  });

  it("com envio do vendedor o frete fica com ele e o subsídio é creditado", () => {
    const sellerShipped: Order = { ...order, shipping_type: "SELLER" };
    const statement = buildSellerStatement(sellerShipped, undefined);

    expect(statement.lines.some((l) => l.field === "shipping_type: TIKTOK")).toBe(false);
    // 17,65 + 1,30 do frete + 12,00 de subsídio reembolsado.
    expect(toDecimalString(statement.credit)).toBe("30.95");
    expect(toDecimalString(statement.net)).toBe("30.95");
  });

  it("desconto do vendedor é débito e o da plataforma é crédito", () => {
    const withDiscounts: Order = {
      ...order,
      payment: { ...order.payment, seller_discount: "2", platform_discount: "3" },
    };
    const statement = buildSellerStatement(withDiscounts, undefined);

    const seller = statement.lines.find((l) => l.field === "seller_discount");
    const platform = statement.lines.find((l) => l.field === "platform_discount");
    expect(seller?.side).toBe("debit");
    expect(platform?.side).toBe("credit");
    // 17,65 + 3,00 + 1,30 − 2,00 − 1,30
    expect(toDecimalString(statement.net)).toBe("18.65");
  });

  it("retém as taxas cobradas do comprador que ficam com a plataforma", () => {
    const withFee: Order = { ...order, payment: { ...order.payment, buyer_service_fee: "0.99" } };
    const statement = buildSellerStatement(withFee, undefined);
    const line = statement.lines.find((l) => l.label.startsWith("Taxas cobradas do comprador"));

    expect(line?.side).toBe("debit");
    expect(toDecimalString(statement.net)).toBe("16.66");
  });
});

describe("buildShippingFunding", () => {
  it("separa quem bancou cada parte do frete", () => {
    const funding = buildShippingFunding(order);

    expect(toDecimalString(funding.buyer)).toBe("1.30");
    expect(toDecimalString(funding.platform)).toBe("12.00");
    expect(toDecimalString(funding.original)).toBe("13.30");
    expect(funding.byPlatform).toBe(true);
    expect(funding.matches).toBe(true);
  });

  it("acusa quando as partes não somam o frete cheio", () => {
    const broken: Order = {
      ...order,
      payment: { ...order.payment, shipping_fee_platform_discount: "5" },
    };
    expect(buildShippingFunding(broken).matches).toBe(false);
  });
});

describe("parseFeeInput", () => {
  const base = brl("18.95");

  it("aceita percentual e aplica sobre o total pago", () => {
    const fee = parseFeeInput("36%", base);
    expect(fee.kind).toBe("rate");
    expect(fee.kind === "rate" && toDecimalString(fee.amount)).toBe("6.82");
  });

  it("aceita valor absoluto com vírgula ou ponto", () => {
    expect(parseFeeInput("6,82", base).kind).toBe("amount");
    expect(parseFeeInput("R$ 6.82", base).kind).toBe("amount");
  });

  it("campo vazio não vira zero: comissão continua desconhecida", () => {
    expect(parseFeeInput("   ", base).kind).toBe("empty");
  });

  it("recusa entrada sem sentido", () => {
    expect(parseFeeInput("três reais", base).kind).toBe("invalid");
    expect(parseFeeInput("-5", base).kind).toBe("invalid");
    expect(parseFeeInput("%", base).kind).toBe("invalid");
  });
});

describe("effectiveRate", () => {
  it("mostra o percentual que o valor informado representa", () => {
    expect(effectiveRate(brl("6.82"), brl("18.95"))!.toFixed(2)).toBe("35.99");
  });

  it("não divide por zero", () => {
    expect(effectiveRate(brl("6.82"), 0)).toBeUndefined();
  });
});
