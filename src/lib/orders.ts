import type { OrderLineItem } from "../types/tiktok";

/**
 * Agrupamento dos itens do pedido por SKU.
 *
 * Conforme o Order API overview, cada `line_items[]` representa UMA
 * unidade: quem compra 2 camisetas iguais gera duas entradas com o mesmo
 * `sku_id` e IDs de linha diferentes. Exibir a lista crua duplicaria
 * linhas sem informar quantidade — inútil para conferir contra o ERP.
 * Aqui as unidades do mesmo SKU viram uma linha com a quantidade somada.
 */

export interface GroupedLineItem {
  key: string;
  quantity: number;
  productName: string | undefined;
  skuName: string | undefined;
  skuImage: string | undefined;
  sellerSku: string | undefined;
  skuId: string | undefined;
  salePrice: string | undefined;
  currency: string | undefined;
  /** Unidades do mesmo SKU saíram com preços diferentes (raro, mas possível). */
  priceVaries: boolean;
  /** Status distintos entre as unidades, na ordem de aparição. */
  statuses: string[];
}

/** Chave de agrupamento: o SKU quando existe, com fallbacks estáveis. */
function groupKey(item: OrderLineItem): string {
  if (item.sku_id !== undefined && item.sku_id !== "") return `sku:${item.sku_id}`;
  if (item.seller_sku !== undefined && item.seller_sku !== "") {
    return `seller:${item.product_id ?? ""}|${item.seller_sku}`;
  }
  return `line:${item.id}`;
}

export function groupLineItems(items: OrderLineItem[]): GroupedLineItem[] {
  const groups = new Map<string, GroupedLineItem>();

  for (const item of items) {
    const key = groupKey(item);
    const existing = groups.get(key);
    const status = item.display_status;

    if (existing === undefined) {
      groups.set(key, {
        key,
        quantity: 1,
        productName: item.product_name,
        skuName: item.sku_name,
        skuImage: item.sku_image,
        sellerSku: item.seller_sku,
        skuId: item.sku_id,
        salePrice: item.sale_price,
        currency: item.currency,
        priceVaries: false,
        statuses: status !== undefined && status !== "" ? [status] : [],
      });
      continue;
    }

    existing.quantity += 1;
    if (item.sale_price !== existing.salePrice) existing.priceVaries = true;
    if (status !== undefined && status !== "" && !existing.statuses.includes(status)) {
      existing.statuses.push(status);
    }
  }

  return [...groups.values()];
}

/** Total de unidades do pedido (soma das linhas, já que cada linha é 1 unidade). */
export function totalUnits(items: OrderLineItem[]): number {
  return items.length;
}
