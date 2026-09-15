import { describe, expect, it } from "vitest";
import {
  buildOrderEndpoint,
  buildProductEndpoint,
  buildTransactionEndpoint,
  cleanProductId,
  buildStatementEndpoint,
  cleanStatementId,
  detectResourceKind,
  MAX_ORDER_IDS,
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

describe("buildTransactionEndpoint", () => {
  it("monta o endpoint a partir do código do pedido", () => {
    expect(buildTransactionEndpoint("5793990727963214852")).toEqual({
      ok: true,
      path: "/finance/202501/orders/5793990727963214852/statement_transactions",
    });
  });

  it("ignora espaços em volta do código", () => {
    const result = buildTransactionEndpoint("  5793990727963214852 \n");
    expect(result.ok && result.path).toBe(
      "/finance/202501/orders/5793990727963214852/statement_transactions",
    );
  });

  it("recusa código vazio", () => {
    expect(buildTransactionEndpoint("   ").ok).toBe(false);
  });

  it("recusa código com letras ou símbolos", () => {
    expect(buildTransactionEndpoint("579399abc").ok).toBe(false);
  });
});

describe("detectResourceKind", () => {
  it("reconhece produto, pedido e transações pelo path", () => {
    expect(detectResourceKind("/product/202309/products/1")).toBe("product");
    expect(detectResourceKind("/order/202507/orders")).toBe("order");
    expect(
      detectResourceKind("/finance/202501/orders/5793990727963214852/statement_transactions"),
    ).toBe("transaction");
  });

  it("classifica endpoints desconhecidos como other", () => {
    expect(detectResourceKind("/something/202309/else")).toBe("other");
  });
});

describe("limite de IDs por chamada", () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => String(576461413038785752n + BigInt(i))).join(",");

  it("aceita exatamente 50 pedidos", () => {
    const result = buildOrderEndpoint(many(MAX_ORDER_IDS));
    expect(result.ok).toBe(true);
  });

  it("recusa 51 pedidos indicando o limite", () => {
    const result = buildOrderEndpoint(many(MAX_ORDER_IDS + 1));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain("50");
  });
});

describe("buildStatementEndpoint", () => {
  it("monta o endpoint com sort_field obrigatório e os padrões da aplicação", () => {
    expect(buildStatementEndpoint("7238804564097517339")).toEqual({
      ok: true,
      path:
        "/finance/202501/statements/7238804564097517339/statement_transactions" +
        "?page_size=100&sort_field=order_create_time&sort_order=DESC",
    });
  });

  it("respeita page_size e sort_order informados", () => {
    const result = buildStatementEndpoint("7238804564097517339", {
      pageSize: 20,
      sortOrder: "ASC",
    });
    expect(result.ok && result.path).toBe(
      "/finance/202501/statements/7238804564097517339/statement_transactions" +
        "?page_size=20&sort_field=order_create_time&sort_order=ASC",
    );
  });

  it("acrescenta o page_token literal, sem re-encoding", () => {
    const token = "6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq/N5M1kHYcZmtRyv9aVrNv65W7Q6tFA+7D1ud64MPNz5OaT";
    const result = buildStatementEndpoint("7238804564097517339", { pageToken: token });
    expect(result.ok && result.path).toContain(`page_token=${token}`);
  });

  it("recusa page_size fora da faixa 1..100", () => {
    expect(buildStatementEndpoint("7238804564097517339", { pageSize: 0 }).ok).toBe(false);
    expect(buildStatementEndpoint("7238804564097517339", { pageSize: 101 }).ok).toBe(false);
    expect(buildStatementEndpoint("7238804564097517339", { pageSize: 1.5 }).ok).toBe(false);
    expect(buildStatementEndpoint("7238804564097517339", { pageSize: Number.NaN }).ok).toBe(false);
  });

  it("recusa page_token com caracteres que indicam quebra no copiar/colar", () => {
    expect(buildStatementEndpoint("7238804564097517339", { pageToken: "abc def" }).ok).toBe(false);
  });

  it("ignora page_token vazio (primeira página)", () => {
    const result = buildStatementEndpoint("7238804564097517339", { pageToken: "   " });
    expect(result.ok && result.path.includes("page_token")).toBe(false);
  });

  it("recusa código vazio ou não numérico", () => {
    expect(buildStatementEndpoint("  ").ok).toBe(false);
    expect(buildStatementEndpoint("7238abc").ok).toBe(false);
  });
});

describe("cleanStatementId", () => {
  it("pega o ID do meio do caminho, não o último segmento", () => {
    expect(
      cleanStatementId("/finance/202501/statements/7238804564097517339/statement_transactions"),
    ).toBe("7238804564097517339");
  });

  it("aceita o ID puro", () => {
    expect(cleanStatementId(" 7238804564097517339 ")).toBe("7238804564097517339");
  });

  it("extrai o ID de uma URL assinada inteira", () => {
    expect(
      cleanStatementId(
        "https://open-api.tiktokglobalshop.com/finance/202501/statements/7238804564097517339/statement_transactions?app_key=k&sign=s",
      ),
    ).toBe("7238804564097517339");
  });
});

describe("detectResourceKind — os dois endpoints de finanças", () => {
  it("separa transações do pedido das transações do extrato", () => {
    expect(
      detectResourceKind("/finance/202501/orders/5793990727963214852/statement_transactions"),
    ).toBe("transaction");
    expect(
      detectResourceKind("/finance/202501/statements/7238804564097517339/statement_transactions"),
    ).toBe("statement");
  });
});
