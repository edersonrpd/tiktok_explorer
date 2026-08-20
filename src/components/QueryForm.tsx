import { useMemo, useState } from "react";
import { AlertTriangle, Info, Search, Eye, EyeOff } from "lucide-react";
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
        <label htmlFor="signed-url" className="mb-1 block text-xs font-bold t-3">
          URL assinada (devolvida pelo sistema interno)
        </label>
        <textarea
          id="signed-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder={`${TIKTOK_API_HOST}/product/202309/products/1736320032383141477?shop_cipher=...&app_key=...&timestamp=...&sign=...`}
          className="inp font-mono leading-relaxed"
        />
        {normalized.strippedPrefix !== null && (
          <p className="mt-1 flex items-start gap-1 text-xs text-sky-700">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Prefixo{" "}
              <code className="rounded bg-sky-50 px-1">
                {normalized.strippedPrefix === "file://" ? "file:///" : TIKTOK_API_HOST}
              </code>{" "}
              removido automaticamente — path e query mantidos intactos.
            </span>
          </p>
        )}
      </div>

      <div>
        <label htmlFor="access-token" className="mb-1 block text-xs font-bold t-3">
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
            className="inp font-mono"
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="btn-secondary shrink-0"
          >
            {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showToken ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        <p className="mt-1 text-[11px] t-4">
          O token fica salvo neste navegador (localStorage). A URL assinada não é salva.
        </p>
      </div>

      {hasInput && blocked && (
        <div className="alert alert-error px-3 py-2 text-xs t-2">
          <p className="flex items-center gap-1.5 font-bold text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Envio bloqueado:
          </p>
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
                className="rounded border border-red-300 bg-white px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50"
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
        <div className="alert alert-warning flex items-start gap-1.5 px-3 py-2 text-xs t-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            Assinatura provavelmente expirada — o timestamp tem{" "}
            {formatAge(validation.expiredWarning.ageSeconds)} (limite prático: ~4 min). Gere uma
            nova antes de enviar. Você ainda pode tentar, mas o retorno esperado é o erro 106001.
          </span>
        </div>
      )}

      <ParamsPanel params={validation.params} resourceKind={validation.resourceKind} />

      <button type="button" disabled={!canSubmit} onClick={() => onSubmit(normalized)} className="btn-primary w-full">
        <Search className="h-4 w-4" />
        {loading ? "Consultando..." : "Consultar"}
      </button>
    </div>
  );
}
