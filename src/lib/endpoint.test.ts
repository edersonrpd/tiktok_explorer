import { describe, expect, it } from "vitest";
import {
  buildOrderEndpoint,
  buildProductEndpoint,
  cleanProductId,
  detectResourceKind,
  parseOrderIds,
} from "./endpoint";

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

describe("buildOrderEndpoint", () => {
  it("monta o endpoint com um único pedido", () => {
    expect(buildOrderEndpoint("576461413038785752")).toEqual({
      ok: true,
      path: "/order/202507/orders?ids=576461413038785752",
    });
  });

  it("junta vários IDs com vírgula literal, como na documentação", () => {
    const result = buildOrderEndpoint("57668123555,57668123556");
    expect(result.ok && result.path).toBe("/order/202507/orders?ids=57668123555,57668123556");
  });

  it("aceita IDs separados por quebra de linha (colar de planilha)", () => {
    const result = buildOrderEndpoint("576461413038785752\n576461413038785753\n");
    expect(result.ok && result.path).toBe(
      "/order/202507/orders?ids=576461413038785752,576461413038785753",
    );
  });

  it("remove IDs repetidos preservando a ordem", () => {
    expect(parseOrderIds("111, 222, 111")).toEqual(["111", "222"]);
  });

  it("recusa lista vazia", () => {
    expect(buildOrderEndpoint("  \n ").ok).toBe(false);
  });

  it("recusa ID não numérico apontando qual é", () => {
    const result = buildOrderEndpoint("576461413038785752, ABC123");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain("ABC123");
  });
});

describe("detectResourceKind", () => {
  it("reconhece produto e pedido pelo path", () => {
    expect(detectResourceKind("/product/202309/products/1")).toBe("product");
    expect(detectResourceKind("/order/202507/orders")).toBe("order");
  });

  it("classifica endpoints desconhecidos como other", () => {
    expect(detectResourceKind("/finance/202309/statements")).toBe("other");
  });
});
