import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatementView } from "./StatementView";
import type { StatementTransactionsData } from "../types/tiktok";

/**
 * Exemplo da própria documentação do Get Transactions by Statement,
 * copiado sem alterações — inclusive as esquisitices que a tela precisa
 * aguentar: valores como string, `"0 "` com espaço sobrando e o
 * `supplementary_component` aninhado dentro do detalhamento de frete.
 */
const SAMPLE: StatementTransactionsData = {
    "next_page_token": "6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq/N5M1kHYcZmtRyv9aVrNv65W7Q6tFA+7D1ud64MPNz5OaT",
    "id": "7238804564097517339",
    "create_time": 1685548800,
    "status": "SETTLED",
    "currency": "GBP",
    "payable_amount": "150",
    "total_reserve_amount": "20",
    "total_settlement_amount": "130",
    "total_settlement_breakdown": {
      "total_revenue_amount": "100",
      "total_shipping_cost_amount": "120",
      "total_fee_tax_amount": "20",
      "total_adjustment_amount": "0"
    },
    "total_count": 2,
    "transactions": [
      {
        "id": "1636700041413599290",
        "type": "ORDER",
        "order_id": "576463220456522968",
        "order_create_time": 1685548800,
        "adjustment_id": "7238804564097517332",
        "adjustment_order_id": "576463220456522968",
        "adjustment_amount": "170",
        "settlement_amount": "130",
        "revenue_amount": "200",
        "revenue_breakdown": {
          "subtotal_before_discount_amount": "30",
          "refund_subtotal_before_discount_amount": "-20",
          "seller_discount_amount": "10",
          "seller_discount_refund_amount": "12",
          "cod_service_fee_amount": "10",
          "refund_cod_service_fee_amount": "-10",
          "distant_item_fee_amount": "0"
        },
        "shipping_cost_amount": "-70",
        "shipping_cost_breakdown": {
          "actual_shipping_fee_amount": "0",
          "international_leg_logistics_amount": "0",
          "shipping_fee_discount_amount": "0",
          "customer_paid_shipping_fee_amount": "-10",
          "return_shipping_fee_amount": "-10",
          "replacement_shipping_fee_amount": "12",
          "exchange_shipping_fee_amount": "0",
          "signature_confirmation_fee_amount": "10",
          "shipping_insurance_fee_amount": "-10",
          "fbt_fulfillment_fee_reimbursement_amount": "5",
          "return_shipping_label_fee_amount": "5",
          "seller_self_shipping_service_fee_amount": "5",
          "return_shipping_fee_paid_buyer_amount": "5",
          "failed_delivery_subsidy_amount": "5",
          "shipping_fee_guarantee_reimbursement": "0",
          "fbt_free_shipping_fee_amount": "0",
          "free_return_subsidy_amount": "0",
          "distant_shipping_fee_amount": "0",
          "shipping_app_service_fee_amount": "0",
          "logistics_service_fee": "0",
          "fbt_overall_merchant_subsidy": "0",
          "fbt_key_merchant_subsidy": "0",
          "tiktok_shop_shipping_incentive_amount": "0",
          "supplementary_component": {
            "platform_shipping_fee_discount_amount": "-10",
            "promo_shipping_incentive_amount": "-5",
            "shipping_fee_subsidy_amount": "5",
            "seller_shipping_fee_discount_amount": "4",
            "customer_shipping_fee_offset_amount": "23",
            "fbm_shipping_cost_amount": "20",
            "fbt_shipping_cost_amount": "30",
            "fbt_fulfillment_fee_amount": "-30",
            "fbt_fulfillment_fee_reimbursement_amount": "5",
            "return_refund_subsidy_amount": "5",
            "refunded_customer_shipping_fee_amount": "5",
            "customer_shipping_fee": "5",
            "refund_customer_shipping_fee": "1"
          }
        },
        "fee_tax_amount": "-30",
        "fee_tax_breakdown": {
          "fee": {
            "platform_commission_amount": "20",
            "referral_fee_amount": "11",
            "refund_administration_fee_amount": "10",
            "transaction_fee_amount": "0",
            "credit_card_handling_fee_amount": "0",
            "affiliate_commission_amount": "5",
            "affiliate_commission_amount_before_pit": "3",
            "affiliate_partner_commission_amount": "12",
            "affiliate_ads_commission_amount": "10",
            "sfp_service_fee_amount": "5",
            "live_specials_fee_amount": "4",
            "bonus_cashback_service_fee_amount": "2",
            "mall_service_fee_amount": "12",
            "voucher_xtra_service_fee_amount": "10",
            "flash_sales_service_fee_amount": "12",
            "cofunded_promotion_service_fee_amount": "4",
            "pre_order_service_fee_amount": "10",
            "tsp_commission_amount": "10",
            "dt_handling_fee_amount": "10",
            "epr_pob_service_fee_amount": "10",
            "seller_paylater_handling_fee_amount": "-10",
            "fee_per_item_sold_amount": "0",
            "cofunded_creator_bonus_amount": "-10",
            "dynamic_commission_amount": "5",
            "external_affiliate_marketing_fee_amount": "10",
            "vn_fix_infrastructure_fee": "0",
            "affiliate_commission_deposit": "0",
            "affiliate_commission_release": "0",
            "tap_shop_ads_commission": "0",
            "shipping_fee_guarantee_service_fee": "0",
            "installation_service_fee": "0",
            "campaign_resource_fee": "0",
            "platform_special_service_fee_amount": "0",
            "smart_promotion_fee_amount": "0",
            "gmv_max_ad_fee_amount": "0",
            "platform_semi_managed_commission_fee": "0",
            "platform_semi_managed_commission_fee_tax": "0",
            "campaign_period_fee_cfp_amount": "0",
            "campaign_period_fee_sp_amount": "0",
            "campaign_period_fee_sp_tax_amount": "0",
            "campaign_period_fee_cfp_tax_amount": "0",
            "seller_growth_fee_amount": "0",
            "category_led_campaign_fee_amount": "0",
            "category_led_campaign_fee_tax_amount": "0",
            "brand_amplification_program_commission": "0",
            "brand_amplification_program_fee_tax": "0",
            "brand_campaign_fee": "0",
            "brand_campaign_fee_tax": "0",
            "failed_delivery_shipping_fee": "0",
            "buyer_fault_return_shipping_fee": "0",
            "insurance_fee": "0",
            "gmv_max_coupon_fee": "0",
            "cps_shop_ads_commission_tax_amount": "0",
            "shipping_insurance_fee_tax_amount": "0"
          },
          "tax": {
            "vat_amount": "30",
            "import_vat_amount": "10",
            "customs_duty_amount": "5",
            "customs_clearance_amount": "4",
            "sst_amount": "3",
            "gst_amount": "1",
            "iva_amount": "5",
            "isr_amount": "5",
            "anti_dumping_duty_amount": "10",
            "local_vat_amount": "10",
            "pit_amount": "10",
            "sales_tax_referral_fee_amount": "0",
            "smart_promotion_fee_tax_amount": "0",
            "cedular_tax": "0"
          }
        },
        "supplementary_component": {
          "customer_payment_amount": "0",
          "customer_refund_amount": "0",
          "platform_discount_amount": "10",
          "platform_discount_refund_amount": "1",
          "seller_cofunded_discount_amount": "44",
          "seller_cofunded_discount_refund_amount": "23",
          "platform_cofunded_discount_amount": "11",
          "platform_cofunded_discount_refund_amount": "10",
          "retail_delivery_fee_amount": "-1",
          "retail_delivery_fee_payment_amount": "4",
          "retail_delivery_fee_refund_amount": "2",
          "sales_tax_amount": "10",
          "sales_tax_payment_amount": "0",
          "sales_tax_refund_amount": "0 "
        },
        "reserve_id": "56789910",
        "reserve_amount": "100",
        "associated_order_id": "78217892102382101",
        "reserve_status": "Collected",
        "estimated_release_time": "1685548800"
      }
    ]
  };

