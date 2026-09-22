/**
 * Montagem dos endpoints a partir dos códigos informados.
 *
 * Este é o PRIMEIRO passo do fluxo: o caminho gerado aqui é o que vai
 * para o sistema interno de assinatura, que devolve a URL assinada para
 * colar no formulário de consulta. Nada aqui toca em assinatura:
 * `sign`, `app_key`, `shop_cipher` e `timestamp` são acrescentados pelo
 * sistema que assina.
 *
 * ONDE CADA CÓDIGO ENTRA:
 * - Produto:   o ID vai no PATH  → /product/202309/products/{id}
 * - Pedidos:   os IDs vão na QUERY → /order/202507/orders?ids=a,b
 * - Transações do pedido: o ID vai no PATH →
 *   /finance/202501/orders/{id}/statement_transactions
 * - Transações do extrato: o ID vai no PATH e os parâmetros de
 *   paginação/ordenação vão na QUERY →
 *   /finance/202501/statements/{id}/statement_transactions?sort_field=...
 * - Transações a liquidar: NÃO tem código nenhum — a consulta é da loja
 *   inteira e tudo vai na QUERY →
 *   /finance/202507/orders/unsettled?sort_field=...&search_time_ge=...
 *
 * Em pedidos, no extrato e nas transações a liquidar há parâmetros de
 * negócio na query (`ids`, `sort_field`, `page_size`, `sort_order`,
 * `page_token`, `search_time_ge`, `search_time_lt`), que por isso são
 * assinados junto com os demais. Eles precisam estar presentes ANTES da
 * assinatura — acrescentar qualquer um depois invalidaria o `sign` (erro
 * 106001). Por isso o passo 1 já entrega o caminho com a query embutida.
 */

/** Versão do endpoint de produto da Open API (parte do path assinado). */
export const PRODUCT_API_VERSION = "202309";

/** Versão do endpoint de pedidos da Open API (parte do path assinado). */
export const ORDER_API_VERSION = "202507";

/** Versão do endpoint de transações por pedido da Open API (parte do path assinado). */
export const TRANSACTION_API_VERSION = "202501";

/** Versão do endpoint de transações por extrato (parte do path assinado). */
export const STATEMENT_API_VERSION = "202501";

/** Versão do endpoint de transações a liquidar (parte do path assinado). */
export const UNSETTLED_API_VERSION = "202507";

/** Limite de IDs por chamada, conforme a documentação do Get Order Detail. */
export const MAX_ORDER_IDS = 50;

/** Tipo de recurso que a aplicação sabe consultar e exibir. */
export type ResourceKind =
  | "product"
  | "order"
  | "transaction"
  | "statement"
  | "unsettled"
  | "other";

export type EndpointResult = { ok: true; path: string } | { ok: false; reason: string };

/**
 * Primeira limpeza do que foi colado: tira aspas e sinais de copiar/colar
 * das pontas e descarta a query. O que sobra é path ou ID puro — de onde
 * cada endpoint extrai o código do jeito dele.
 */
