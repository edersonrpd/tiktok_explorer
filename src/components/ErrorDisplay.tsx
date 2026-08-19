import type { FetchFailure } from "../lib/api";
import type { ResourceKind } from "../lib/endpoint";
import { explainErrorCode, NETWORK_ERROR_EXPLANATION } from "../lib/errorCodes";

/** Códigos que significam assinatura inválida. */
const SIGNATURE_ERROR_CODES = [106001, 10008];

/**
 * Endpoints com parâmetro de negócio na query (ex.: `ids` em pedidos)
 * expõem uma falha comum do sistema que assina: ele considera apenas o
 * path e seus próprios parâmetros, ignorando os demais. Nesse caso o
 * anúncio continua funcionando e só o pedido falha — pista que vale
 * mostrar junto do erro.
 */
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
}: {
  result: FetchFailure;
  resourceKind: ResourceKind;
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
      hint={extraHintFor(result.response.code, resourceKind)}
      original={result.response.message}
      requestId={result.response.request_id}
    />
  );
}

function ErrorBox({
  title,
  action,
  hint,
  original,
  requestId,
}: {
  title: string;
  action: string;
  hint?: string | null;
  original?: string;
  requestId?: string;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <h3 className="text-sm font-semibold text-red-800">{title}</h3>
      <p className="mt-1 text-xs text-red-700">{action}</p>
      {hint !== undefined && hint !== null && (
        <p className="mt-2 rounded border border-red-200 bg-white px-2 py-1.5 text-xs text-red-800">
          <strong>Provável causa neste endpoint: </strong>
          {hint}
        </p>
      )}
      {original !== undefined && original !== "" && (
        <p className="mt-2 font-mono text-[11px] text-red-400">Mensagem original: {original}</p>
      )}
      {requestId !== undefined && requestId !== "" && (
        <p className="mt-2 select-all font-mono text-[11px] text-red-600">
          request_id: <strong>{requestId}</strong> (informe este código ao suporte do TikTok)
        </p>
      )}
    </div>
  );
}
