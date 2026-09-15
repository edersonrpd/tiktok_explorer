import type { OrderLineItem } from "../types/tiktok";
import { addMoney, moneyOrZero, parseMoney, ZERO, type Money } from "./money";

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
  /** Preço de tabela da unidade, antes dos descontos. */
  originalPrice: string | undefined;
  currency: string | undefined;
  /** Somas do grupo, para o extrato: preço cheio, preço de venda e descontos. */
  originalTotal: Money;
  saleTotal: Money;
  sellerDiscountTotal: Money;
  platformDiscountTotal: Money;
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
        originalPrice: item.original_price,
        currency: item.currency,
        originalTotal: parseMoney(item.original_price) ?? moneyOrZero(item.sale_price),
        saleTotal: moneyOrZero(item.sale_price),
        sellerDiscountTotal: moneyOrZero(item.seller_discount),
        platformDiscountTotal: moneyOrZero(item.platform_discount),
        priceVaries: false,
        statuses: status !== undefined && status !== "" ? [status] : [],
      });
      continue;
    }

    existing.quantity += 1;
    existing.originalTotal = addMoney(
      existing.originalTotal,
      parseMoney(item.original_price) ?? moneyOrZero(item.sale_price),
    );
    existing.saleTotal = addMoney(existing.saleTotal, parseMoney(item.sale_price));
    existing.sellerDiscountTotal = addMoney(existing.sellerDiscountTotal, parseMoney(item.seller_discount));
    existing.platformDiscountTotal = addMoney(existing.platformDiscountTotal, parseMoney(item.platform_discount));
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

/** Totais monetários das linhas — usados para conferir contra `payment`. */
export interface LineItemTotals {
  original: Money;
  sale: Money;
  sellerDiscount: Money;
  platformDiscount: Money;
}

export function sumLineItems(items: OrderLineItem[]): LineItemTotals {
  const totals: LineItemTotals = {
    original: ZERO,
    sale: ZERO,
    sellerDiscount: ZERO,
    platformDiscount: ZERO,
  };

  for (const item of items) {
    totals.original = addMoney(totals.original, parseMoney(item.original_price) ?? moneyOrZero(item.sale_price));
    totals.sale = addMoney(totals.sale, parseMoney(item.sale_price));
    totals.sellerDiscount = addMoney(totals.sellerDiscount, parseMoney(item.seller_discount));
    totals.platformDiscount = addMoney(totals.platformDiscount, parseMoney(item.platform_discount));
  }

  return totals;
}
