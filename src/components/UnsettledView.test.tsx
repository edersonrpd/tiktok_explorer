import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UnsettledView } from "./UnsettledView";
import { formatMoney, parseMoney } from "../lib/money";
import type { UnsettledTransactionsData } from "../types/tiktok";

/**
 * Exemplo da própria documentação do Get Unsettled Transactions, copiado
 * sem alterações — inclusive o `unsettled_reason` com o erro de digitação
 * ("deliveery") que veio da TikTok, para deixar claro que a tela mostra o
 * texto da API e não uma versão editada.
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
        distant_item_fee_amount: "0",
      },
      est_shipping_cost_amount: "-70",
      shipping_cost_breakdown: {
        actual_shipping_fee_amount: "-50",
        shipping_fee_discount_amount: "50",
        customer_paid_shipping_fee_amount: "70",
        logistics_service_fee: "0",
        sfr_reimbursement: "0",
        supplementary_component: {
          customer_shipping_fee_offset_amount: "-6.99",
          promo_shipping_incentive_amount: "30",
        },
      },
      est_fee_tax_amount: "-30",
      fee_tax_breakdown: {
        fee: { referral_fee_amount: "-2", platform_commission_amount: "0" },
        tax: { sales_tax_amount: "-10", vat_amount: "0" },
      },
    },
  ],
};

/**
 * O valor formatado sai de `formatMoney`, que usa `Intl` — comparar com
 * uma string fixa quebraria conforme a versão do ICU. O teste checa o
 * mesmo formatador que a tela usa.
 */
const money = (raw: string) => formatMoney(parseMoney(raw), "USD");

const QUERY = {
  pageSize: 20,
  sortOrder: "DESC" as const,
  searchTimeGe: 1623812664,
  searchTimeLt: 1623899064,
};

describe("UnsettledView", () => {
  const html = renderToStaticMarkup(<UnsettledView data={SAMPLE} query={QUERY} />);

  it("mostra os somatórios do cabeçalho", () => {
    expect(html).toContain("Transações a liquidar");
    expect(html).toContain(money("100")); // sum_est_settlement_amount
    expect(html).toContain(money("-10")); // sum_est_fee_amount
  });

  it("soma o frete da página, que a resposta não traz no cabeçalho", () => {
    expect(html).toContain("não traz somatório de frete");
    expect(html).toContain(money("-70"));
  });

  it("confirma a fórmula do exemplo, que fecha em 130", () => {
    expect(html).toContain("Conferência da fórmula");
    expect(html).toContain("fecha em 1 de 1 transação(ões)");
  });

  it("não compara os somatórios enquanto houver próxima página", () => {
    // O cabeçalho é do conjunto inteiro; a página é só um pedaço.
    expect(html).toContain("Não conferido: esta página não é o conjunto inteiro");
  });

  it("monta a URL da próxima página repetindo a janela de datas", () => {
    expect(html).toContain("https://open-api.tiktokglobalshop.com/finance/202507/orders/unsettled");
    expect(html).toContain("search_time_ge=1623812664");
    expect(html).toContain("search_time_lt=1623899064");
    expect(html).toContain(
      "page_token=6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq/N5M1kHYcZmtRyv9aVrNv65W7Q6tFA+7D1ud64MPNz5OaT",
    );
    expect(html).toContain("sort_field=order_create_time");
  });

  it("lista a transação com os valores traduzidos e o motivo da pendência", () => {
    expect(html).toContain("Pedido");
    expect(html).toContain("576463220456522968");
    expect(html).toContain(money("200")); // est_revenue_amount
    expect(html).toContain("waiting for deliveery");
  });

  it("marca o pedido entregue, que é o que já tem frete real", () => {
    expect(html).toContain("1 de 1");
    expect(html).not.toContain("não entregue");
  });
});
