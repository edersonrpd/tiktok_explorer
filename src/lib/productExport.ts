import type { Product, Sku } from "../types/tiktok";
import { parseMoney } from "./money";
import { exportFileName, textCell, toCsv, toTsv, toXlsx, type ExportColumn } from "./spreadsheet";

/**
 * Exportação detalhada dos anúncios extraídos em lote: UMA LINHA POR SKU,
 * com os dados do anúncio repetidos em cada uma. É o formato do de-para
 * com o ERP (o `seller_sku` é a chave) e o que filtra e agrupa bem numa
 * tabela dinâmica. Anúncio sem variações sai em uma linha, com as colunas
 * de SKU vazias — para não sumir da planilha.
 */

export interface ProductRow {
  product: Product;
  sku: Sku | undefined;
}

export function productRows(products: Product[]): ProductRow[] {
  return products.flatMap((product): ProductRow[] => {
    const skus = product.skus ?? [];
    return skus.length === 0
      ? [{ product, sku: undefined }]
      : skus.map((sku) => ({ product, sku }));
  });
}

function variationLabel(sku: Sku | undefined): string {
  return (sku?.sales_attributes ?? [])
    .map((a) => a.value_name)
    .filter((v): v is string => v !== undefined && v !== "")
    .join(" / ");
}

function totalStock(sku: Sku | undefined): string {
  if (sku === undefined) return "";
  return String((sku.inventory ?? []).reduce((sum, inv) => sum + (inv.quantity ?? 0), 0));
}

/** Cadeia de categorias do anúncio, da raiz à folha: "Moda > Camisetas". */
function categoryPath(product: Product): string {
  return (product.category_chains ?? []).map((c) => c.local_name).join(" > ");
}

/** "Material: Algodão; Cor: Azul" — todos os atributos numa célula só. */
function attributesText(product: Product): string {
  return (product.product_attributes ?? [])
    .map((attribute) => {
      const values = (attribute.values ?? [])
        .map((v) => v.name)
        .filter((v): v is string => v !== undefined && v !== "")
        .join(", ");
      return `${attribute.name ?? attribute.id ?? "?"}: ${values}`;
    })
    .join("; ");
}

function dimensionsText(product: Product): string {
  const d = product.package_dimensions;
  if (d === undefined) return "";
  const parts = [d.length, d.width, d.height].filter((v): v is string => v !== undefined && v !== "");
  return parts.length === 0 ? "" : `${parts.join(" x ")} ${d.unit ?? ""}`.trim();
}

function weightText(product: Product): string {
  const w = product.package_weight;
  return w?.value === undefined || w.value === "" ? "" : `${w.value} ${w.unit ?? ""}`.trim();
}

export const PRODUCT_COLUMNS: Array<ExportColumn<ProductRow>> = [
  { header: "ID do anúncio", width: 21, cell: (r) => textCell(r.product.id) },
  { header: "Título", width: 50, cell: (r) => textCell(r.product.title) },
  { header: "Status", width: 14, cell: (r) => textCell(r.product.status) },
  { header: "Auditoria", width: 12, cell: (r) => textCell(r.product.audit?.status) },
  { header: "Marca", width: 18, cell: (r) => textCell(r.product.brand?.name) },
  { header: "Categoria", width: 36, cell: (r) => textCell(categoryPath(r.product)) },
  { header: "external_product_id", width: 20, cell: (r) => textCell(r.product.external_product_id) },
  { header: "Variação", width: 22, cell: (r) => textCell(variationLabel(r.sku)) },
  { header: "seller_sku", width: 22, cell: (r) => textCell(r.sku?.seller_sku) },
  { header: "SKU ID", width: 21, cell: (r) => textCell(r.sku?.id) },
  { header: "EAN", width: 16, cell: (r) => textCell(r.sku?.identifier_code?.code) },
  { header: "external_sku_id", width: 20, cell: (r) => textCell(r.sku?.external_sku_id) },
  { header: "Moeda", width: 8, cell: (r) => textCell(r.sku?.price?.currency) },
  {
    header: "Preço",
    width: 12,
    cell: (r) => ({ kind: "money", value: parseMoney(r.sku?.price?.sale_price) }),
  },
  { header: "Estoque", width: 10, cell: (r) => textCell(totalStock(r.sku)) },
  { header: "Status do SKU", width: 14, cell: (r) => textCell(r.sku?.status_info?.status) },
  {
    header: "Criado em",
    width: 17,
    cell: (r) => ({ kind: "date", value: r.product.create_time }),
  },
  {
    header: "Atualizado em",
    width: 17,
    cell: (r) => ({ kind: "date", value: r.product.update_time }),
  },
  {
    header: "Fora de venda",
    width: 13,
    cell: (r) =>
      textCell(
        r.product.is_not_for_sale === undefined ? "" : r.product.is_not_for_sale ? "sim" : "não",
      ),
  },
  { header: "Imagens", width: 9, cell: (r) => textCell(String(r.product.main_images?.length ?? 0)) },
  { header: "Atributos", width: 50, cell: (r) => textCell(attributesText(r.product)) },
  { header: "Dimensões da embalagem", width: 22, cell: (r) => textCell(dimensionsText(r.product)) },
  { header: "Peso da embalagem", width: 18, cell: (r) => textCell(weightText(r.product)) },
];

export function productsTsv(products: Product[]): string {
  return toTsv(PRODUCT_COLUMNS, productRows(products));
}

export function productsCsv(products: Product[]): string {
  return toCsv(PRODUCT_COLUMNS, productRows(products));
}

export function productsXlsx(products: Product[], modified?: Date): Uint8Array {
  return toXlsx(PRODUCT_COLUMNS, productRows(products), "Anúncios", modified);
}

export function productsFileName(
  extension: "csv" | "xlsx",
  now?: Date,
): string {
  return exportFileName("anuncios", extension, now);
}
