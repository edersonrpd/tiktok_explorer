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
  shipping_fee_cofunded_discount?: string;
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
  payment_method_code?: string;
  /** CPF do comprador — obrigatório em pedidos no Brasil. */
  cpf?: string;
  /** Nome completo associado ao CPF, como declarado na nota fiscal. */
  cpf_name?: string;
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

/* ------------------------------------------------------------------------ */
/* Transações por pedido — GET /finance/202501/orders/{id}/statement_transactions */
/* ------------------------------------------------------------------------ */

export interface RevenueBreakdown {
  subtotal_before_discount_amount?: string;
  seller_discount_amount?: string;
  refund_subtotal_before_discount_amount?: string;
  seller_discount_refund_amount?: string;
  cod_service_fee_amount?: string;
  refund_cod_service_fee_amount?: string;
  distant_item_fee_amount?: string;
}

export interface ShippingCostBreakdown {
  actual_shipping_fee_amount?: string;
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
  fbt_free_shipping_fee_amount?: string;
  free_return_subsidy_amount?: string;
  distant_shipping_fee_amount?: string;
  shipping_app_service_fee_amount?: string;
  logistics_service_fee?: string;
  fbt_overall_merchant_subsidy?: string;
  fbt_key_merchant_subsidy?: string;
  tiktok_shop_shipping_incentive_amount?: string;
  /** Custos suplementares que não contribuem diretamente para shipping_cost_amount. */
  supplementary_component?: Record<string, string>;
}

/** Dezenas de fees e taxas específicas de mercado — ver documentação para o significado de cada uma. */
export interface FeeTaxBreakdown {
  fee?: Record<string, string>;
  tax?: Record<string, string>;
}

export interface SkuTransaction {
  sku_id?: string;
  sku_name?: string;
  statement_id?: string;
  product_name?: string;
  quantity?: string;
  settlement_amount?: string;
  revenue_amount?: string;
  revenue_breakdown?: RevenueBreakdown;
  shipping_cost_amount?: string;
  shipping_cost_breakdown?: ShippingCostBreakdown;
  fee_tax_amount?: string;
  fee_tax_breakdown?: FeeTaxBreakdown;
}

export interface TransactionsByOrderData {
  order_id: string;
  order_create_time?: number;
  currency?: string;
  revenue_amount?: string;
  fee_and_tax_amount?: string;
  shipping_cost_amount?: string;
  settlement_amount?: string;
  sku_transactions?: SkuTransaction[];
  total_count?: number;
}

export type TransactionsByOrderResponse = TikTokApiResponse<TransactionsByOrderData>;