const QUERY = { statementId: "7238804564097517339", pageSize: 20, sortOrder: "DESC" as const };

describe("StatementView", () => {
  const html = renderToStaticMarkup(<StatementView data={SAMPLE} query={QUERY} />);

  it("mostra os totais do extrato", () => {
    expect(html).toContain("Extrato 7238804564097517339");
    expect(html).toContain("150,00 GBP"); // payable_amount
    expect(html).toContain("130,00 GBP"); // total_settlement_amount
  });

  it("aponta a divergência da fórmula do exemplo em vez de escondê-la", () => {
    // 100 − 120 − 20 − 0 = 40, mas o exemplo declara 130.
    expect(html).toContain("Conferência das fórmulas");
    expect(html).toContain("calculado -40,00 GBP");
  });

  it("monta o caminho da próxima página com o page_token literal", () => {
    expect(html).toContain("page_token=6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq/N5M1kHYcZmtRyv9aVrNv65W7Q6tFA+7D1ud64MPNz5OaT");
    expect(html).toContain("page_size=20");
    expect(html).toContain("sort_field=order_create_time");
  });

  it("lista a transação com os valores traduzidos", () => {
    expect(html).toContain("Pedido");
    expect(html).toContain("576463220456522968");
    expect(html).toContain("200,00 GBP"); // revenue_amount
  });
});