function cleanIdInput(raw: string): string {
  const value = raw.trim().replace(/^["'`<]+/, "").replace(/["'`>]+$/, "").trim();
  const queryIndex = value.indexOf("?");
  return (queryIndex === -1 ? value : value.slice(0, queryIndex)).trim();
}

/**
 * Extrai um ID de um valor colado. Aceita o ID puro, mas também tolera o
 * caso comum de colar um path/URL inteiro: fica com o último segmento
 * antes da query, além de aspas e espaços de copiar/colar.
 */
export function cleanProductId(raw: string): string {
  const value = cleanIdInput(raw);

  const lastSlash = value.lastIndexOf("/");
  return (lastSlash === -1 ? value : value.slice(lastSlash + 1)).trim();
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
export function buildOrderEndpoint(raw: string): EndpointResult {
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

  return { ok: true, path: `/order/${ORDER_API_VERSION}/orders?ids=${ids.join(",")}` };
}

/** Monta `/finance/{versão}/orders/{order_id}/statement_transactions`. */
export function buildTransactionEndpoint(rawId: string): EndpointResult {
  const id = cleanProductId(rawId);

  if (id === "") {
    return { ok: false, reason: "Informe o código do pedido (order_id)." };
  }
  if (!/^\d+$/.test(id)) {
    return {
      ok: false,
      reason: `O código do pedido é composto só por números (ex.: 5793990727963214852). Valor lido: "${id}".`,
    };
  }

  return {
    ok: true,
    path: `/finance/${TRANSACTION_API_VERSION}/orders/${id}/statement_transactions`,
  };
}

/**
 * Único valor aceito por `sort_field` na documentação — e ele é
 * OBRIGATÓRIO, mesmo só tendo uma opção. Sem ele a chamada é recusada.
 */
export const STATEMENT_SORT_FIELD = "order_create_time";

export const STATEMENT_SORT_ORDERS = ["DESC", "ASC"] as const;
export type StatementSortOrder = (typeof STATEMENT_SORT_ORDERS)[number];

/** Faixa aceita por `page_size` (padrão da API: 20). */
export const MIN_STATEMENT_PAGE_SIZE = 1;
export const MAX_STATEMENT_PAGE_SIZE = 100;

/** Padrão desta aplicação: o teto, para reduzir o número de assinaturas. */
export const DEFAULT_STATEMENT_PAGE_SIZE = MAX_STATEMENT_PAGE_SIZE;

export interface StatementEndpointOptions {
  pageSize?: number;
  sortOrder?: StatementSortOrder;
  /** `next_page_token` da página anterior; ausente na primeira página. */
  pageToken?: string;
}

/**
 * Extrai o ID do extrato de um valor colado.
 *
 * Diferente dos outros endpoints, aqui o ID fica no MEIO do caminho
 * (`/statements/{id}/statement_transactions`), então `cleanProductId`
 * devolveria "statement_transactions". Por isso o ID é buscado depois de
 * `/statements/`, com o último segmento como plano B para quem colou só
 * o ID.
 */
export function cleanStatementId(raw: string): string {
  const value = cleanIdInput(raw);

  const match = /\/statements\/([^/?]+)/.exec(value);
  if (match?.[1] !== undefined) return match[1].trim();

  const lastSlash = value.lastIndexOf("/");
  return (lastSlash === -1 ? value : value.slice(lastSlash + 1)).trim();
}

/**
 * Caracteres aceitos em `page_token`. O token é base64 com `+`, `/` e `=`
 * (ver o exemplo da documentação), e é o único parâmetro desta API que
 * não é um número ou uma palavra fixa — daí a validação existir.
 */
const PAGE_TOKEN_PATTERN = /^[A-Za-z0-9+/=_-]+$/;

/**
 * Monta `/finance/{versão}/statements/{id}/statement_transactions?...`.
 *
 * Os parâmetros saem em ordem alfabética, sempre igual, para que duas
 * montagens do mesmo pedido gerem exatamente a mesma string — o que
 * facilita comparar com o que o sistema interno assinou. A ordem em si
 * não afeta o `sign` (o algoritmo do TikTok ordena os parâmetros antes de
 * calcular), mas a string enviada precisa ser a mesma que foi assinada.
 *
 * `sort_field` entra sempre: é obrigatório e só aceita `order_create_time`.
 */
export function buildStatementEndpoint(
  rawId: string,
  options: StatementEndpointOptions = {},
): EndpointResult {
  const id = cleanStatementId(rawId);

  if (id === "") {
    return { ok: false, reason: "Informe o código do extrato (statement_id)." };
  }
  if (!/^\d+$/.test(id)) {
    return {
      ok: false,
      reason: `O código do extrato é composto só por números (ex.: 7238804564097517339). Valor lido: "${id}".`,
    };
  }

  const { pageSize = DEFAULT_STATEMENT_PAGE_SIZE, sortOrder = "DESC", pageToken } = options;

  if (
    !Number.isInteger(pageSize) ||
    pageSize < MIN_STATEMENT_PAGE_SIZE ||
    pageSize > MAX_STATEMENT_PAGE_SIZE
  ) {
    return {
      ok: false,
      reason: `page_size precisa ser um inteiro entre ${MIN_STATEMENT_PAGE_SIZE} e ${MAX_STATEMENT_PAGE_SIZE} (informado: ${pageSize}).`,
    };
  }

  const token = pageToken?.trim() ?? "";
  if (token !== "" && !PAGE_TOKEN_PATTERN.test(token)) {
    return {
      ok: false,
      reason:
        "O page_token deve ser copiado exatamente como veio em next_page_token (letras, números e + / = _ -). " +
        "Espaços ou outros caracteres indicam que ele foi quebrado no copiar/colar.",
    };
  }

  // Ordem alfabética: page_size, page_token, sort_field, sort_order.
  const params = [`page_size=${pageSize}`];
  if (token !== "") params.push(`page_token=${token}`);
  params.push(`sort_field=${STATEMENT_SORT_FIELD}`, `sort_order=${sortOrder}`);

  return {
    ok: true,
    path: `/finance/${STATEMENT_API_VERSION}/statements/${id}/statement_transactions?${params.join("&")}`,
  };
}

/* ------------------------------------------------------------------ */
/* Transações a liquidar — /finance/202507/orders/unsettled            */
/* ------------------------------------------------------------------ */

/**
 * Mesmo `sort_field` do extrato, e pela mesma razão: é OBRIGATÓRIO e só
 * aceita um valor. Fica em uma constante própria porque são endpoints
 * independentes na documentação — se um dia um deles passar a aceitar
 * outro campo, só esta muda.
 */
export const UNSETTLED_SORT_FIELD = "order_create_time";

/** Faixa aceita por `page_size` (padrão da API: 20). */
export const MIN_UNSETTLED_PAGE_SIZE = 1;
export const MAX_UNSETTLED_PAGE_SIZE = 100;

/** Padrão desta aplicação: o teto, para reduzir o número de assinaturas. */
export const DEFAULT_UNSETTLED_PAGE_SIZE = MAX_UNSETTLED_PAGE_SIZE;

/**
 * Início padrão da janela quando só `search_time_lt` é informado,
 * conforme a documentação (`20250101`). A API aplica esse padrão sozinha
 * — o valor existe aqui só para a tela poder avisar o usuário.
 */
export const UNSETTLED_DEFAULT_SEARCH_START = "01/01/2025";

export interface UnsettledEndpointOptions {
  pageSize?: number;
  sortOrder?: StatementSortOrder;
  /** `next_page_token` da página anterior; ausente na primeira página. */
  pageToken?: string;
  /** Início da janela de `order_create_time`, em epoch (segundos). */
  searchTimeGe?: number;
  /** Fim da janela, EXCLUSIVO (`lt`, não `le`), em epoch (segundos). */
  searchTimeLt?: number;
}

export type SearchTimeResult =
  | { ok: true; epoch: number | undefined }
  | { ok: false; reason: string };

/**
 * Converte o que foi digitado no filtro de data para o epoch em segundos
 * que a API espera. Campo vazio devolve `undefined` — ausência é válida e
 * diferente de erro, então o resultado distingue as duas coisas.
 *
 * Aceita duas formas:
 * - `AAAA-MM-DD` (o que `<input type="date">` produz), interpretado no
 *   fuso LOCAL. O app é todo em pt-BR e o usuário concilia por data local;
 *   usar UTC deslocaria a janela em 3h e faria pedidos do fim do dia caírem
 *   no dia seguinte.
 * - Um Unix timestamp em segundos já pronto, para quem copiou de outro
 *   sistema.
 *
 * `bound` decide como uma DATA vira instante:
 * - `start` → 00:00 do próprio dia (o `ge` é inclusivo).
 * - `end`   → 00:00 do dia SEGUINTE. O parâmetro é `search_time_lt`, ou
 *   seja, estritamente menor; sem somar um dia, escolher 31/01 excluiria
 *   o dia 31 inteiro. Um timestamp digitado à mão vai literal — ali o
 *   usuário já escolheu o instante exato.
 */
export function parseSearchTime(raw: string, bound: "start" | "end"): SearchTimeResult {
  const value = raw.trim();
  if (value === "") return { ok: true, epoch: undefined };

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoMatch !== null) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    // `new Date(2025, 1, 31)` vira 03/03 sem reclamar: a checagem de
    // round-trip é o que recusa uma data que não existe.
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return { ok: false, reason: `A data ${value} não existe no calendário.` };
    }

    if (bound === "end") date.setDate(date.getDate() + 1);
    return { ok: true, epoch: Math.floor(date.getTime() / 1000) };
  }

  if (/^\d+$/.test(value)) {
    // 13 dígitos é quase sempre epoch em MILISSEGUNDOS copiado de um log:
    // aceitar geraria uma janela no ano 48000 e a API devolveria vazio.
    if (value.length === 13) {
      return {
        ok: false,
        reason:
          `${value} parece estar em milissegundos. A API usa Unix timestamp em SEGUNDOS — ` +
          `use ${value.slice(0, 10)}.`,
      };
    }
    const epoch = Number(value);
    if (epoch <= 0) return { ok: false, reason: "O timestamp precisa ser maior que zero." };
    return { ok: true, epoch };
  }

  return {
    ok: false,
    reason: `Data inválida: "${value}". Use o formato AAAA-MM-DD ou um Unix timestamp em segundos.`,
  };
}

