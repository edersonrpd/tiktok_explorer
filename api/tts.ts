import { proxyToTikTok, TARGET_HEADER, TOKEN_HEADER } from "../src/lib/proxyTarget";

/**
 * Proxy de produção (Vercel Edge Function) para a API do TikTok Shop.
 *
 * Rota ESTÁTICA: /api/tts. Não é uma rota dinâmica de propósito — rotas
 * catch-all podem não ser registradas como função (404 da Vercel) e o
 * roteador reescreve a URL acrescentando os parâmetros de rota à query,
 * o que corromperia a query assinada. O path + query assinados chegam no
 * header `x-tts-target` como string opaca (ver src/lib/proxyTarget.ts).
 *
 * Em desenvolvimento, o mesmo caminho é atendido pelo middleware do dev
 * server do Vite, usando exatamente esta mesma lógica compartilhada.
 */
export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  const outcome = await proxyToTikTok({
    method: request.method,
    target: request.headers.get(TARGET_HEADER),
    accessToken: request.headers.get(TOKEN_HEADER),
  });

  return new Response(outcome.body, {
    status: outcome.status,
    headers: {
      "content-type": outcome.contentType,
      // A URL do proxy é sempre a mesma (/api/tts); sem no-store, uma
      // resposta poderia ser reaproveitada para outro produto.
      "cache-control": "no-store",
    },
  });
}
