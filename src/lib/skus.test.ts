import { describe, expect, it } from "vitest";
import { skusCsv, skusFileName, skusTsv, skusXlsx } from "./skus";
import type { Sku } from "../types/tiktok";

const SKU: Sku = {
  id: "1729000000000000001",
  seller_sku: "CAM-AZ-M",
  price: { currency: "BRL", sale_price: "89.90" },
  inventory: [{ warehouse_id: "w1", quantity: 3 }, { warehouse_id: "w2", quantity: 2 }],
  identifier_code: { code: "7891234567890", type: "EAN" },
  sales_attributes: [{ name: "Cor", value_name: "Azul" }, { name: "Tamanho", value_name: "M" }],
  status_info: { status: "ACTIVATE" },
};

describe("skusTsv", () => {
  it("traz todas as colunas da tabela, não só o seller_sku", () => {
    const lines = skusTsv([SKU]).split("\n");
    const columns = lines[0]?.split("\t") ?? [];
    const cells = lines[1]?.split("\t") ?? [];
    const at = (name: string) => cells[columns.indexOf(name)];

    expect(columns).toEqual([
      "Variação",
      "seller_sku",
      "SKU ID",
      "EAN",
      "Moeda",
      "Preço",
      "Estoque",
      "Status",
    ]);
    expect(at("Variação")).toBe("Azul / M");
    expect(at("seller_sku")).toBe("CAM-AZ-M");
    expect(at("SKU ID")).toBe("1729000000000000001");
    expect(at("EAN")).toBe("7891234567890");
    expect(at("Moeda")).toBe("BRL");
    expect(at("Preço")).toBe("89.90");
    expect(at("Estoque")).toBe("5");
    expect(at("Status")).toBe("ACTIVATE");
  });
});

describe("skusCsv", () => {
  it("usa ponto-e-vírgula e vírgula decimal", () => {
    const csv = skusCsv([SKU]);
    expect(csv).not.toContain("\t");
    const [, row] = csv.split("\r\n");
    expect(row).toContain("89,90");
  });
});

describe("skusFileName", () => {
  it("carimba a data e a extensão pedida", () => {
    expect(skusFileName("csv", undefined, new Date(2026, 8, 22))).toBe("variacoes-2026-09-22.csv");
    expect(skusFileName("xlsx", "1729", new Date(2026, 8, 22))).toBe(
      "variacoes-1729-2026-09-22.xlsx",
    );
  });
});

describe("skusXlsx", () => {
  it("gera um arquivo ZIP, que é o que um .xlsx é por dentro", () => {
    const bytes = skusXlsx([SKU]);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("não quebra com a lista vazia", () => {
    expect(skusXlsx([]).length).toBeGreaterThan(500);
  });
});
