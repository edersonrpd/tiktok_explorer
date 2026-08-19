import type { FetchFailure } from "../lib/api";
import type { ResourceKind } from "../lib/endpoint";
import { explainErrorCode, NETWORK_ERROR_EXPLANATION } from "../lib/errorCodes";
import { SIGNATURE_MAX_AGE_SECONDS } from "../lib/signedUrl";
import { formatAge } from "../lib/format";

/** Códigos que significam assinatura inválida. */
const SIGNATURE_ERROR_CODES = [106001, 10008];

/**
 * Endpoints com parâmetro de negócio na query (ex.: `ids` em pedidos)
 * expõem uma falha comum do sistema que assina: ele considera apenas o
 * path e seus próprios parâmetros, ignorando os demais. Nesse caso o
 * anúncio continua funcionando e só o pedido falha — pista que vale
 * mostrar junto do erro.
 */
/**
 * O 106001 tem duas causas muito diferentes — assinatura expirada ou query
 * divergente da que foi assinada — e a mensagem da API não distingue.
 * Sabendo a idade da assinatura no envio, dá para descartar uma delas.
 */
function ageVerdictFor(code: number, signatureAge: number | null): string | null {
  if (!SIGNATURE_ERROR_CODES.includes(code) || signatureAge === null) return null;

  if (signatureAge > SIGNATURE_MAX_AGE_SECONDS) {
    return (
      `A assinatura tinha ${formatAge(signatureAge)} quando foi enviada, acima do limite prático ` +
      "de ~4 min. Gere uma nova e repita antes de investigar qualquer outra causa."
    );
  }
  return (
    `A assinatura tinha apenas ${formatAge(signatureAge)} quando foi enviada, dentro do limite — ` +
    "então NÃO é expiração. A query que chegou ao TikTok difere da que foi assinada: algum " +
    "parâmetro foi acrescentado, removido ou alterado depois da assinatura."
  );
}

function extraHintFor(code: number, resourceKind: ResourceKind): string | null {
  if (!SIGNATURE_ERROR_CODES.includes(code) || resourceKind !== "order") return null;
  return (
    "Este endpoint leva ids na query, e a assinatura precisa cobrir esse parâmetro junto com " +
    "app_key, timestamp e shop_cipher. Se a consulta de anúncio funciona e só a de pedidos falha, " +
    "o sistema interno provavelmente assina apenas o path e os parâmetros que ele mesmo adiciona, " +
    "ignorando os que já vinham no caminho."
  );
}

/**
 * Erros traduzidos para causa provável + ação, nunca JSON cru.
 * O request_id sempre aparece — é o que o suporte do TikTok pede.
 */
export function ErrorDisplay({
  result,
  resourceKind,
  signatureAge,
  sentTarget,
}: {
  result: FetchFailure;
  resourceKind: ResourceKind;
  /** Idade da assinatura no instante do envio, em segundos. */
  signatureAge: number | null;
  /** Path + query exatamente como foram enviados ao TikTok. */
  sentTarget: string;
}) {
  if (result.kind === "network-error") {
    return (
      <ErrorBox
        title={NETWORK_ERROR_EXPLANATION.title}
        action={NETWORK_ERROR_EXPLANATION.action}
        original={result.message}
      />
    );
  }

  if (result.kind === "proxy-error") {
    return (
      <ErrorBox
        title={`O proxy recusou ou não completou a chamada (HTTP ${result.httpStatus})`}
        action="O erro veio do intermediário (/api/tts), não da API do TikTok. A mensagem abaixo diz o motivo."
        original={result.message}
      />
    );
  }

  if (result.kind === "http-error") {
    return (
      <ErrorBox
        title={`Resposta inesperada (HTTP ${result.httpStatus})`}
        action={
          result.httpStatus === 404
            ? "O endpoint /api/tts não existe nesta hospedagem — a resposta é a página 404 do servidor, não da API do TikTok. Em desenvolvimento, rode npm run dev; na Vercel, confirme que o deploy inclui a função api/tts.ts (aba Functions do deployment)."
            : "A resposta não é JSON da API do TikTok. Verifique se o proxy /api/tts está ativo (dev server do Vite rodando, ou função api/tts publicada na Vercel)."
        }
        original={result.bodyText.slice(0, 500)}
      />
    );
  }

  const explanation = explainErrorCode(result.response.code);
  return (
    <ErrorBox
      title={`${explanation.title} (code ${result.response.code}, HTTP ${result.httpStatus})`}
      action={explanation.action}
      verdict={ageVerdictFor(result.response.code, signatureAge)}
      hint={extraHintFor(result.response.code, resourceKind)}
      original={result.response.message}
      requestId={result.response.request_id}
      sentTarget={SIGNATURE_ERROR_CODES.includes(result.response.code) ? sentTarget : undefined}
    />
  );
}

function ErrorBox({
  title,
  action,
  verdict,
  hint,
  original,
  requestId,
  sentTarget,
}: {
  title: string;
  action: string;
  verdict?: string | null;
  hint?: string | null;
  original?: string;
  requestId?: string;
  sentTarget?: string;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <h3 className="text-sm font-semibold text-red-800">{title}</h3>
      <p className="mt-1 text-xs text-red-700">{action}</p>
      {verdict !== undefined && verdict !== null && (
        <p className="mt-2 rounded border border-red-300 bg-white px-2 py-1.5 text-xs text-red-900">
          <strong>Idade da assinatura no envio: </strong>
          {verdict}
        </p>
      )}
      {hint !== undefined && hint !== null && (
        <p className="mt-2 rounded border border-red-200 bg-white px-2 py-1.5 text-xs text-red-800">
          <strong>Provável causa neste endpoint: </strong>
          {hint}
        </p>
      )}
      {original !== undefined && original !== "" && (
        <p className="mt-2 font-mono text-[11px] text-red-400">Mensagem original: {original}</p>
      )}
      {sentTarget !== undefined && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-red-700">
            Ver exatamente o que foi enviado ao TikTok
          </summary>
          <p className="mt-1 break-all rounded border border-red-200 bg-white px-2 py-1.5 font-mono text-[11px] text-slate-700">
            <span className="select-all">{sentTarget}</span>
          </p>
          <p className="mt-1 text-[11px] text-red-600">
            É esta string, byte a byte, que precisa ter sido assinada. Compare com o que o sistema
            interno recebeu — qualquer diferença aqui explica o 106001.
          </p>
        </details>
      )}
      {requestId !== undefined && requestId !== "" && (
        <p className="mt-2 select-all font-mono text-[11px] text-red-600">
          request_id: <strong>{requestId}</strong> (informe este código ao suporte do TikTok)
        </p>
      )}
    </div>
  );
}
