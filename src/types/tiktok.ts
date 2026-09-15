/**
 * Tipagem da resposta do endpoint GET /product/202309/products/{product_id}
 * da API do TikTok Shop (Open API).
 *
 * Campos opcionais refletem o comportamento real da API: nem todo produto
 * tem vídeo, marca, EAN etc. Com `noUncheckedIndexedAccess` habilitado,
 * o compilador força a checagem antes do uso.
 */

/** Envelope padrão de toda resposta da Open API do TikTok Shop. */
export interface TikTokApiResponse<T> {
  code: number;
  message: string;
  request_id: string;
  data?: T;
}

export interface AuditInfo {
  status?: string;
  pre_approved_reasons?: string[];
}

export interface Brand {
  id?: string;
  name?: string;
}

export interface CategoryChain {
  id: string;
  parent_id?: string;
  local_name: string;
  is_leaf: boolean;
}

export interface ImageInfo {
  height?: number;
  width?: number;
  thumb_urls?: string[];
  uri?: string;
  urls?: string[];
}

export interface VideoInfo {
  id?: string;
  cover_url?: string;
  format?: string;
  url?: string;
  width?: number;
  height?: number;
  size?: number;
}

export interface SalesAttribute {
  id?: string;
  name?: string;
  value_id?: string;
  value_name?: string;
  sku_img?: ImageInfo;
}

export interface Price {
  currency?: string;
  sale_price?: string;
  tax_exclusive_price?: string;
  unit_price?: string;
}

export interface Inventory {
  warehouse_id?: string;
  quantity?: number;
}

export interface IdentifierCode {
  code?: string;
  type?: string;
}

export interface SkuStatusInfo {
  status?: string;
}

export interface Sku {
  id: string;
  seller_sku?: string;
  price?: Price;
  inventory?: Inventory[];
  identifier_code?: IdentifierCode;
  sales_attributes?: SalesAttribute[];
  status_info?: SkuStatusInfo;
  external_sku_id?: string;
}

export interface ProductAttributeValue {
  id?: string;
  name?: string;
}

export interface ProductAttribute {
  id?: string;
  name?: string;
  values?: ProductAttributeValue[];
}

export interface PackageDimensions {
  length?: string;
  width?: string;
  height?: string;
  unit?: string;
}

export interface PackageWeight {
  value?: string;
  unit?: string;
}

export interface Product {
  id: string;
  title?: string;
  status?: string;
  description?: string;
  audit?: AuditInfo;
  brand?: Brand;
  category_chains?: CategoryChain[];
  main_images?: ImageInfo[];
  video?: VideoInfo;
  skus?: Sku[];
  product_attributes?: ProductAttribute[];
  package_dimensions?: PackageDimensions;
  package_weight?: PackageWeight;
  external_product_id?: string;
  create_time?: number;
  update_time?: number;
  is_cod_allowed?: boolean;
  is_not_for_sale?: boolean;
}

export type ProductResponse = TikTokApiResponse<Product>;

/* ------------------------------------------------------------------ */
/* Pedidos — GET /order/202507/orders?ids=...                          */
/* ------------------------------------------------------------------ */

export interface OrderPayment {
  currency?: string;
  sub_total?: string;
  shipping_fee?: string;
  seller_discount?: string;
  platform_discount?: string;
  payment_platform_discount?: string;
  total_amount?: string;
  original_total_product_price?: string;
  original_shipping_fee?: string;
  shipping_fee_seller_discount?: string;
  shipping_fee_platform_discount?: string;
  tax?: string;
  product_tax?: string;
  shipping_fee_tax?: string;
  small_order_fee?: string;
  retail_delivery_fee?: string;
  buyer_service_fee?: string;
  handling_fee?: string;
  shipping_insurance_fee?: string;
  item_insurance_fee?: string;
}

export interface DistrictInfo {
  address_level_name?: string;
  address_name?: string;
  address_level?: string;
  iso_code?: string;
}

export interface RecipientAddress {
  full_address?: string;
  phone_number?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  region_code?: string;
  postal_code?: string;
  post_town?: string;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  address_line4?: string;
  address_detail?: string;
  district_info?: DistrictInfo[];
}

