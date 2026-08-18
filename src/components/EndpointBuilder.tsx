import { useMemo, useState } from "react";
import { buildProductEndpoint } from "../lib/endpoint";
import { Card, CopyButton } from "./ui";

/**
 * Passo 1 do fluxo: informar o código do anúncio e obter o endpoint que
 * será enviado ao sistema interno de assinatura.
 */
export function EndpointBuilder() {
  const [productId, setProductId] = useState("");
  const result = useMemo(() => buildProductEndpoint(productId), [productId]);
  const typed = productId.trim() !== "";

  return (
    <Card title="1. Montar endpoint para assinatura">
      <label htmlFor="product-id" className="mb-1 block text-xs font-medium text-slate-600">
        Código do anúncio (product_id)
      </label>
      <input
        id="product-id"
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
        spellCheck={false}
        inputMode="numeric"
        placeholder="1736320032383141477"
        className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs focus:border-slate-500 focus:outline-none"
      />

      {typed && !result.ok && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          {result.reason}
        </p>
      )}

      {result.ok && (
        <div className="mt-2 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
          <code className="flex-1 select-all break-all font-mono text-xs text-slate-800">
            {result.path}
          </code>
          <CopyButton text={result.path} label="Copiar" />
        </div>
      )}

      <p className="mt-2 text-[11px] text-slate-400">
        Envie este caminho ao sistema interno de assinatura. Ele acrescenta shop_cipher, app_key,
        timestamp e sign, e devolve a URL assinada para colar no passo 2.
      </p>
    </Card>
  );
}
