import type { OrderListData, Product, TikTokApiResponse } from "../types/tiktok";
import type { NormalizedUrl } from "./signedUrl";
import { TARGET_HEADER, TOKEN_HEADER } from "./proxyTarget";

/**
 * Camada de chamada à API do TikTok Shop, sempre via proxy de mesma origem:
 * em desenvolvimento é o middleware do dev server do Vite (vite.config.ts);
 * em produção na Vercel é a Edge Function api/tts.ts. O endpoint /api/tts é
 * o mesmo nos dois ambientes, então o frontend não muda.
 *
 * PONTO SENSÍVEL — montagem da requisição:
 * O path + query assinados NÃO entram na URL da requisição: eles vão no
 * header `x-tts-target`, exatamente como vieram da URL assinada (ver
 * `signedUrl.ts`). Isso mantém a rota do proxy estática e impede que
 * qualquer roteador (Vite, Vercel) reescreva ou reordene a query — o que
 * invalidaria o `sign` e devolveria o erro 106001. Nada aqui usa
 * URL/URLSearchParams nem encodeURIComponent.
 */

/** Endpoint atendido pelo middleware do Vite (dev) e pela Edge Function (Vercel). */
const PROXY_ENDPOINT = "/api/tts";

/** Falhas possíveis, iguais para qualquer endpoint. */
export type FetchFailure =
  | { kind: "api-error"; response: TikTokApiResponse<unknown>; httpStatus: number }
  | { kind: "proxy-error"; message: string; httpStatus: number }
  | { kind: "http-error"; httpStatus: number; bodyText: string }
  | { kind: "network-error"; message: string };

export type FetchResult<T> =
  | { kind: "ok"; response: TikTokApiResponse<T>; data: T }
  | FetchFailure;

/** Formato do corpo de erro emitido pelo próprio proxy (ver proxyTarget.ts). */
interface ProxyErrorBody {
  proxy_error: true;
  message: string;
}

function isProxyErrorBody(value: unknown): value is ProxyErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { proxy_error?: unknown }).proxy_error === true
  );
}

/**
 * Executa a chamada e devolve `data` já tipado conforme o endpoint.
 * O caminho de rede é o mesmo para produto, pedidos ou qualquer outro
 * endpoint — só o tipo de `data` muda.
 */
export async function fetchResource<T>(
  normalized: NormalizedUrl,
  accessToken: string,
): Promise<FetchResult<T>> {
  let httpResponse: Response;
  try {
    httpResponse = await fetch(PROXY_ENDPOINT, {
      method: "GET",
      // A URL do proxy é constante, então o cache do navegador poderia
      // devolver a resposta de outro produto — daí o no-store.
      cache: "no-store",
      headers: {
        [TOKEN_HEADER]: accessToken.trim(),
        // String opaca: path + query assinados, sem qualquer transformação.
        [TARGET_HEADER]: normalized.pathWithQuery,
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    // Resposta não-JSON (ex.: página de erro da hospedagem): erro HTTP.
    return { kind: "http-error", httpStatus: httpResponse.status, bodyText };
  }

  if (isProxyErrorBody(parsed)) {
    return { kind: "proxy-error", message: parsed.message, httpStatus: httpResponse.status };
  }

  const response = parsed as TikTokApiResponse<T>;
  if (response.code === 0 && response.data !== undefined) {
    return { kind: "ok", response, data: response.data };
  }

  return { kind: "api-error", response, httpStatus: httpResponse.status };
}

/** GET /product/202309/products/{id} */
export function fetchProduct(
  normalized: NormalizedUrl,
  accessToken: string,
): Promise<FetchResult<Product>> {
  return fetchResource<Product>(normalized, accessToken);
}

/** GET /order/202507/orders?ids=... */
export function fetchOrders(
  normalized: NormalizedUrl,
  accessToken: string,
): Promise<FetchResult<OrderListData>> {
  return fetchResource<OrderListData>(normalized, accessToken);
}
