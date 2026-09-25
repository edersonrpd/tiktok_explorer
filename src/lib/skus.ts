import type { Sku } from "../types/tiktok";
import { parseMoney } from "./money";
import { exportFileName, textCell, toCsv, toTsv, toXlsx, type ExportColumn } from "./spreadsheet";

/**
 * Exportação da tabela de Variações (SkuTable) — mesmas colunas que a tela
 * mostra, para que copiar/baixar nunca traga mais nem menos do que o que
 * está na tela.
 */

function variationLabel(sku: Sku): string {
  return (sku.sales_attributes ?? [])
    .map((a) => a.value_name)
    .filter((v): v is string => v !== undefined && v !== "")
    .join(" / ");
}

function totalStock(sku: Sku): number {
  return (sku.inventory ?? []).reduce((sum, inv) => sum + (inv.quantity ?? 0), 0);
}

export const SKU_COLUMNS: Array<ExportColumn<Sku>> = [
  { header: "Variação", width: 22, cell: (sku) => textCell(variationLabel(sku)) },
  { header: "seller_sku", width: 22, cell: (sku) => textCell(sku.seller_sku) },
  { header: "SKU ID", width: 20, cell: (sku) => textCell(sku.id) },
  { header: "EAN", width: 18, cell: (sku) => textCell(sku.identifier_code?.code) },
  { header: "Moeda", width: 8, cell: (sku) => textCell(sku.price?.currency) },
  {
    header: "Preço",
    width: 14,
    cell: (sku) => ({ kind: "money", value: parseMoney(sku.price?.sale_price) }),
  },
  { header: "Estoque", width: 10, cell: (sku) => textCell(String(totalStock(sku))) },
  { header: "Status", width: 14, cell: (sku) => textCell(sku.status_info?.status) },
];

export function skusTsv(skus: Sku[]): string {
  return toTsv(SKU_COLUMNS, skus);
}

export function skusCsv(skus: Sku[]): string {
  return toCsv(SKU_COLUMNS, skus);
}

export function skusXlsx(skus: Sku[], modified?: Date): Uint8Array {
  return toXlsx(SKU_COLUMNS, skus, "Variações", modified);
}

export function skusFileName(extension: "csv" | "xlsx", productId?: string, now?: Date): string {
  const base = productId !== undefined && productId !== "" ? `variacoes-${productId}` : "variacoes";
  return exportFileName(base, extension, now);
}