export interface ItemTax {
  tax_type?: string;
  tax_amount?: string;
  tax_rate?: string;
}

export interface CombinedListingSku {
  sku_id?: string;
  sku_count?: number;
  product_id?: string;
  seller_sku?: string;
}

export interface OrderLineItem {
  id: string;
  sku_id?: string;
  product_id?: string;
  product_name?: string;
  sku_name?: string;
  sku_image?: string;
  seller_sku?: string;
  original_price?: string;
  sale_price?: string;
  currency?: string;
  platform_discount?: string;
  seller_discount?: string;
  display_status?: string;
  package_status?: string;
  package_id?: string;
  sku_type?: string;
  cancel_reason?: string;
  cancel_user?: string;
  tracking_number?: string;
  shipping_provider_name?: string;
  shipping_provider_id?: string;
  is_gift?: boolean;
  rts_time?: number;
  item_tax?: ItemTax[];
  combined_listing_skus?: CombinedListingSku[];
  retail_delivery_fee?: string;
  small_order_fee?: string;
  buyer_service_fee?: string;
}

export interface OrderPackage {
  id?: string;
}

export interface HandlingDuration {
  days?: string;
  type?: string;
}

export interface Order {
  id: string;
  status?: string;
  user_id?: string;
  buyer_email?: string;
  buyer_message?: string;
  buyer_nickname?: string;
  seller_note?: string;
  create_time?: number;
  paid_time?: number;
  update_time?: number;
  rts_time?: number;
  delivery_time?: number;
  cancel_time?: number;
  collection_time?: number;
  delivery_sla_time?: number;
  shipping_due_time?: number;
  tracking_number?: string;
  shipping_provider?: string;
  shipping_provider_id?: string;
  shipping_type?: string;
  delivery_type?: string;
  delivery_option_name?: string;
  fulfillment_type?: string;
  warehouse_id?: string;
  cancel_reason?: string;
  cancellation_initiator?: string;
  is_buyer_request_cancel?: boolean;
  is_cod?: boolean;
  is_sample_order?: boolean;
  is_on_hold_order?: boolean;
  is_replacement_order?: boolean;
  replaced_order_id?: string;
  split_or_combine_tag?: string;
  payment_method_name?: string;
  commerce_platform?: string;
  order_type?: string;
  handling_duration?: HandlingDuration;
  payment?: OrderPayment;
  recipient_address?: RecipientAddress;
  line_items?: OrderLineItem[];
  packages?: OrderPackage[];
}

export interface OrderListData {
  orders?: Order[];
}

export type OrderResponse = TikTokApiResponse<OrderListData>;

/* -------------------------------------------------------------------------
 * GET /finance/202501/statements/{statement_id}/statement_transactions
 * (Get Transactions by Statement)
 *
 * TODO VALOR MONETÁRIO É STRING nesta API — inclusive os negativos e o
 * zero ("0"). Nunca são números: a plataforma evita ponto flutuante e
 * devolve o decimal exato. Alguns campos voltam vazios (ou com espaço
 * sobrando, como "0 " no exemplo da documentação) quando não se aplicam
 * ao mercado da loja, daí tudo ser opcional e a leitura passar por
 * `parseAmount` (src/lib/statements.ts).
 * ---------------------------------------------------------------------- */

/** Parcelas que compõem `revenue_amount`. */
export interface RevenueBreakdown {
  subtotal_before_discount_amount?: string;
  refund_subtotal_before_discount_amount?: string;
  seller_discount_amount?: string;
  seller_discount_refund_amount?: string;
  cod_service_fee_amount?: string;
  refund_cod_service_fee_amount?: string;
  distant_item_fee_amount?: string;
}

