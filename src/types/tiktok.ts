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
  /** Desconto de frete dividido entre plataforma e vendedor. */
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
  gift_retail_price?: string;
  shipping_vat_amount?: string;
  shipping_vat_rate?: string;
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
  delivery_option_id?: string;
  has_updated_recipient_address?: boolean;
  /** SLAs do pedido (epoch em segundos). */
  rts_sla_time?: number;
  tts_sla_time?: number;
  cancel_order_sla_time?: number;
  collection_due_time?: number;
  /** CNPJ da entidade do marketplace, usado na nota fiscal. */
  channel_entity_national_registry_id?: string;
  need_upload_invoice?: string;
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
  /** Código da autorização do pagamento (o "E2085..." do Pix, por exemplo). */
  payment_auth_code?: string;
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
  /** Só documentado no Get Transactions by Statement. */
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
  /** Só documentado no Get Transactions by Statement. */
  shipping_fee_guarantee_reimbursement?: string;
  fbt_free_shipping_fee_amount?: string;
  free_return_subsidy_amount?: string;
  distant_shipping_fee_amount?: string;
  shipping_app_service_fee_amount?: string;
  logistics_service_fee?: string;
  fbt_overall_merchant_subsidy?: string;
  fbt_key_merchant_subsidy?: string;
  /** Só documentado no Get Unsettled Transactions. */
  sfr_reimbursement?: string;
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

/* ------------------------------------------------------------------------ */
/* Transações por extrato                                                     */
/* GET /finance/202501/statements/{id}/statement_transactions                 */
/* ------------------------------------------------------------------------ */

/*
 * O irmão deste endpoint (transações por PEDIDO, acima) devolve os mesmos
 * blocos de detalhamento — `RevenueBreakdown`, `ShippingCostBreakdown` e
 * `FeeTaxBreakdown` são reaproveitados aqui em vez de duplicados.
 *
 * A diferença está no nível: lá cada linha é um SKU de um pedido; aqui
 * cada linha é um pedido, um ajuste ou uma movimentação de reserva do
 * repasse inteiro — e vem com o cabeçalho do extrato (valor a pagar,
 * reserva, totais) que o outro endpoint não tem.
 *
 * TODO VALOR MONETÁRIO É STRING, inclusive negativos e zeros, e às vezes
 * com espaço sobrando ("0 " aparece no exemplo da documentação). A
 * leitura passa sempre por `parseMoney` (src/lib/money.ts).
 */

/** Valores de referência da transação — NÃO entram no cálculo do repasse. */
export type TransactionSupplementaryComponent = Record<string, string>;

/**
 * Uma linha do extrato. Cada transação é UM pedido, UM ajuste ou UMA
 * movimentação de reserva — os campos preenchidos mudam conforme `type`.
 */
