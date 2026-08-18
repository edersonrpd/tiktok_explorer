import { describe, expect, it } from "vitest";
import {
  findPlaceholder,
  normalizeSignedUrl,
  parseQueryParams,
  validateSignedUrl,
} from "./signedUrl";

const SIGNED_QUERY =
  "shop_cipher=ROW_16myjQAAAAD5rjMQTuL4qyrJEk0hdOrt&app_key=6h4meu9rp6vtm&timestamp=1787082661&sign=46d5d051a7dc49df7fc3a6ae089f0bc0328b3e5bb2db9666300e3818249e30f7";

const PATH = "/product/202309/products/1736320032383141477";

describe("normalizeSignedUrl", () => {
  it("remove o prefixo file:/// mantendo path e query intactos", () => {
    const result = normalizeSignedUrl(`file://${PATH}?${SIGNED_QUERY}`);
    expect(result.strippedPrefix).toBe("file://");
    expect(result.pathWithQuery).toBe(`${PATH}?${SIGNED_QUERY}`);
    expect(result.rawQuery).toBe(SIGNED_QUERY);
  });

  it("remove o host da API mantendo o resto", () => {
    const result = normalizeSignedUrl(
      `https://open-api.tiktokglobalshop.com${PATH}?${SIGNED_QUERY}`,
    );
    expect(result.strippedPrefix).toBe("https://open-api.tiktokglobalshop.com");
    expect(result.pathWithQuery).toBe(`${PATH}?${SIGNED_QUERY}`);
  });

  it("não re-codifica caracteres já percent-encoded na query", () => {
    const query = "shop_cipher=a%2Fb%3D&app_key=k&timestamp=1&sign=s";
    const result = normalizeSignedUrl(`file://${PATH}?${query}`);
    expect(result.rawQuery).toBe(query);
  });

  it("separa apenas no primeiro ? (um ? literal dentro da query permanece)", () => {
    const query = "shop_cipher=a?b&app_key=k&timestamp=1&sign=s";
    const result = normalizeSignedUrl(`${PATH}?${query}`);
    expect(result.path).toBe(PATH);
    expect(result.rawQuery).toBe(query);
  });

  it("adiciona barra inicial quando ausente", () => {
    const result = normalizeSignedUrl(`product/x?sign=s`);
    expect(result.path).toBe("/product/x");
  });
});

describe("parseQueryParams", () => {
  it("preserva os valores brutos, sem decode", () => {
    const params = parseQueryParams("a=%7Bx%7D&b=1");
    expect(params).toEqual([
      { name: "a", value: "%7Bx%7D" },
      { name: "b", value: "1" },
    ]);
  });
});

describe("findPlaceholder", () => {
  it("detecta {product_id} cru", () => {
    expect(findPlaceholder("/product/x/{product_id}?a=1")).toBe("{product_id}");
  });
  it("detecta %7Bproduct_id%7D (qualquer caixa)", () => {
    expect(findPlaceholder("/product/x/%7bProduct_id%7D?a=1")).toBe("%7Bproduct_id%7D");
  });
  it("retorna null quando o ID foi substituído", () => {
    expect(findPlaceholder(`${PATH}?${SIGNED_QUERY}`)).toBeNull();
  });
});

describe("validateSignedUrl", () => {
  it("aceita URL completa e fresca sem erros nem avisos", () => {
    const normalized = normalizeSignedUrl(`file://${PATH}?${SIGNED_QUERY}`);
    const result = validateSignedUrl(normalized, 1787082661 + 60);
    expect(result.errors).toEqual([]);
    expect(result.expiredWarning).toBeNull();
    expect(result.params).toHaveLength(4);
  });

  it("bloqueia quando faltam parâmetros obrigatórios", () => {
    const normalized = normalizeSignedUrl(`${PATH}?app_key=k&timestamp=1787082661`);
    const result = validateSignedUrl(normalized, 1787082661);
    expect(result.errors).toEqual([
      { kind: "missing-params", missing: ["shop_cipher", "sign"] },
    ]);
  });

  it("bloqueia placeholder não substituído", () => {
    const normalized = normalizeSignedUrl(`/product/202309/products/{product_id}?${SIGNED_QUERY}`);
    const result = validateSignedUrl(normalized, 1787082661);
    expect(result.errors.some((e) => e.kind === "placeholder")).toBe(true);
  });

  it("avisa (sem bloquear) timestamp com mais de 4 minutos", () => {
    const normalized = normalizeSignedUrl(`${PATH}?${SIGNED_QUERY}`);
    const result = validateSignedUrl(normalized, 1787082661 + 5 * 60);
    expect(result.errors).toEqual([]);
    expect(result.expiredWarning).toEqual({ ageSeconds: 300 });
  });

  it("timestamp com até 4 minutos não gera aviso", () => {
    const normalized = normalizeSignedUrl(`${PATH}?${SIGNED_QUERY}`);
    const result = validateSignedUrl(normalized, 1787082661 + 4 * 60);
    expect(result.expiredWarning).toBeNull();
  });

  it("bloqueia entrada vazia", () => {
    const result = validateSignedUrl(normalizeSignedUrl("  "));
    expect(result.errors).toEqual([{ kind: "empty" }]);
  });
});

describe("validateSignedUrl — pedidos", () => {
  const ORDER_QUERY =
    "timestamp=1787082661&shop_cipher=GCP_x&ids=57668123555,57668123556&app_key=38abcd&sign=5361";

  it("aceita a URL de pedidos com ids e não trata ids como parâmetro extra", () => {
    const normalized = normalizeSignedUrl(`/order/202507/orders?${ORDER_QUERY}`);
    const result = validateSignedUrl(normalized, 1787082661);
    expect(result.errors).toEqual([]);
    expect(result.resourceKind).toBe("order");
    expect(result.params).toHaveLength(5);
  });

  it("bloqueia URL de pedidos sem o parâmetro ids", () => {
    const normalized = normalizeSignedUrl(
      "/order/202507/orders?timestamp=1787082661&shop_cipher=GCP_x&app_key=38abcd&sign=5361",
    );
    const result = validateSignedUrl(normalized, 1787082661);
    expect(result.errors).toEqual([{ kind: "missing-params", missing: ["ids"] }]);
  });

  it("não exige ids em URL de produto", () => {
    const normalized = normalizeSignedUrl(`${PATH}?${SIGNED_QUERY}`);
    const result = validateSignedUrl(normalized, 1787082661);
    expect(result.resourceKind).toBe("product");
    expect(result.errors).toEqual([]);
  });
});
