/**
 * Rótulos em português para os campos do extrato.
 *
 * A documentação do endpoint tem ~70 campos de detalhamento com nomes
 * longos em inglês (`cofunded_promotion_service_fee_amount`). Traduzir na
 * exibição é o que torna a tela útil para quem confere o repasse. Campos
 * sem tradução aparecem com o nome original — nunca somem da tela.
 */

/** Tipos de transação (campo `type`). */
export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  ORDER: "Pedido",
  RESERVE: "Reserva",
  CHARGE_BACK: "Chargeback",
  CUSTOMER_SERVICE_COMPENSATION: "Compensação ao cliente",
  DEDUCTIONS_INCURRED_BY_SELLER: "Dedução por responsabilidade do vendedor",
  GMV_PAYMENT_FOR_ADS: "Pagamento de anúncios com GMV",
  PLATFORM_COMMISSION_ADJUSTMENT: "Ajuste de comissão da plataforma",
  PLATFORM_COMMISSION_COMPENSATION: "Compensação de comissão da plataforma",
  PLATFORM_PENALTY: "Penalidade da plataforma",
  PROMOTION_ADJUSTMENT: "Ajuste de promoção",
  REBATE: "Rebate de taxa de indicação",
  PLATFORM_COMPENSATION: "Compensação da plataforma",
  PLATFORM_REIMBURSEMENT: "Reembolso da plataforma",
  COFUNDED_CREATOR_REWARDS: "Prêmios a criadores (co-financiado)",
  STAMP_DUTY: "Imposto de selo",
  FBT_WAREHOUSE_SERVICE_FEE: "Armazenagem FBT",
  LOGISTICS_REIMBURSEMENT: "Reembolso de logística",
  SHIPPING_FEE_ADJUSTMENT: "Ajuste de frete",
  SHIPPING_FEE_COMPENSATION: "Compensação de frete",
  SHIPPING_FEE_REBATE: "Rebate de frete",
  SAMPLE_SHIPPING_FEE: "Frete de amostra",
  SELLER_MISSION_REWARD: "Prêmio por missão do vendedor",
  OTHER_ADJUSTMENT: "Outro ajuste",
};

export function labelForType(type: string | undefined): string {
  if (type === undefined || type === "") return "(sem tipo)";
  return TRANSACTION_TYPE_LABELS[type] ?? type;
}

/** Transações que não são pedido nem reserva são ajustes da plataforma. */
export function isAdjustmentType(type: string | undefined): boolean {
  return type !== undefined && type !== "" && type !== "ORDER" && type !== "RESERVE";
}

/** `revenue_breakdown` — o que compõe a receita. */
export const REVENUE_LABELS: Record<string, string> = {
  subtotal_before_discount_amount: "Subtotal antes de descontos (venda bruta)",
  refund_subtotal_before_discount_amount: "Subtotal reembolsado antes de descontos",
  seller_discount_amount: "Desconto do vendedor",
  seller_discount_refund_amount: "Desconto do vendedor devolvido",
  cod_service_fee_amount: "Taxa de serviço COD",
  refund_cod_service_fee_amount: "Reembolso da taxa de serviço COD",
  distant_item_fee_amount: "Taxa de item para região distante",
};

/** `shipping_cost_breakdown` — o que compõe o custo de frete. */
export const SHIPPING_LABELS: Record<string, string> = {
  actual_shipping_fee_amount: "Frete real cobrado pela transportadora",
  international_leg_logistics_amount: "Perna internacional (cross-border)",
  shipping_fee_discount_amount: "Subsídios e incentivos de frete da plataforma",
  customer_paid_shipping_fee_amount: "Frete pago pelo cliente",
  return_shipping_fee_amount: "Frete de devolução",
  replacement_shipping_fee_amount: "Frete de substituição",
  exchange_shipping_fee_amount: "Frete de troca",
  signature_confirmation_fee_amount: "Confirmação de assinatura na entrega",
  shipping_insurance_fee_amount: "Seguro de frete",
  fbt_fulfillment_fee_reimbursement_amount: "Reembolso da taxa de fulfillment FBT",
  return_shipping_label_fee_amount: "Etiqueta de devolução (paga pelo cliente)",
  seller_self_shipping_service_fee_amount: "Taxa de envio por logística própria",
  return_shipping_fee_paid_buyer_amount: "Reembolso do frete de devolução pago pelo cliente",
  failed_delivery_subsidy_amount: "Subsídio de entrega não realizada",
  shipping_fee_guarantee_reimbursement: "Reembolso do programa de garantia de frete",
  fbt_free_shipping_fee_amount: "Frete grátis FBT custeado pelo vendedor",
  free_return_subsidy_amount: "Subsídio de devolução grátis",
  distant_shipping_fee_amount: "Frete para região distante",
  shipping_app_service_fee_amount: "Taxa do app de envio",
  logistics_service_fee: "Taxa de serviço logístico",
  fbt_overall_merchant_subsidy: "Subsídio FBT geral",
  fbt_key_merchant_subsidy: "Subsídio FBT de vendedor estratégico",
  tiktok_shop_shipping_incentive_amount: "Incentivo de frete do TikTok Shop",
};