/** Custos de referência do frete — NÃO somam em `shipping_cost_amount`. */
export interface ShippingSupplementaryComponent {
  platform_shipping_fee_discount_amount?: string;
  promo_shipping_incentive_amount?: string;
  shipping_fee_subsidy_amount?: string;
  seller_shipping_fee_discount_amount?: string;
  customer_shipping_fee_offset_amount?: string;
  fbm_shipping_cost_amount?: string;
  fbt_shipping_cost_amount?: string;
  fbt_fulfillment_fee_amount?: string;
  /** Descontinuado: usar shipping_cost_breakdown.fbt_fulfillment_fee_reimbursement_amount. */
  fbt_fulfillment_fee_reimbursement_amount?: string;
  return_refund_subsidy_amount?: string;
  refunded_customer_shipping_fee_amount?: string;
  customer_shipping_fee?: string;
  refund_customer_shipping_fee?: string;
}

/** Parcelas que compõem `shipping_cost_amount`. */
export interface ShippingCostBreakdown {
  actual_shipping_fee_amount?: string;
  international_leg_logistics_amount?: string;
  shipping_fee_discount_amount?: string;
  customer_paid_shipping_fee_amount?: string;
  return_shipping_fee_amount?: string;
  replacement_shipping_fee_amount?: string;
  exchange_shipping_fee_amount?: string;
  signature_confirmation_fee_amount?: string;
  shipping_insurance_fee_amount?: string;
  fbt_fulfillment_fee_reimbursement_amount?: string;
  return_shipping_label_fee_amount?: string;
  seller_self_shipping_service_fee_amount?: string;
  return_shipping_fee_paid_buyer_amount?: string;
  failed_delivery_subsidy_amount?: string;
  shipping_fee_guarantee_reimbursement?: string;
  fbt_free_shipping_fee_amount?: string;
  free_return_subsidy_amount?: string;
  distant_shipping_fee_amount?: string;
  shipping_app_service_fee_amount?: string;
  logistics_service_fee?: string;
  fbt_overall_merchant_subsidy?: string;
  fbt_key_merchant_subsidy?: string;
  tiktok_shop_shipping_incentive_amount?: string;
  supplementary_component?: ShippingSupplementaryComponent;
}

/** Tarifas cobradas pela plataforma (parte de `fee_tax_amount`). */
export interface TransactionFeeBreakdown {
  platform_commission_amount?: string;
  referral_fee_amount?: string;
  refund_administration_fee_amount?: string;
  transaction_fee_amount?: string;
  credit_card_handling_fee_amount?: string;
  affiliate_commission_amount?: string;
  affiliate_commission_amount_before_pit?: string;
  affiliate_partner_commission_amount?: string;
  affiliate_ads_commission_amount?: string;
  sfp_service_fee_amount?: string;
  live_specials_fee_amount?: string;
  bonus_cashback_service_fee_amount?: string;
  mall_service_fee_amount?: string;
  voucher_xtra_service_fee_amount?: string;
  flash_sales_service_fee_amount?: string;
  cofunded_promotion_service_fee_amount?: string;
  pre_order_service_fee_amount?: string;
  tsp_commission_amount?: string;
  dt_handling_fee_amount?: string;
  epr_pob_service_fee_amount?: string;
  seller_paylater_handling_fee_amount?: string;
  fee_per_item_sold_amount?: string;
  cofunded_creator_bonus_amount?: string;
  dynamic_commission_amount?: string;
  external_affiliate_marketing_fee_amount?: string;
  vn_fix_infrastructure_fee?: string;
  affiliate_commission_deposit?: string;
  affiliate_commission_release?: string;
  tap_shop_ads_commission?: string;
  shipping_fee_guarantee_service_fee?: string;
  installation_service_fee?: string;
  campaign_resource_fee?: string;
  platform_special_service_fee_amount?: string;
  smart_promotion_fee_amount?: string;
  gmv_max_ad_fee_amount?: string;
  platform_semi_managed_commission_fee?: string;
  platform_semi_managed_commission_fee_tax?: string;
  campaign_period_fee_cfp_amount?: string;
  campaign_period_fee_sp_amount?: string;
  campaign_period_fee_sp_tax_amount?: string;
  campaign_period_fee_cfp_tax_amount?: string;
  seller_growth_fee_amount?: string;
  category_led_campaign_fee_amount?: string;
  category_led_campaign_fee_tax_amount?: string;
  brand_amplification_program_commission?: string;
  brand_amplification_program_fee_tax?: string;
  brand_campaign_fee?: string;
  brand_campaign_fee_tax?: string;
  failed_delivery_shipping_fee?: string;
  buyer_fault_return_shipping_fee?: string;
  insurance_fee?: string;
  gmv_max_coupon_fee?: string;
  cps_shop_ads_commission_tax_amount?: string;
  shipping_insurance_fee_tax_amount?: string;
}

