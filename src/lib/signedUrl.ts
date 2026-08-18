/**
 * Normalização e validação da URL assinada do TikTok Shop.
 *
 * REGRA INEGOCIÁVEL — a query string é uma STRING OPACA:
 * A assinatura (`sign`) é calculada pelo sistema interno sobre o path e os
 * parâmetros exatamente como foram serializados. Qualquer re-encoding,
 * reordenação, adição ou remoção de parâmetro invalida a assinatura e a
 * API devolve o erro 106001.
 *
 * Por isso este módulo NUNCA usa `new URL()` / `URLSearchParams` para
 * reconstruir a URL de envio: essas APIs re-codificam caracteres e podem
 * reordenar parâmetros. Toda a manipulação aqui é feita com operações de
 * string: cortar prefixos conhecidos do início e separar no PRIMEIRO `?`.
 * O parse de parâmetros feito em `parseQueryParams` serve apenas para
 * EXIBIÇÃO e VALIDAÇÃO — o que vai para a rede é sempre a string original.
 */

import { detectResourceKind, type ResourceKind } from "./endpoint";

export const TIKTOK_API_HOST = "https://open-api.tiktokglobalshop.com";

/** Parâmetros de assinatura, presentes em toda URL assinada. */
export const SIGNATURE_PARAMS = ["shop_cipher", "app_key", "timestamp", "sign"] as const;

/**
 * Parâmetros de negócio exigidos por endpoint, além dos de assinatura.
 * Em /order/.../orders os IDs vão na query (`ids`) e por isso são
 * assinados junto — precisam existir antes da assinatura.
 */
const ENDPOINT_PARAMS: Record<ResourceKind, readonly string[]> = {
  product: [],
  order: ["ids"],
  other: [],
};

/** Todos os parâmetros esperados para o tipo de recurso detectado. */
export function requiredParamsFor(kind: ResourceKind): string[] {
  return [...SIGNATURE_PARAMS, ...ENDPOINT_PARAMS[kind]];
}

/** Idade máxima (em segundos) do timestamp antes de considerarmos a assinatura provavelmente expirada. */
export const SIGNATURE_MAX_AGE_SECONDS = 4 * 60;

export interface QueryParam {
  name: string;
  /** Valor bruto, exatamente como veio na URL (sem decode). */
  value: string;
}

export interface NormalizedUrl {
  /** Path + query prontos para concatenar após o prefixo do proxy (ex.: "/product/...?...&sign=..."). */
  pathWithQuery: string;
  /** Somente o path (antes do primeiro `?`). */
  path: string;
  /** Query string bruta, intacta (depois do primeiro `?`). */
  rawQuery: string;
  /** O que foi removido do início da entrada, para informar o usuário. */
  strippedPrefix: "file://" | typeof TIKTOK_API_HOST | null;
}

export type ValidationIssue =
  | { kind: "empty" }
  | { kind: "placeholder"; found: string }
  | { kind: "missing-params"; missing: string[] }
  | { kind: "no-query" };

export interface ValidationResult {
  /** Erros que bloqueiam o envio. */
  errors: ValidationIssue[];
  /** Aviso não bloqueante de assinatura provavelmente expirada. */
  expiredWarning: { ageSeconds: number } | null;
  /** Parâmetros detectados, na ordem em que aparecem na query. */
  params: QueryParam[];
  /** Tipo de recurso deduzido do path (decide validação e exibição). */
  resourceKind: ResourceKind;
}

/**
 * Remove prefixos conhecidos (`file:///` ou o host da API) preservando
 * path + query byte a byte. Só corta do INÍCIO da string; nada depois do
 * primeiro caractere do path é tocado.
 */