/** `shipping_cost_breakdown.supplementary_component` — só referência. */
export const SHIPPING_SUPPLEMENTARY_LABELS: Record<string, string> = {
  platform_shipping_fee_discount_amount: "Desconto de frete por campanha",
  promo_shipping_incentive_amount: "Incentivo de frete promocional",
  shipping_fee_subsidy_amount: "Subsídio de frete da plataforma",
  seller_shipping_fee_discount_amount: "Desconto de frete do vendedor",
  customer_shipping_fee_offset_amount: "Compensação do frete pago pelo cliente",
  fbm_shipping_cost_amount: "Custo de frete TikTok Shipping (FBM)",
  fbt_shipping_cost_amount: "Custo de frete FBT",
  fbt_fulfillment_fee_amount: "Taxa de fulfillment FBT",
  fbt_fulfillment_fee_reimbursement_amount: "Reembolso de fulfillment FBT (descontinuado)",
  return_refund_subsidy_amount: "Subsídio de devolução/reembolso",
  refunded_customer_shipping_fee_amount: "Frete devolvido ao cliente",
  customer_shipping_fee: "Frete pago pelo cliente",
  refund_customer_shipping_fee: "Reembolso do frete do cliente",
};

/** `fee_tax_breakdown.fee` e `.tax` — tarifas e impostos. */
export const FEE_TAX_LABELS: Record<string, string> = {
  // Tarifas
  platform_commission_amount: "Comissão da plataforma",
  referral_fee_amount: "Taxa de indicação (referral)",
  refund_administration_fee_amount: "Taxa administrativa de reembolso",
  transaction_fee_amount: "Taxa de transação",
  credit_card_handling_fee_amount: "Taxa de processamento de cartão",
  affiliate_commission_amount: "Comissão de afiliado (criador)",
  affiliate_commission_amount_before_pit: "Comissão de afiliado antes do IR",
  affiliate_partner_commission_amount: "Comissão de parceiro afiliado",
  affiliate_ads_commission_amount: "Comissão de afiliado por anúncios",
  sfp_service_fee_amount: "Taxa do programa de frete grátis do vendedor",
  live_specials_fee_amount: "Taxa do programa LIVE Specials",
  bonus_cashback_service_fee_amount: "Taxa do programa de cashback",
  mall_service_fee_amount: "Taxa do TikTok Shop Mall",
  voucher_xtra_service_fee_amount: "Taxa do programa Voucher Xtra",
  flash_sales_service_fee_amount: "Taxa de flash sale",
  cofunded_promotion_service_fee_amount: "Taxa de promoção co-financiada",
  pre_order_service_fee_amount: "Taxa do programa de pré-venda",
  tsp_commission_amount: "Comissão de parceiro TSP",
  dt_handling_fee_amount: "Taxa de manuseio Dilayani Tokopedia",
  epr_pob_service_fee_amount: "Eco-contribuição (EPR)",
  seller_paylater_handling_fee_amount: "Taxa de manuseio PayLater",
  fee_per_item_sold_amount: "Taxa por item vendido",
  cofunded_creator_bonus_amount: "Bônus de criador co-financiado",
  dynamic_commission_amount: "Comissão dinâmica",
  external_affiliate_marketing_fee_amount: "Taxa de afiliados externos",
  vn_fix_infrastructure_fee: "Taxa fixa de infraestrutura",
  affiliate_commission_deposit: "Depósito de comissão de afiliado",
  affiliate_commission_release: "Liberação de depósito de comissão",
  tap_shop_ads_commission: "Comissão de anúncios TAP",
  shipping_fee_guarantee_service_fee: "Taxa do programa de garantia de frete",
  installation_service_fee: "Taxa de serviço de instalação",
  campaign_resource_fee: "Taxa de recursos de campanha",
  platform_special_service_fee_amount: "Taxa de serviço especial da plataforma",
  smart_promotion_fee_amount: "Taxa de Smart Promotion",
  gmv_max_ad_fee_amount: "Taxa de anúncios GMV Max",
  platform_semi_managed_commission_fee: "Comissão semi-gerenciada",
  platform_semi_managed_commission_fee_tax: "Imposto sobre a comissão semi-gerenciada",
  campaign_period_fee_cfp_amount: "Taxa de período de campanha (co-financiada)",
  campaign_period_fee_sp_amount: "Taxa de período de campanha (Smart Promotion)",
  campaign_period_fee_sp_tax_amount: "Imposto da taxa de campanha (Smart Promotion)",
  campaign_period_fee_cfp_tax_amount: "Imposto da taxa de campanha (co-financiada)",
  seller_growth_fee_amount: "Taxa de crescimento do vendedor",
  category_led_campaign_fee_amount: "Taxa de campanha por categoria",
  category_led_campaign_fee_tax_amount: "Imposto da campanha por categoria",
  brand_amplification_program_commission: "Comissão do Brand Amplification",
  brand_amplification_program_fee_tax: "Imposto do Brand Amplification",
  brand_campaign_fee: "Taxa de campanha de marca",
  brand_campaign_fee_tax: "Imposto da campanha de marca",
  failed_delivery_shipping_fee: "Frete de entrega não realizada",
  buyer_fault_return_shipping_fee: "Frete de devolução por culpa do comprador",
  insurance_fee: "Prêmio de seguro",
  gmv_max_coupon_fee: "Custo de cupons GMV Max",
  cps_shop_ads_commission_tax_amount: "Imposto sobre a taxa de anúncios GMV Max",
  shipping_insurance_fee_tax_amount: "Imposto sobre o seguro de frete",
  // Impostos
  vat_amount: "VAT (cross-border)",
  import_vat_amount: "VAT de importação",
  customs_duty_amount: "Direitos aduaneiros",
  customs_clearance_amount: "Desembaraço aduaneiro",
  sst_amount: "SST (Malásia)",
  gst_amount: "GST (Singapura)",
  iva_amount: "IVA (México)",
  isr_amount: "ISR (México)",
  anti_dumping_duty_amount: "Direito antidumping",
  local_vat_amount: "VAT local",
  pit_amount: "Imposto de renda retido (PIT)",
  sales_tax_referral_fee_amount: "Sales tax sobre a taxa de indicação",
  smart_promotion_fee_tax_amount: "Imposto da taxa de Smart Promotion",
  cedular_tax: "Imposto cedular (Guanajuato)",
};

