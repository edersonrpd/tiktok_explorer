import { describe, expect, it } from "vitest";
import {
  buildOrderEndpoint,
  buildProductEndpoint,
  buildTransactionEndpoint,
  buildUnsettledEndpoint,
  cleanProductId,
  buildStatementEndpoint,
  buildStatementListEndpoint,
  cleanStatementId,
  detectResourceKind,
  MAX_ORDER_IDS,
  parseOrderIds,
  parseSearchTime,
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

describe("parseSearchTime", () => {
  /** Epoch da meia-noite LOCAL — é assim que o filtro interpreta a data. */
  const localMidnight = (year: number, month: number, day: number) =>
    Math.floor(new Date(year, month - 1, day).getTime() / 1000);

  it("trata campo vazio como ausência de filtro, não como erro", () => {
    expect(parseSearchTime("", "start")).toEqual({ ok: true, epoch: undefined });
    expect(parseSearchTime("   ", "end")).toEqual({ ok: true, epoch: undefined });
  });

  it("converte a data inicial para a meia-noite local do próprio dia", () => {
    const result = parseSearchTime("2025-01-31", "start");
    expect(result).toEqual({ ok: true, epoch: localMidnight(2025, 1, 31) });
  });

  it("joga a data final para o dia seguinte, porque o parâmetro é lt (exclusivo)", () => {
    // Sem isso, escolher 31/01 excluiria o dia 31 inteiro do resultado.
    const result = parseSearchTime("2025-01-31", "end");
    expect(result).toEqual({ ok: true, epoch: localMidnight(2025, 2, 1) });
  });

  it("aceita um Unix timestamp já pronto, literal nos dois extremos", () => {
    expect(parseSearchTime("1623812664", "start")).toEqual({ ok: true, epoch: 1623812664 });
    expect(parseSearchTime("1623812664", "end")).toEqual({ ok: true, epoch: 1623812664 });
  });

  it("recusa data que não existe no calendário em vez de deslizar para o mês seguinte", () => {
    const result = parseSearchTime("2025-02-30", "start");
    expect(result.ok).toBe(false);
  });

  it("recusa epoch em milissegundos e mostra o valor em segundos", () => {
    const result = parseSearchTime("1623812664000", "start");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain("1623812664");
  });

  it("recusa texto que não é data nem timestamp", () => {
    expect(parseSearchTime("31/01/2025", "start").ok).toBe(false);
    expect(parseSearchTime("ontem", "end").ok).toBe(false);
  });
});

describe("buildUnsettledEndpoint", () => {
  it("monta a consulta sem nenhum filtro — o endpoint não tem código", () => {
    expect(buildUnsettledEndpoint()).toEqual({
      ok: true,
      path: "/finance/202507/orders/unsettled?page_size=100&sort_field=order_create_time&sort_order=DESC",
    });
  });

  it("inclui a janela de datas e o token em ordem alfabética", () => {
    const result = buildUnsettledEndpoint({
      pageSize: 20,
      sortOrder: "ASC",
      pageToken: "WzE3MjM1MjE1ODEyNDks",
      searchTimeGe: 1623812664,
      searchTimeLt: 1623899064,
    });
    expect(result.ok && result.path).toBe(
      "/finance/202507/orders/unsettled" +
        "?page_size=20" +
        "&page_token=WzE3MjM1MjE1ODEyNDks" +
        "&search_time_ge=1623812664" +
        "&search_time_lt=1623899064" +
        "&sort_field=order_create_time" +
        "&sort_order=ASC",
    );
  });

  it("omite o filtro que não foi informado", () => {
    const result = buildUnsettledEndpoint({ searchTimeGe: 1623812664 });
    expect(result.ok && result.path).toContain("search_time_ge=1623812664");
    expect(result.ok && result.path).not.toContain("search_time_lt");
  });

  it("recusa janela invertida, que devolveria zero transações sem erro da API", () => {
    const result = buildUnsettledEndpoint({
      searchTimeGe: 1623899064,
      searchTimeLt: 1623812664,
    });
    expect(result.ok).toBe(false);
  });

  it("recusa page_size fora da faixa da documentação", () => {
    expect(buildUnsettledEndpoint({ pageSize: 0 }).ok).toBe(false);
    expect(buildUnsettledEndpoint({ pageSize: 101 }).ok).toBe(false);
    expect(buildUnsettledEndpoint({ pageSize: Number.NaN }).ok).toBe(false);
  });

  it("recusa page_token quebrado no copiar/colar", () => {
    expect(buildUnsettledEndpoint({ pageToken: "abc def" }).ok).toBe(false);
  });
});

describe("detectResourceKind das transações a liquidar", () => {
  it("reconhece o caminho sem ID", () => {
    expect(detectResourceKind("/finance/202507/orders/unsettled")).toBe("unsettled");
  });

  it("não confunde com as transações de um pedido", () => {
    expect(detectResourceKind("/finance/202501/orders/576463220456522968/statement_transactions")).toBe(
      "transaction",
    );
  });
});

describe("buildStatementListEndpoint", () => {
  it("monta a consulta sem filtro — é ela que não precisa de código", () => {
    expect(buildStatementListEndpoint()).toEqual({
      ok: true,
      path: "/finance/202309/statements?page_size=100&sort_field=statement_time&sort_order=DESC",
    });
  });

  it("ordena por statement_time, não por order_create_time", () => {
    // Cada linha aqui é um repasse, não um pedido — é outro sort_field.
    const result = buildStatementListEndpoint();
    expect(result.ok && result.path).toContain("sort_field=statement_time");
  });

  it("inclui janela, status e token em ordem alfabética", () => {
    const result = buildStatementListEndpoint({
      pageSize: 20,
      sortOrder: "ASC",
      pageToken: "WzE3MjM1MjE1ODEyNDks",
      paymentStatus: "PAID",
      statementTimeGe: 1623812664,
      statementTimeLt: 1623899064,
    });
    expect(result.ok && result.path).toBe(
      "/finance/202309/statements" +
        "?page_size=20" +
        "&page_token=WzE3MjM1MjE1ODEyNDks" +
        "&payment_status=PAID" +
        "&sort_field=statement_time" +
        "&sort_order=ASC" +
        "&statement_time_ge=1623812664" +
        "&statement_time_lt=1623899064",
    );
  });

  it("omite payment_status quando é (todos)", () => {
    // A string vazia representa ausência do parâmetro, não um valor.
    const result = buildStatementListEndpoint({ paymentStatus: "" });
    expect(result.ok && result.path).not.toContain("payment_status");
  });

  it("recusa janela invertida e page_size fora da faixa", () => {
    expect(
      buildStatementListEndpoint({ statementTimeGe: 200, statementTimeLt: 100 }).ok,
    ).toBe(false);
    expect(buildStatementListEndpoint({ pageSize: 101 }).ok).toBe(false);
  });
});

describe("detectResourceKind dos dois caminhos de /statements", () => {
  it("reconhece a LISTA de repasses, que não tem ID", () => {
    expect(detectResourceKind("/finance/202309/statements")).toBe("statementList");
  });

  it("não confunde com as transações de um repasse", () => {
    expect(
      detectResourceKind("/finance/202501/statements/7238804564097517339/statement_transactions"),
    ).toBe("statement");
  });
});