/**
 * Monta `/finance/{versão}/orders/unsettled?...`.
 *
 * Único endpoint da aplicação SEM código nenhum: a consulta é da loja
 * inteira, e tudo que a restringe (janela de datas, paginação, ordenação)
 * vai na query — portanto é assinado junto. Por isso não há o que validar
 * antes de montar: sem nenhum filtro o caminho já é válido e traz tudo
 * que está pendente de liquidação.
 *
 * Os parâmetros saem em ordem alfabética, como no extrato, para que duas
 * montagens da mesma consulta gerem exatamente a mesma string.
 */
export function buildUnsettledEndpoint(options: UnsettledEndpointOptions = {}): EndpointResult {
  const {
    pageSize = DEFAULT_UNSETTLED_PAGE_SIZE,
    sortOrder = "DESC",
    pageToken,
    searchTimeGe,
    searchTimeLt,
  } = options;

  if (
    !Number.isInteger(pageSize) ||
    pageSize < MIN_UNSETTLED_PAGE_SIZE ||
    pageSize > MAX_UNSETTLED_PAGE_SIZE
  ) {
    return {
      ok: false,
      reason: `page_size precisa ser um inteiro entre ${MIN_UNSETTLED_PAGE_SIZE} e ${MAX_UNSETTLED_PAGE_SIZE} (informado: ${pageSize}).`,
    };
  }

  const token = pageToken?.trim() ?? "";
  if (token !== "" && !PAGE_TOKEN_PATTERN.test(token)) {
    return {
      ok: false,
      reason:
        "O page_token deve ser copiado exatamente como veio em next_page_token (letras, números e + / = _ -). " +
        "Espaços ou outros caracteres indicam que ele foi quebrado no copiar/colar.",
    };
  }

  for (const [name, epoch] of [
    ["search_time_ge", searchTimeGe],
    ["search_time_lt", searchTimeLt],
  ] as const) {
    if (epoch === undefined) continue;
    if (!Number.isInteger(epoch) || epoch <= 0) {
      return { ok: false, reason: `${name} precisa ser um Unix timestamp em segundos.` };
    }
  }

  // Janela invertida devolveria zero transações sem erro nenhum da API —
  // o tipo de resultado que passa por "não tenho nada a receber".
  if (searchTimeGe !== undefined && searchTimeLt !== undefined && searchTimeGe >= searchTimeLt) {
    return {
      ok: false,
      reason: "O início da janela precisa ser anterior ao fim (search_time_ge < search_time_lt).",
    };
  }

  // Ordem alfabética: page_size, page_token, search_time_ge, search_time_lt,
  // sort_field, sort_order.
  const params = [`page_size=${pageSize}`];
  if (token !== "") params.push(`page_token=${token}`);
  if (searchTimeGe !== undefined) params.push(`search_time_ge=${searchTimeGe}`);
  if (searchTimeLt !== undefined) params.push(`search_time_lt=${searchTimeLt}`);
  params.push(`sort_field=${UNSETTLED_SORT_FIELD}`, `sort_order=${sortOrder}`);

  return {
    ok: true,
    path: `/finance/${UNSETTLED_API_VERSION}/orders/unsettled?${params.join("&")}`,
  };
}

/**
 * Descobre o tipo de recurso pelo path da URL assinada, para que a
 * validação e a exibição não dependam da aba selecionada — colar uma URL
 * de pedido com a aba de produto aberta continua funcionando.
 */
export function detectResourceKind(path: string): ResourceKind {
  if (path.startsWith("/product/")) return "product";
  if (path.startsWith("/order/")) return "order";
  // Os dois endpoints de finanças terminam em /statement_transactions e só
  // se distinguem pelo segmento do meio: /orders/{id} traz as transações
  // de UM pedido; /statements/{id} traz as do repasse inteiro.
  if (path.startsWith("/finance/")) {
    // As transações a liquidar são o único endpoint de finanças sem ID no
    // path: o caminho termina em /orders/unsettled e vale para a loja
    // inteira. Testar isso antes evita confundi-lo com /orders/{id}/...
    if (/\/orders\/unsettled\/?$/.test(path)) return "unsettled";
    return path.includes("/statements/") ? "statement" : "transaction";
  }
  return "other";
}