/** Impostos recolhidos pela plataforma (parte de `fee_tax_amount`). */
export interface TransactionTaxBreakdown {
  vat_amount?: string;
  import_vat_amount?: string;
  customs_duty_amount?: string;
  customs_clearance_amount?: string;
  sst_amount?: string;
  gst_amount?: string;
  iva_amount?: string;
  isr_amount?: string;
  anti_dumping_duty_amount?: string;
  local_vat_amount?: string;
  pit_amount?: string;
  sales_tax_referral_fee_amount?: string;
  smart_promotion_fee_tax_amount?: string;
  cedular_tax?: string;
}

export interface FeeTaxBreakdown {
  fee?: TransactionFeeBreakdown;
  tax?: TransactionTaxBreakdown;
}

/** Valores de referência da transação — NÃO somam no repasse. */
export interface TransactionSupplementaryComponent {
  customer_payment_amount?: string;
  customer_refund_amount?: string;
  platform_discount_amount?: string;
  platform_discount_refund_amount?: string;
  seller_cofunded_discount_amount?: string;
  seller_cofunded_discount_refund_amount?: string;
  platform_cofunded_discount_amount?: string;
  platform_cofunded_discount_refund_amount?: string;
  retail_delivery_fee_amount?: string;
  retail_delivery_fee_payment_amount?: string;
  retail_delivery_fee_refund_amount?: string;
  sales_tax_amount?: string;
  sales_tax_payment_amount?: string;
  sales_tax_refund_amount?: string;
}

/**
 * Uma linha do extrato. Cada transação é UM pedido, UM ajuste ou UMA
 * movimentação de reserva — os campos preenchidos mudam conforme `type`.
 */
export interface StatementTransaction {
  id: string;
  /** ORDER, RESERVE ou um dos tipos de ajuste (ver src/lib/statements.ts). */
  type?: string;
  order_id?: string;
  order_create_time?: number;
  adjustment_id?: string;
  adjustment_order_id?: string;
  adjustment_amount?: string;
  settlement_amount?: string;
  revenue_amount?: string;
  revenue_breakdown?: RevenueBreakdown;
  shipping_cost_amount?: string;
  shipping_cost_breakdown?: ShippingCostBreakdown;
  fee_tax_amount?: string;
  fee_tax_breakdown?: FeeTaxBreakdown;
  supplementary_component?: TransactionSupplementaryComponent;
  reserve_id?: string;
  reserve_amount?: string;
  associated_order_id?: string;
  /** COLLECTED (retido) ou RELEASED (liberado). */
  reserve_status?: string;
  /** Epoch em segundos, mas vem como string nesta API. */
  estimated_release_time?: string;
}

/** Parcelas que compõem `total_settlement_amount`. */
export interface StatementSettlementBreakdown {
  total_revenue_amount?: string;
  total_shipping_cost_amount?: string;
  total_fee_tax_amount?: string;
  total_adjustment_amount?: string;
}

/** `data` de GET /finance/202501/statements/{id}/statement_transactions. */
export interface StatementTransactionsData {
  next_page_token?: string;
  /** ID do extrato (o mesmo informado no path). */
  id?: string;
  create_time?: number;
  /** Só existe SETTLED nesta API. */
  status?: string;
  currency?: string;
  payable_amount?: string;
  total_reserve_amount?: string;
  total_settlement_amount?: string;
  total_settlement_breakdown?: StatementSettlementBreakdown;
  /** Total de transações do extrato inteiro, não da página. */
  total_count?: number;
  transactions?: StatementTransaction[];
}

export type StatementTransactionsResponse = TikTokApiResponse<StatementTransactionsData>;