/** `supplementary_component` da transação — valores de referência. */
export const TRANSACTION_SUPPLEMENTARY_LABELS: Record<string, string> = {
  customer_payment_amount: "Total pago pelo cliente",
  customer_refund_amount: "Total reembolsado ao cliente",
  platform_discount_amount: "Desconto da plataforma",
  platform_discount_refund_amount: "Desconto da plataforma estornado",
  seller_cofunded_discount_amount: "Parte do vendedor em voucher co-financiado",
  seller_cofunded_discount_refund_amount: "Parte do vendedor devolvida",
  platform_cofunded_discount_amount: "Parte da plataforma em voucher co-financiado",
  platform_cofunded_discount_refund_amount: "Parte da plataforma devolvida",
  retail_delivery_fee_amount: "Retail delivery fee (Colorado)",
  retail_delivery_fee_payment_amount: "Retail delivery fee cobrada",
  retail_delivery_fee_refund_amount: "Retail delivery fee estornada",
  sales_tax_amount: "Sales tax",
  sales_tax_payment_amount: "Sales tax cobrada",
  sales_tax_refund_amount: "Sales tax estornada",
};

/** `total_settlement_breakdown` — o resumo do extrato. */
export const STATEMENT_TOTAL_LABELS: Record<string, string> = {
  total_revenue_amount: "Receita",
  total_shipping_cost_amount: "Custo de frete",
  total_fee_tax_amount: "Taxas e impostos",
  total_adjustment_amount: "Ajustes",
};
