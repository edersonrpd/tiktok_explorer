import type { FetchResult } from "../lib/api";
import { explainErrorCode, NETWORK_ERROR_EXPLANATION } from "../lib/errorCodes";

/**
 * Erros traduzidos para causa provável + ação, nunca JSON cru.
 * O request_id sempre aparece — é o que o suporte do TikTok pede.
 */
export function ErrorDisplay({ result }: { result: Exclude<FetchResult, { kind: "ok" }> }) {
  if (result.kind === "network-error") {
    return (
      <ErrorBox
        title={NETWORK_ERROR_EXPLANATION.title}
        action={NETWORK_ERROR_EXPLANATION.action}
        original={result.message}
      />
    );
  }

  if (result.kind === "http-error") {
    return (
      <ErrorBox
        title={`Resposta inesperada (HTTP ${result.httpStatus})`}
        action="A resposta não é JSON da API do TikTok. Verifique se o proxy /api/tts está ativo (dev server do Vite rodando, ou função api/tts publicada na Vercel)."
        original={result.bodyText.slice(0, 500)}
      />
    );
  }

  const explanation = explainErrorCode(result.response.code);
  return (
    <ErrorBox
      title={`${explanation.title} (code ${result.response.code}, HTTP ${result.httpStatus})`}
      action={explanation.action}
      original={result.response.message}
      requestId={result.response.request_id}
    />
  );
}

function ErrorBox({
  title,
  action,
  original,
  requestId,
}: {
  title: string;
  action: string;
  original?: string;
  requestId?: string;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <h3 className="text-sm font-semibold text-red-800">{title}</h3>
      <p className="mt-1 text-xs text-red-700">{action}</p>
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
