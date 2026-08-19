/**
 * Montagem dos endpoints a partir dos códigos informados.
 *
 * Este é o PRIMEIRO passo do fluxo: o caminho gerado aqui é o que vai
 * para o sistema interno de assinatura, que devolve a URL assinada para
 * colar no formulário de consulta. Nada aqui toca em assinatura:
 * `sign`, `app_key`, `shop_cipher` e `timestamp` são acrescentados pelo
 * sistema que assina.
 *
 * DIFERENÇA IMPORTANTE ENTRE OS DOIS ENDPOINTS:
 * - Produto: o ID vai no PATH  → /product/202309/products/{id}
 * - Pedidos: os IDs vão na QUERY → /order/202507/orders?ids=a,b
 *
 * No caso de pedidos, `ids` faz parte da query e portanto é assinado
 * junto com os demais parâmetros. Ele precisa estar presente ANTES da
 * assinatura — acrescentar `ids` depois invalidaria o `sign` (erro
 * 106001). Por isso o passo 1 já entrega o caminho com `ids` embutido.
 */

/** Versão do endpoint de produto da Open API (parte do path assinado). */
export const PRODUCT_API_VERSION = "202309";

/**
 * Versões disponíveis do endpoint de pedidos. As duas recebem `ids` na
 * query e devolvem a mesma estrutura (a 202507 acrescenta campos); a
 * escolha não muda nada quanto à assinatura.
 */
export const ORDER_API_VERSIONS = ["202507", "202309"] as const;
export type OrderApiVersion = (typeof ORDER_API_VERSIONS)[number];

/** Versão padrão do endpoint de pedidos (parte do path assinado). */
export const ORDER_API_VERSION: OrderApiVersion = "202507";

/** Limite de IDs por chamada, conforme a documentação do Get Order Detail. */
export const MAX_ORDER_IDS = 50;

/** Tipo de recurso que a aplicação sabe consultar e exibir. */
export type ResourceKind = "product" | "order" | "other";

export type EndpointResult = { ok: true; path: string } | { ok: false; reason: string };

/**
 * Extrai um ID de um valor colado. Aceita o ID puro, mas também tolera o
 * caso comum de colar um path/URL inteiro: fica com o último segmento
 * antes da query, além de aspas e espaços de copiar/colar.
 */
export function cleanProductId(raw: string): string {
  let value = raw.trim().replace(/^["'`<]+/, "").replace(/["'`>]+$/, "").trim();

  const queryIndex = value.indexOf("?");
  if (queryIndex !== -1) value = value.slice(0, queryIndex);

  const lastSlash = value.lastIndexOf("/");
  if (lastSlash !== -1) value = value.slice(lastSlash + 1);

  return value.trim();
}

/** Monta `/product/{versão}/products/{id}` ou explica por que não deu. */
export function buildProductEndpoint(rawId: string): EndpointResult {
  const id = cleanProductId(rawId);

  if (id === "") {
    return { ok: false, reason: "Informe o código do anúncio (product_id)." };
  }
  if (!/^\d+$/.test(id)) {
    return {
      ok: false,
      reason: `O código do anúncio é composto só por números (ex.: 1736320032383141477). Valor lido: "${id}".`,
    };
  }

  return { ok: true, path: `/product/${PRODUCT_API_VERSION}/products/${id}` };
}

/**
 * Separa os IDs de pedido informados. Aceita vírgula, ponto-e-vírgula,
 * espaço ou uma linha por ID — assim dá para colar direto de uma planilha.
 * Preserva a ordem e remove repetidos.
 */
export function parseOrderIds(raw: string): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const piece of raw.split(/[\s,;]+/)) {
    const id = cleanProductId(piece);
    if (id !== "" && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

/**
 * Monta `/order/{versão}/orders?ids=a,b`.
 *
 * A vírgula entre os IDs fica literal, exatamente como na documentação do
 * TikTok — não aplicamos encoding aqui, e o sistema de assinatura deve
 * assinar a query nesse mesmo formato.
 */
export function buildOrderEndpoint(
  raw: string,
  version: OrderApiVersion = ORDER_API_VERSION,
): EndpointResult {
  const ids = parseOrderIds(raw);

  if (ids.length === 0) {
    return { ok: false, reason: "Informe ao menos um código de pedido (order id)." };
  }

  const invalid = ids.filter((id) => !/^\d+$/.test(id));
  if (invalid.length > 0) {
    return {
      ok: false,
      reason: `Código de pedido é composto só por números (ex.: 576461413038785752). Inválido(s): ${invalid.join(", ")}.`,
    };
  }

  if (ids.length > MAX_ORDER_IDS) {
    return {
      ok: false,
      reason: `O endpoint aceita no máximo ${MAX_ORDER_IDS} pedidos por chamada (você informou ${ids.length}). Divida em lotes de até ${MAX_ORDER_IDS}.`,
    };
  }

  return { ok: true, path: `/order/${version}/orders?ids=${ids.join(",")}` };
}

/**
 * Descobre o tipo de recurso pelo path da URL assinada, para que a
 * validação e a exibição não dependam da aba selecionada — colar uma URL
 * de pedido com a aba de produto aberta continua funcionando.
 */
export function detectResourceKind(path: string): ResourceKind {
  if (path.startsWith("/product/")) return "product";
  if (path.startsWith("/order/")) return "order";
  return "other";
}