export function normalizeSignedUrl(input: string): NormalizedUrl {
  const trimmed = input.trim();
  let rest = trimmed;
  let strippedPrefix: NormalizedUrl["strippedPrefix"] = null;

  if (rest.startsWith("file://")) {
    // "file:///product/..." → corta "file://" e sobra "/product/..." intacto.
    rest = rest.slice("file://".length);
    strippedPrefix = "file://";
  } else if (rest.startsWith(TIKTOK_API_HOST)) {
    rest = rest.slice(TIKTOK_API_HOST.length);
    strippedPrefix = TIKTOK_API_HOST;
  }

  // Garante a barra inicial sem tocar no restante.
  if (rest !== "" && !rest.startsWith("/")) {
    rest = `/${rest}`;
  }

  // Separa no PRIMEIRO `?`. O que vem depois é opaco e nunca é reprocessado.
  const qIndex = rest.indexOf("?");
  const path = qIndex === -1 ? rest : rest.slice(0, qIndex);
  const rawQuery = qIndex === -1 ? "" : rest.slice(qIndex + 1);

  return { pathWithQuery: rest, path, rawQuery, strippedPrefix };
}

/**
 * Parse SOMENTE para exibição/validação. Divide em `&` e no primeiro `=`
 * de cada par, sem decodificar valores — assim o painel mostra exatamente
 * os bytes que serão enviados.
 */
export function parseQueryParams(rawQuery: string): QueryParam[] {
  if (rawQuery === "") return [];
  return rawQuery.split("&").map((pair) => {
    const eq = pair.indexOf("=");
    if (eq === -1) return { name: pair, value: "" };
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1) };
  });
}

/** Detecta placeholder de product_id não substituído (cru ou percent-encoded). */
export function findPlaceholder(pathWithQuery: string): string | null {
  if (pathWithQuery.includes("{product_id}")) return "{product_id}";
  const lower = pathWithQuery.toLowerCase();
  if (lower.includes("%7bproduct_id%7d")) return "%7Bproduct_id%7D";
  return null;
}

/**
 * Valida a URL normalizada. `nowSeconds` é injetável para teste
 * (epoch em segundos; default: relógio atual).
 */
export function validateSignedUrl(
  normalized: NormalizedUrl,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const params = parseQueryParams(normalized.rawQuery);
  const kind = detectResourceKind(normalized.path);
  const required = requiredParamsFor(kind);

  if (normalized.pathWithQuery === "" || normalized.pathWithQuery === "/") {
    return { errors: [{ kind: "empty" }], expiredWarning: null, params, resourceKind: kind };
  }

  const placeholder = findPlaceholder(normalized.pathWithQuery);
  if (placeholder !== null) {
    errors.push({ kind: "placeholder", found: placeholder });
  }

  if (normalized.rawQuery === "") {
    errors.push({ kind: "no-query" });
    errors.push({ kind: "missing-params", missing: required });
    return { errors, expiredWarning: null, params, resourceKind: kind };
  }

  const names = new Set(params.map((p) => p.name));
  const missing = required.filter((name) => !names.has(name));
  if (missing.length > 0) {
    errors.push({ kind: "missing-params", missing });
  }

  let expiredWarning: ValidationResult["expiredWarning"] = null;
  const timestampParam = params.find((p) => p.name === "timestamp");
  if (timestampParam !== undefined) {
    const ts = Number(timestampParam.value);
    if (Number.isFinite(ts) && ts > 0) {
      const ageSeconds = nowSeconds - ts;
      if (ageSeconds > SIGNATURE_MAX_AGE_SECONDS) {
        expiredWarning = { ageSeconds };
      }
    }
  }

  return { errors, expiredWarning, params, resourceKind: kind };
}

/** Mensagem amigável para cada erro de validação. */
export function describeIssue(issue: ValidationIssue): string {
  switch (issue.kind) {
    case "empty":
      return "Cole a URL assinada antes de consultar.";
    case "placeholder":
      return `O placeholder ${issue.found} não foi substituído pelo ID real antes de assinar. Assine novamente com o ID.`;
    case "missing-params":
      return `Parâmetros obrigatórios ausentes na URL: ${issue.missing.join(", ")}.`;
    case "no-query":
      return "A URL não tem query string — uma URL assinada sempre carrega shop_cipher, app_key, timestamp e sign.";
  }
}
