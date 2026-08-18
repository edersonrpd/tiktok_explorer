/**
 * Proxy de produção (Vercel Edge Function) para a API do TikTok Shop.
 *
 * Em desenvolvimento, o proxy do Vite atende /api/tts (ver vite.config.ts).
 * Em produção na Vercel, este arquivo atende o mesmo caminho: qualquer GET
 * em /api/tts/* é repassado para open-api.tiktokglobalshop.com. Como a
 * chamada sai do servidor da Vercel (não do navegador), o CORS deixa de
 * ser problema.
 *
 * PONTO SENSÍVEL — a query string é parte da assinatura:
 * Nada aqui faz parse da query. O path + query são extraídos de
 * `request.url` por operação de string (slice após o prefixo /api/tts) e
 * concatenados ao host de destino. Usar new URL()/URLSearchParams para
 * remontar a query poderia re-codificar ou reordenar parâmetros e
 * invalidar o `sign` (erro 106001).
 *
 * Runtime Edge de propósito: o handler recebe um Request padrão cuja
 * `url` preserva a query como chegou, sem a mescla de parâmetros de rota
 * (`path=...`) que o runtime Node da Vercel injeta em `req.url`/`req.query`
 * em rotas dinâmicas.
 */

export const config = { runtime: "edge" };

const TARGET_HOST = "https://open-api.tiktokglobalshop.com";
const PROXY_PREFIX = "/api/tts";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse(405, { code: -1, message: "Somente GET é suportado por este proxy." });
  }

  // request.url é a URL completa (https://host/api/tts/...?...).
  // O corte no prefixo preserva path + query byte a byte.
  const prefixIndex = request.url.indexOf(PROXY_PREFIX);
  if (prefixIndex === -1) {
    return jsonResponse(500, { code: -1, message: "Rota do proxy mal configurada." });
  }
  const pathWithQuery = request.url.slice(prefixIndex + PROXY_PREFIX.length);

  const token = request.headers.get("x-tts-access-token") ?? "";

  let upstream: Response;
  try {
    // Concatenação pura — a query assinada passa intacta.
    upstream = await fetch(TARGET_HOST + pathWithQuery, {
      method: "GET",
      headers: {
        "x-tts-access-token": token,
        "content-type": "application/json",
      },
    });
  } catch (error) {
    return jsonResponse(502, {
      code: -1,
      message: `Falha ao alcançar a API do TikTok: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

function jsonResponse(status: number, payload: { code: number; message: string }): Response {
  return new Response(JSON.stringify({ ...payload, request_id: "" }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
