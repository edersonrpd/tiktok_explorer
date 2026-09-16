import { useMemo, useState } from "react";
import {
  buildOrderEndpoint,
  buildOrderFeesEndpoint,
  buildProductEndpoint,
  FEES_API_VERSION,
  FEES_API_VERSIONS,
  ORDER_API_VERSION,
  ORDER_API_VERSIONS,
  parseOrderIds,
  type FeesApiVersion,
  type OrderApiVersion,
} from "../lib/endpoint";
import { Card, CopyButton } from "./ui";

type BuilderTab = "product" | "order" | "fees";

const TABS: Array<{ id: BuilderTab; label: string }> = [
  { id: "product", label: "Anúncio" },
  { id: "order", label: "Pedidos" },
  { id: "fees", label: "Taxas" },
];

/**
 * Passo 1 do fluxo: informar os códigos e obter o endpoint que será
 * enviado ao sistema interno de assinatura.
 *
 * As três consultas diferem em onde o código entra:
 * - anúncio e taxas levam o código no path;
 * - pedidos levam os IDs na query (`ids`), assinados junto — por isso o
 *   caminho gerado já sai com `?ids=...`.
 */
export function EndpointBuilder() {
  const [tab, setTab] = useState<BuilderTab>("product");
  const [productId, setProductId] = useState("");
  const [orderIds, setOrderIds] = useState("");
  const [feesOrderId, setFeesOrderId] = useState("");
  const [orderVersion, setOrderVersion] = useState<OrderApiVersion>(ORDER_API_VERSION);
  const [feesVersion, setFeesVersion] = useState<FeesApiVersion>(FEES_API_VERSION);

  const productResult = useMemo(() => buildProductEndpoint(productId), [productId]);
  const orderResult = useMemo(
    () => buildOrderEndpoint(orderIds, orderVersion),
    [orderIds, orderVersion],
  );
  const feesResult = useMemo(
    () => buildOrderFeesEndpoint(feesOrderId, feesVersion),
    [feesOrderId, feesVersion],
  );
  const parsedOrderIds = useMemo(() => parseOrderIds(orderIds), [orderIds]);

  const result = tab === "product" ? productResult : tab === "order" ? orderResult : feesResult;
  const rawInput = tab === "product" ? productId : tab === "order" ? orderIds : feesOrderId;
  const typed = rawInput.trim() !== "";

  return (
    <Card title="1. Montar endpoint para assinatura">
      <div className="mb-3 flex gap-1 rounded bg-slate-100 p-0.5">
        {TABS.map(({ id, label }) => (
          <TabButton key={id} active={tab === id} onClick={() => setTab(id)} label={label} />
        ))}
      </div>

      {tab === "product" && (
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
      )}

      {tab === "order" && (
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

      {tab === "fees" && (
        <>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="fees-order-id" className="text-xs font-medium text-slate-600">
              Código do pedido (order id) — um por consulta
            </label>
            <select
              value={feesVersion}
              onChange={(e) => setFeesVersion(e.target.value as FeesApiVersion)}
              aria-label="Versão do endpoint de taxas"
              className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
            >
              {FEES_API_VERSIONS.map((v) => (
                <option key={v} value={v}>
                  v{v}
                </option>
              ))}
            </select>
          </div>
          <input
            id="fees-order-id"
            value={feesOrderId}
            onChange={(e) => setFeesOrderId(e.target.value)}
            spellCheck={false}
            inputMode="numeric"
            placeholder="576461413038785752"
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs focus:border-slate-500 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Comissão, taxa de transação e impostos do pedido já liquidado — o que a plataforma
            cobrou de você. Não é o mesmo que o pagamento em <strong>Pedidos</strong>, que mostra
            só o lado do comprador.
            {feesVersion === "202309" && (
              <> A v202309 traz as mesmas taxas em campos planos e só aparece no JSON bruto.</>
            )}
          </p>
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
        {tab === "order" && " O ids já vai no caminho porque é assinado junto com os demais parâmetros."}
        {tab === "fees" && " O módulo finance costuma exigir permissão própria na autorização do app."}
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
