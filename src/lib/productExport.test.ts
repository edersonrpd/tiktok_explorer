import { describe, expect, it } from "vitest";
import type { Product } from "../types/tiktok";
import { productRows, productsCsv, productsTsv, productsXlsx } from "./productExport";

const PRODUCT: Product = {
  id: "1729000000000000001",
  title: "Camiseta Básica",
  status: "ACTIVATE",
  brand: { name: "Marca X" },
  category_chains: [
    { id: "1", local_name: "Moda", is_leaf: false },
    { id: "2", parent_id: "1", local_name: "Camisetas", is_leaf: true },
  ],
  external_product_id: "EXT-1",
  main_images: [{}, {}],
  product_attributes: [{ name: "Material", values: [{ name: "Algodão" }] }],
  package_dimensions: { length: "30", width: "20", height: "5", unit: "CENTIMETER" },
  package_weight: { value: "0.3", unit: "KILOGRAM" },
  skus: [
    {
      id: "s1",
      seller_sku: "CAM-AZ-M",
      price: { currency: "BRL", sale_price: "89.90" },
      inventory: [{ quantity: 3 }, { quantity: 2 }],
      sales_attributes: [{ value_name: "Azul" }, { value_name: "M" }],
      identifier_code: { code: "7891234567890" },
    },
    { id: "s2", seller_sku: "CAM-AZ-G", price: { currency: "BRL", sale_price: "89.90" } },
  ],
};

const NO_SKUS: Product = { id: "2", title: "Sem variações" };

function table(tsv: string): Array<Record<string, string>> {
  const [head, ...lines] = tsv.split("\n");
  const columns = (head ?? "").split("\t");
  return lines.map((line) => {
    const cells = line.split("\t");
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? ""]));
  });
}

describe("productRows", () => {
  it("gera uma linha por SKU e uma linha para anúncio sem variações", () => {
    expect(productRows([PRODUCT, NO_SKUS])).toHaveLength(3);
  });
});

describe("productsTsv", () => {
  const rows = table(productsTsv([PRODUCT, NO_SKUS]));

  it("repete os dados do anúncio em cada SKU", () => {
    expect(rows[0]).toMatchObject({
      "ID do anúncio": "1729000000000000001",
      Título: "Camiseta Básica",
      Marca: "Marca X",
      Categoria: "Moda > Camisetas",
      seller_sku: "CAM-AZ-M",
      Variação: "Azul / M",
      EAN: "7891234567890",
      Preço: "89.90",
      Estoque: "5",
      Atributos: "Material: Algodão",
      "Dimensões da embalagem": "30 x 20 x 5 CENTIMETER",
      "Peso da embalagem": "0.3 KILOGRAM",
      Imagens: "2",
    });
    expect(rows[1]).toMatchObject({ "ID do anúncio": "1729000000000000001", seller_sku: "CAM-AZ-G" });
  });

  it("mantém o anúncio sem variações, com as colunas de SKU vazias", () => {
    expect(rows[2]).toMatchObject({ "ID do anúncio": "2", seller_sku: "", "SKU ID": "", Estoque: "" });
  });
});

describe("formatos", () => {
  it("CSV usa ; e vírgula decimal", () => {
    const csv = productsCsv([PRODUCT]);
    expect(csv.split("\r\n")[0]).toContain(";");
    expect(csv).toContain("89,90");
  });

  it("gera um .xlsx (ZIP)", () => {
    const bytes = productsXlsx([PRODUCT]);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});
