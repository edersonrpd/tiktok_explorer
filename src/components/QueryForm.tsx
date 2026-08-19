import { useMemo, useState } from "react";
import {
  decodeSeparators,
  describeIssue,
  normalizeSignedUrl,
  validateSignedUrl,
  TIKTOK_API_HOST,
  type NormalizedUrl,
} from "../lib/signedUrl";
import { formatAge } from "../lib/format";
import { ParamsPanel } from "./ParamsPanel";

interface QueryFormProps {
  token: string;
  onTokenChange: (token: string) => void;
  onSubmit: (normalized: NormalizedUrl) => void;
  loading: boolean;
}

/**
 * Tela de consulta: URL assinada (textarea) + access token (persistido em
 * localStorage pelo App). A URL não persiste de propósito — expira em
 * minutos e guardar só geraria confusão.
 */
export function QueryForm({ token, onTokenChange, onSubmit, loading }: QueryFormProps) {
  const [url, setUrl] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Normaliza e valida a cada tecla; o painel de parâmetros fica sempre visível.
  const normalized = useMemo(() => normalizeSignedUrl(url), [url]);
  const validation = useMemo(() => validateSignedUrl(normalized), [normalized]);

  const hasInput = url.trim() !== "";
  const blocked = validation.errors.length > 0;
  const encodedSeparator = validation.errors.find((e) => e.kind === "encoded-separator");
  const canSubmit = hasInput && !blocked && token.trim() !== "" && !loading;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="signed-url" className="mb-1 block text-xs font-medium text-slate-600">
          URL assinada (devolvida pelo sistema interno)
        </label>
        <textarea
          id="signed-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder={`file:///product/202309/products/123...?shop_cipher=...&app_key=...&timestamp=...&sign=...`}
          className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed focus:border-slate-500 focus:outline-none"
        />
        {normalized.strippedPrefix !== null && (
          <p className="mt-1 text-xs text-sky-700">
            ℹ️ Prefixo{" "}
            <code className="rounded bg-sky-50 px-1">
              {normalized.strippedPrefix === "file://" ? "file:///" : TIKTOK_API_HOST}
            </code>{" "}
            removido automaticamente — path e query mantidos intactos.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="access-token" className="mb-1 block text-xs font-medium text-slate-600">
          Access token (header x-tts-access-token)
        </label>
        <div className="flex gap-2">
          <input
            id="access-token"
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            spellCheck={false}
            placeholder="ROW_..."
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs focus:border-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="shrink-0 rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            {showToken ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          O token fica salvo neste navegador (localStorage). A URL assinada não é salva.
        </p>
      </div>

      {hasInput && blocked && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <p className="font-semibold">Envio bloqueado:</p>
          <ul className="mt-1 list-disc pl-4">
            {validation.errors.map((issue, i) => (
              <li key={i}>{describeIssue(issue)}</li>
            ))}
          </ul>
          {encodedSeparator !== undefined && (
            <div className="mt-2 border-t border-red-200 pt-2">
              <button
                type="button"
                onClick={() => setUrl(decodeSeparators(url))}
                className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                Trocar {encodedSeparator.found} por{" "}
                {encodedSeparator.found === "%3F" ? "?" : "&"} e testar
              </button>
              <p className="mt-1 text-[11px] text-red-600">
                Só para diagnóstico: se a assinatura tiver sido calculada sobre o caminho correto e
                apenas a URL saiu mal montada, a consulta funciona. Se voltar 106001, a assinatura
                foi calculada sobre o caminho errado e o sistema interno precisa ser corrigido.
              </p>
            </div>
          )}
        </div>
      )}

      {hasInput && !blocked && validation.expiredWarning !== null && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ Assinatura provavelmente expirada — o timestamp tem{" "}
          {formatAge(validation.expiredWarning.ageSeconds)} (limite prático: ~4 min). Gere uma
          nova antes de enviar. Você ainda pode tentar, mas o retorno esperado é o erro 106001.
        </div>
      )}

      <ParamsPanel params={validation.params} resourceKind={validation.resourceKind} />

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(normalized)}
        className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading ? "Consultando..." : "Consultar"}
      </button>
    </div>
  );
}
