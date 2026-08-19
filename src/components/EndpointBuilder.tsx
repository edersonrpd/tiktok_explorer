import { useMemo, useState } from "react";
import {
  buildOrderEndpoint,
  buildProductEndpoint,
  ORDER_API_VERSION,
  ORDER_API_VERSIONS,
  parseOrderIds,
  type OrderApiVersion,
} from "../lib/endpoint";
import { Card, CopyButton } from "./ui";

type BuilderTab = "product" | "order";

/**
 * Passo 1 do fluxo: informar os códigos e obter o endpoint que será
 * enviado ao sistema interno de assinatura.
 *
 * Produto e pedidos diferem: o ID do produto vai no path, enquanto os IDs
 * de pedido vão na query (`ids`) e por isso são assinados junto — daí o
 * caminho gerado para pedidos já sair com `?ids=...`.
 */
export function EndpointBuilder() {
  const [tab, setTab] = useState<BuilderTab>("product");
  const [productId, setProductId] = useState("");
  const [orderIds, setOrderIds] = useState("");
  const [orderVersion, setOrderVersion] = useState<OrderApiVersion>(ORDER_API_VERSION);

  const productResult = useMemo(() => buildProductEndpoint(productId), [productId]);
  const orderResult = useMemo(
    () => buildOrderEndpoint(orderIds, orderVersion),
    [orderIds, orderVersion],
  );
  const parsedOrderIds = useMemo(() => parseOrderIds(orderIds), [orderIds]);

  const isProduct = tab === "product";
  const result = isProduct ? productResult : orderResult;
  const typed = (isProduct ? productId : orderIds).trim() !== "";

  return (
    <Card title="1. Montar endpoint para assinatura">
      <div className="mb-3 flex gap-1 rounded bg-slate-100 p-0.5">
        <TabButton active={isProduct} onClick={() => setTab("product")} label="Anúncio" />
        <TabButton active={!isProduct} onClick={() => setTab("order")} label="Pedidos" />
      </div>

      {isProduct ? (
        <>
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
        </>
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="order-ids" className="text-xs font-medium text-slate-600">
              Códigos de pedido (order ids) — um ou vários
            </label>
            <select
              value={orderVersion}
              onChange={(e) => setOrderVersion(e.target.value as OrderApiVersion)}
              aria-label="Versão do endpoint de pedidos"
              className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
            >
              {ORDER_API_VERSIONS.map((v) => (
                <option key={v} value={v}>
                  v{v}
                </option>
              ))}
            </select>
          </div>
          <textarea
            id="order-ids"
            value={orderIds}
            onChange={(e) => setOrderIds(e.target.value)}
            spellCheck={false}
            rows={3}
            placeholder={"576461413038785752, 576461413038785753\nou um por linha (colando de planilha)"}
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs leading-relaxed focus:border-slate-500 focus:outline-none"
          />
          {parsedOrderIds.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-500">
              {parsedOrderIds.length} pedido(s) reconhecido(s). Separe por vírgula, espaço ou
              quebra de linha — repetidos são removidos.
            </p>
          )}
        </>
      )}

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
        {!isProduct && " O ids já vai no caminho porque é assinado junto com os demais parâmetros."}
      </p>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded px-3 py-1 text-xs font-medium ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
