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
