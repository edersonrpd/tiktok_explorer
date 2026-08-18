import type { Product, ProductResponse } from "../types/tiktok";
import type { NormalizedUrl } from "./signedUrl";

/**
 * Camada de chamada à API do TikTok Shop, via proxy do Vite.
 *
 * PONTO SENSÍVEL — montagem da requisição:
 * A URL final é uma CONCATENAÇÃO de strings: "/tts" + pathWithQuery.
 * `pathWithQuery` já contém path e query exatamente como vieram da URL
 * assinada (ver `signedUrl.ts`). Nada aqui usa URL/URLSearchParams nem
 * encodeURIComponent — qualquer re-encoding ou reordenação invalidaria o
 * `sign` e a API devolveria o erro 106001. O proxy do Vite remove o
 * prefixo "/tts" e repassa o restante intacto (ver vite.config.ts).
 */

/** Prefixo tratado pelo proxy do Vite (ver vite.config.ts). */
const PROXY_PREFIX = "/tts";

export type FetchResult =
  | { kind: "ok"; response: ProductResponse; product: Product }
  | { kind: "api-error"; response: ProductResponse; httpStatus: number }
  | { kind: "http-error"; httpStatus: number; bodyText: string }
  | { kind: "network-error"; message: string };

export async function fetchProduct(
  normalized: NormalizedUrl,
  accessToken: string,
): Promise<FetchResult> {
  // Concatenação pura — a query assinada passa byte a byte.
  const requestUrl = PROXY_PREFIX + normalized.pathWithQuery;

  let httpResponse: Response;
  try {
    httpResponse = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "x-tts-access-token": accessToken.trim(),
        "content-type": "application/json",
      },
    });
  } catch (error) {
    return {
      kind: "network-error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const bodyText = await httpResponse.text();

  let parsed: ProductResponse;
  try {
    parsed = JSON.parse(bodyText) as ProductResponse;
  } catch {
    // Resposta não-JSON (ex.: HTML de erro do proxy): trata como erro HTTP.
    return { kind: "http-error", httpStatus: httpResponse.status, bodyText };
  }

  if (parsed.code === 0 && parsed.data !== undefined) {
    return { kind: "ok", response: parsed, product: parsed.data };
  }

  return { kind: "api-error", response: parsed, httpStatus: httpResponse.status };
}