export interface StatementTransaction {
  id: string;
  /** ORDER, RESERVE ou um dos tipos de ajuste (ver src/lib/statementLabels.ts). */
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

/* ------------------------------------------------------------------------ */
/* Transações a liquidar — GET /finance/202507/orders/unsettled              */
/* ------------------------------------------------------------------------ */

/*
 * O QUE ESTE ENDPOINT TEM DE DIFERENTE dos dois acima: ele olha para
 * FRENTE, não para trás. As transações aqui ainda NÃO entraram em nenhum
 * extrato — são pedidos e ajustes que o TikTok ainda vai repassar —, e
 * por isso todo valor é uma ESTIMATIVA, com o prefixo `est_`.
 *
 * Consequências práticas para a tipagem:
 *
 * - Não há `statement_id`, `payable_amount` nem `reserve`: nada disso
 *   existe antes do repasse ser fechado.
 * - `currency` vem POR TRANSAÇÃO, não no cabeçalho da resposta como no
 *   extrato — o cabeçalho traz apenas os somatórios.
 * - `estimated_settlement` NÃO é um número: enquanto o pedido não é
 *   entregue a API devolve um texto de política ("x days after delivery")
 *   e só depois passa a devolver um epoch. Por isso é `string`, e a
 *   leitura passa por `parseEstimatedSettlement` (src/lib/unsettled.ts).
 *
 * Os blocos de detalhamento (`RevenueBreakdown`, `ShippingCostBreakdown`,
 * `FeeTaxBreakdown`) são os mesmos dos outros dois endpoints e por isso
 * são reaproveitados — o que muda é o nome do total de cada bloco, que
 * aqui ganha o prefixo `est_`.
 */

/**
 * Uma transação ainda não liquidada: UM pedido ou UM ajuste. Os campos
 * preenchidos mudam conforme `type` — `order_id` para `ORDER`,
 * `adjustment_id`/`adjustment_order_id` para os tipos de ajuste.
 */
export interface UnsettledTransaction {
  id: string;
  /** ORDER ou um dos tipos de ajuste (ver src/lib/statementLabels.ts). */
  type?: string;
  /** Só existe UNSETTLED nesta API. */
  status?: string;
  /** Por transação — este endpoint não traz moeda no cabeçalho. */
  currency?: string;
  /**
   * Epoch em segundos OU texto de política ("x days after delivery"),
   * conforme o pedido já tenha sido entregue ou não. Ver
   * `parseEstimatedSettlement` em src/lib/unsettled.ts.
   */
  estimated_settlement?: string;
  /** Por que a transação ainda não foi liquidada. */
  unsettled_reason?: string;
  order_create_time?: number;
  /** Ausente enquanto o pedido não for entregue. */
  order_delivery_time?: number;
  order_id?: string;
  adjustment_id?: string;
  adjustment_order_id?: string;
  est_adjustment_amount?: string;
  /** Fórmula: est_revenue − est_shipping_cost − est_fee_tax − est_adjustment. */
  est_settlement_amount?: string;
  est_revenue_amount?: string;
  revenue_breakdown?: RevenueBreakdown;
  /** Incompleto enquanto o pedido não for entregue — o frete real ainda não é conhecido. */
  est_shipping_cost_amount?: string;
  shipping_cost_breakdown?: ShippingCostBreakdown;
  est_fee_tax_amount?: string;
  fee_tax_breakdown?: FeeTaxBreakdown;
}

export interface UnsettledTransactionsData {
  next_page_token?: string;
  /** Total do conjunto filtrado, não da página. */
  total_count?: number;
  sum_est_settlement_amount?: string;
  sum_est_revenue_amount?: string;
  sum_est_adjustment_amount?: string;
  sum_est_fee_amount?: string;
  transactions?: UnsettledTransaction[];
}

export type UnsettledTransactionsResponse = TikTokApiResponse<UnsettledTransactionsData>;

/* ------------------------------------------------------------------------ */
/* Lista de repasses — GET /finance/202309/statements                        */
/* ------------------------------------------------------------------------ */

/*
 * ESTE É O ENDPOINT QUE RESPONDE "QUAIS REPASSES EXISTEM". Os outros dois
 * de finanças já pedem um código que veio de algum lugar; é aqui que esse
 * código nasce: a consulta é por JANELA DE DATAS, sem ID nenhum, e cada
 * item traz o `id` que o Get Statement Transactions exige no path.
 *
 * O que vem aqui é o CABEÇALHO de cada repasse — totais e status do
 * pagamento —, não as transações. Para abrir um repasse, use o `id` na
 * consulta de extrato.
 */

/** Um repasse (statement): uma transferência fechada para o vendedor. */
export interface Statement {
  id: string;
  /** Quando o repasse foi gerado. Unix timestamp. */
  statement_time?: number;
  /** PAID, PROCESSING ou FAILED. */
  payment_status?: string;
  /** Quando o dinheiro saiu para o vendedor. Unix timestamp. */
  payment_time?: number;
  payment_id?: string;
  currency?: string;
  /** Valor transferido. */
  settlement_amount?: string;
  revenue_amount?: string;
  fee_amount?: string;
  adjustment_amount?: string;
  shipping_cost_amount?: string;
  /** Vendas líquidas do período do repasse. */
  net_sales_amount?: string;
}

export interface StatementListData {
  next_page_token?: string;
  statements?: Statement[];
}

export type StatementListResponse = TikTokApiResponse<StatementListData>;
