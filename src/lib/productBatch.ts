import type { Product } from "../types/tiktok";
import type { FetchFailure, FetchResult } from "./api";
import { cleanProductId } from "./endpoint";
import { explainErrorCode, NETWORK_ERROR_EXPLANATION } from "./errorCodes";
import {
  describeIssue,
  normalizeSignedUrl,
  validateSignedUrl,
  type NormalizedUrl,
} from "./signedUrl";

/**
 * Extração em lote dos anúncios: cada URL assinada de detalhe
 * (`/product/{v}/products/{id}`) vira uma chamada, e o resultado é a lista
 * de produtos completos.
 *
 * POR QUE O LOTE É DE URLs JÁ ASSINADAS: esta aplicação não calcula `sign`.
 * Cada anúncio é uma chamada, e cada chamada precisa da própria assinatura
 * — o mesmo fluxo do resto do app, só que com várias URLs coladas de uma
 * vez, uma por linha.
 */

export interface BatchItem {
  /** Linha da entrada (1-based), para apontar o problema ao usuário. */
  line: number;
  productId: string;
  normalized: NormalizedUrl;
  /** Assinatura com mais de ~4 min quando o lote foi lido: provável 106001. */
  expired: boolean;
}

export interface BatchProblem {
  line: number;
  text: string;
  reason: string;
}

export interface ParsedBatch {
  items: BatchItem[];
  problems: BatchProblem[];
  /** Quantas linhas repetiam um anúncio já listado (só a primeira vale). */
  duplicates: number;
}

/** Recorta o que cabe numa mensagem de problema, sem despejar a URL inteira. */
function excerpt(text: string): string {
  return text.length > 70 ? `${text.slice(0, 70)}…` : text;
}

/**
 * Lê o que foi colado: uma URL assinada por linha. Linhas em branco são
 * ignoradas; cada uma é validada como as consultas avulsas e precisa ser
 * o DETALHE de um anúncio — qualquer outro endpoint no meio do lote seria
 * silenciosamente contado como anúncio, daí a recusa explícita.
 */
export function parseBatchInput(
  text: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): ParsedBatch {
  const items: BatchItem[] = [];
  const problems: BatchProblem[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    const value = raw.trim();
    if (value === "") return;

    const normalized = normalizeSignedUrl(value);
    const validation = validateSignedUrl(normalized, nowSeconds);

    if (validation.errors.length > 0) {
      const first = validation.errors[0];
      problems.push({
        line,
        text: excerpt(value),
        reason: first === undefined ? "URL inválida." : describeIssue(first),
      });
      return;
    }

    if (validation.resourceKind !== "product") {
      problems.push({
        line,
        text: excerpt(value),
        reason: "Não é a URL de detalhe de um anúncio (/product/…/products/{id}).",
      });
      return;
    }

    const productId = cleanProductId(normalized.path);
    if (!/^\d+$/.test(productId)) {
      problems.push({
        line,
        text: excerpt(value),
        reason: `Não foi possível ler o ID do anúncio no caminho (lido: "${productId}").`,
      });
      return;
    }

    if (seen.has(productId)) {
      duplicates += 1;
      return;
    }
    seen.add(productId);

    items.push({ line, productId, normalized, expired: validation.expiredWarning !== null });
  });

  return { items, problems, duplicates };
}

/** Texto curto de uma falha de chamada, para a lista de erros do lote. */
export function describeFailure(failure: FetchFailure): string {
  switch (failure.kind) {
    case "network-error":
      return `${NETWORK_ERROR_EXPLANATION.title}: ${failure.message}`;
    case "proxy-error":
      return `Proxy (HTTP ${failure.httpStatus}): ${failure.message}`;
    case "http-error":
      return `Resposta inesperada (HTTP ${failure.httpStatus})`;
    case "api-error": {
      const explanation = explainErrorCode(failure.response.code);
      return `${explanation.title} (code ${failure.response.code}) — request_id ${failure.response.request_id}`;
    }
  }
}

/**
 * Falhas que valem uma nova tentativa: rede, limite de taxa (429) e erro do
 * lado do TikTok (5xx). Assinatura inválida, token e anúncio inexistente
 * não mudam ao repetir, então não são repetidos.
 */
export function isTransient(failure: FetchFailure): boolean {
  switch (failure.kind) {
    case "network-error":
      return true;
    case "proxy-error":
      return failure.httpStatus === 502;
    case "http-error":
      return failure.httpStatus === 429 || failure.httpStatus >= 500;
    case "api-error":
      return failure.httpStatus === 429 || failure.httpStatus >= 500;
  }
}

export type BatchOutcome =
  | { item: BatchItem; ok: true; product: Product }
  | { item: BatchItem; ok: false; failure: FetchFailure };

export interface RunBatchOptions {
  /** Chamadas simultâneas. Baixo de propósito: a API limita a taxa por loja. */
  concurrency?: number;
  /** Tentativas extras em falha transitória. */
  retries?: number;
  onProgress?: (done: number, total: number) => void;
  /** Interrompe: o que já está em voo termina, mas nada novo começa. */
  signal?: AbortSignal;
  /** Espera entre tentativas; injetável para teste. */
  sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_BATCH_CONCURRENCY = 3;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Executa o lote com no máximo `concurrency` chamadas em voo. O resultado
 * vem na ORDEM da entrada, não na de chegada — assim a planilha exportada
 * segue a ordem em que o usuário colou as URLs. Um item interrompido
 * (`signal`) simplesmente não aparece no resultado.
 */
export async function runBatch(
  items: BatchItem[],
  fetchOne: (item: BatchItem) => Promise<FetchResult<Product>>,
  options: RunBatchOptions = {},
): Promise<BatchOutcome[]> {
  const {
    concurrency = DEFAULT_BATCH_CONCURRENCY,
    retries = 2,
    onProgress,
    signal,
    sleep = defaultSleep,
  } = options;

  const outcomes: Array<BatchOutcome | undefined> = new Array<BatchOutcome | undefined>(
    items.length,
  ).fill(undefined);
  let next = 0;
  let done = 0;

  async function runOne(item: BatchItem): Promise<BatchOutcome> {
    let attempt = 0;
    for (;;) {
      const result = await fetchOne(item);
      if (result.kind === "ok") return { item, ok: true, product: result.data };
      if (attempt >= retries || !isTransient(result) || signal?.aborted === true) {
        return { item, ok: false, failure: result };
      }
      attempt += 1;
      await sleep(attempt * 1000);
    }
  }

  async function worker(): Promise<void> {
    while (signal?.aborted !== true) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) return;

      outcomes[index] = await runOne(item);
      done += 1;
      onProgress?.(done, items.length);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker);
  await Promise.all(workers);

  return outcomes.filter((outcome): outcome is BatchOutcome => outcome !== undefined);
}
