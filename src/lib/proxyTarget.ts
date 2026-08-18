import { TIKTOK_API_HOST } from "./signedUrl";

/**
 * Lógica compartilhada do proxy, usada pelos DOIS ambientes:
 * - desenvolvimento: middleware do dev server do Vite (ver vite.config.ts)
 * - produção: Vercel Edge Function (ver api/tts.ts)
 *
 * POR QUE O ALVO VAI EM UM HEADER, E NÃO NA URL:
 * A primeira versão usava uma rota dinâmica (/api/tts/<path assinado>).
 * Isso tem dois problemas em produção: (1) a rota catch-all pode não ser
 * registrada como função, devolvendo o 404 da própria Vercel; e (2) o
 * roteador de rotas dinâmicas REESCREVE a URL, acrescentando os
 * parâmetros de rota à query string — o que corromperia exatamente a
 * query sobre a qual o `sign` foi calculado (erro 106001).
 *
 * Com o alvo em `x-tts-target`, a rota é estática (`/api/tts`) e o valor
 * assinado é uma string opaca que nenhum roteador interpreta. Aqui ele é
 * apenas validado e concatenado ao host — sem parse, decode ou reordenação.
 */

/** Header que carrega o path + query assinados, byte a byte. */
export const TARGET_HEADER = "x-tts-target";

/** Header do access token, repassado como a API do TikTok espera. */
export const TOKEN_HEADER = "x-tts-access-token";

export type TargetResult = { ok: true; url: string } | { ok: false; reason: string };

export interface ProxyOutcome {
  status: number;
  contentType: string;
  body: string;
}

/**
 * Valida o valor do header e monta a URL de destino por concatenação pura.
 *
 * A validação é de segurança, não de formato: garante que o valor é ASCII
 * imprimível (requisito de header HTTP) e que aponta para um path do host
 * do TikTok — nunca para outro host. Não interpreta nem altera a query.
 */
export function buildTargetUrl(rawTarget: string | null | undefined): TargetResult {
  if (rawTarget === null || rawTarget === undefined || rawTarget === "") {
    return { ok: false, reason: `Header ${TARGET_HEADER} ausente na requisição ao proxy.` };
  }
  if (!/^[\x21-\x7e]+$/.test(rawTarget)) {
    return {
      ok: false,
      reason: `Header ${TARGET_HEADER} contém espaços ou caracteres não-ASCII — uma URL assinada válida não tem esses caracteres.`,
    };
  }
  if (!rawTarget.startsWith("/")) {
    return {
      ok: false,
      reason: `Header ${TARGET_HEADER} deve começar com "/" (apenas path + query, sem host).`,
    };
  }
  // Bloqueia "//host" e "/\host", que alguns parsers tratam como outro host.
  if (rawTarget.startsWith("//") || rawTarget.startsWith("/\\")) {
    return {
      ok: false,
      reason: `Header ${TARGET_HEADER} não pode começar com "//" — o proxy só encaminha para ${TIKTOK_API_HOST}.`,
    };
  }
  // Concatenação pura: a query assinada passa intacta.
  return { ok: true, url: TIKTOK_API_HOST + rawTarget };
}

/** Corpo de erro do próprio proxy, distinguível de um erro da API do TikTok. */
export function proxyErrorBody(message: string): string {
  return JSON.stringify({ proxy_error: true, message });
}

export interface ProxyInput {
  method: string | undefined;
  target: string | null | undefined;
  accessToken: string | null | undefined;
}

/**
 * Encaminha a requisição para a API do TikTok e devolve status, content-type
 * e corpo crus. `fetchImpl` é injetável para teste.
 */
export async function proxyToTikTok(
  input: ProxyInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ProxyOutcome> {
  const json = "application/json";

  if (input.method !== "GET") {
    return {
      status: 405,
      contentType: json,
      body: proxyErrorBody("Somente GET é suportado por este proxy."),
    };
  }

  const target = buildTargetUrl(input.target);
  if (!target.ok) {
    return { status: 400, contentType: json, body: proxyErrorBody(target.reason) };
  }

  let upstream: Response;
  try {
    upstream = await fetchImpl(target.url, {
      method: "GET",
      headers: {
        [TOKEN_HEADER]: input.accessToken ?? "",
        "content-type": json,
      },
      // Não seguir redirecionamentos: evita reenviar o access token para
      // um destino inesperado.
      redirect: "manual",
    });
  } catch (error) {
    return {
      status: 502,
      contentType: json,
      body: proxyErrorBody(
        `Não foi possível alcançar ${TIKTOK_API_HOST}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }

  return {
    status: upstream.status,
    contentType: upstream.headers.get("content-type") ?? json,
    body: await upstream.text(),
  };
}
