import { describe, expect, it } from "vitest";
import { buildProductEndpoint, cleanProductId } from "./endpoint";

describe("buildProductEndpoint", () => {
  it("monta o endpoint a partir do código do anúncio", () => {
    expect(buildProductEndpoint("1736320032383141477")).toEqual({
      ok: true,
      path: "/product/202309/products/1736320032383141477",
    });
  });

  it("ignora espaços em volta do código", () => {
    const result = buildProductEndpoint("  1736320032383141477 \n");
    expect(result.ok && result.path).toBe("/product/202309/products/1736320032383141477");
  });

  it("recusa código vazio", () => {
    expect(buildProductEndpoint("   ").ok).toBe(false);
  });

  it("recusa código com letras ou símbolos", () => {
    expect(buildProductEndpoint("173632abc").ok).toBe(false);
    expect(buildProductEndpoint("17363-2003").ok).toBe(false);
  });
});

describe("cleanProductId", () => {
  it("extrai o ID de um path colado inteiro", () => {
    expect(cleanProductId("/product/202309/products/1736320032383141477")).toBe(
      "1736320032383141477",
    );
  });

  it("extrai o ID de uma URL com query", () => {
    expect(
      cleanProductId(
        "https://open-api.tiktokglobalshop.com/product/202309/products/1736320032383141477?app_key=k&sign=s",
      ),
    ).toBe("1736320032383141477");
  });

  it("remove aspas de copiar/colar", () => {
    expect(cleanProductId('"1736320032383141477"')).toBe("1736320032383141477");
  });
});
