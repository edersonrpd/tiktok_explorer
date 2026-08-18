/**
 * Montagem do endpoint do produto a partir do código do anúncio.
 *
 * Este é o PRIMEIRO passo do fluxo: o caminho gerado aqui é o que vai
 * para o sistema interno de assinatura, que devolve a URL assinada para
 * colar no formulário de consulta.
 *
 * O path é montado por concatenação simples, sem query e sem encoding —
 * o product_id do TikTok Shop é sempre numérico, então não há nada a
 * escapar. Nada aqui toca em assinatura: `sign`, `app_key`, `shop_cipher`
 * e `timestamp` são acrescentados pelo sistema que assina.
 */

/** Versão do endpoint de produto da Open API (parte do path assinado). */
export const PRODUCT_API_VERSION = "202309";

export type EndpointResult = { ok: true; path: string } | { ok: false; reason: string };

/**
 * Extrai o ID de um valor colado. Aceita o ID puro, mas também tolera o
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
