import { useMemo, useState } from "react";
import { Link2, Package, Receipt, Tag } from "lucide-react";
import {
  buildOrderEndpoint,
  buildProductEndpoint,
  buildTransactionEndpoint,
  parseOrderIds,
} from "../lib/endpoint";
import { TIKTOK_API_HOST } from "../lib/signedUrl";
import { Card, CopyButton } from "./ui";

type BuilderTab = "product" | "order" | "transaction";

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
  const [transactionOrderId, setTransactionOrderId] = useState("");

  const productResult = useMemo(() => buildProductEndpoint(productId), [productId]);
  const orderResult = useMemo(() => buildOrderEndpoint(orderIds), [orderIds]);
  const parsedOrderIds = useMemo(() => parseOrderIds(orderIds), [orderIds]);
  const transactionResult = useMemo(
    () => buildTransactionEndpoint(transactionOrderId),
    [transactionOrderId],
  );

  const result =
    tab === "product" ? productResult : tab === "order" ? orderResult : transactionResult;
  const typed =
    (tab === "product" ? productId : tab === "order" ? orderIds : transactionOrderId).trim() !==
    "";
  const fullUrl = result.ok ? `${TIKTOK_API_HOST}${result.path}` : null;

  return (
    <Card title="1. Montar endpoint para assinatura" icon={<Link2 />}>
      <div className="tab-bar mb-3 w-full">
        <button
          type="button"
          onClick={() => setTab("product")}
          className={`tab-btn flex-1 justify-center ${tab === "product" ? "tab-active" : ""}`}
        >
          <Tag className="mr-1.5 h-3.5 w-3.5" />
          Anúncio
        </button>
        <button
          type="button"
          onClick={() => setTab("order")}
          className={`tab-btn flex-1 justify-center ${tab === "order" ? "tab-active" : ""}`}
        >
          <Package className="mr-1.5 h-3.5 w-3.5" />
          Pedidos
        </button>
        <button
          type="button"
          onClick={() => setTab("transaction")}
          className={`tab-btn flex-1 justify-center ${tab === "transaction" ? "tab-active" : ""}`}
        >
          <Receipt className="mr-1.5 h-3.5 w-3.5" />
          Transações
        </button>
      </div>

      {tab === "product" && (
        <>
          <label htmlFor="product-id" className="mb-1 block text-xs font-bold t-3">
            Código do anúncio (product_id)
          </label>
          <input
            id="product-id"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            spellCheck={false}
            inputMode="numeric"
            placeholder="1736320032383141477"
            className="inp font-mono"
          />
        </>
      )}

      {tab === "order" && (
        <>
          <label htmlFor="order-ids" className="mb-1 block text-xs font-bold t-3">
            Códigos de pedido (order ids) — um ou vários
          </label>
          <textarea
            id="order-ids"
            value={orderIds}
            onChange={(e) => setOrderIds(e.target.value)}
            spellCheck={false}
            rows={3}
            placeholder={"576461413038785752, 576461413038785753\nou um por linha (colando de planilha)"}
            className="inp font-mono leading-relaxed"
          />
          {parsedOrderIds.length > 0 && (
            <p className="mt-1 text-[11px] t-3">
              {parsedOrderIds.length} pedido(s) reconhecido(s). Separe por vírgula, espaço ou
              quebra de linha — repetidos são removidos.
            </p>
          )}
        </>
      )}

      {tab === "transaction" && (
        <>
          <label htmlFor="transaction-order-id" className="mb-1 block text-xs font-bold t-3">
            Código do pedido (order_id) — um único pedido
          </label>
          <input
            id="transaction-order-id"
            value={transactionOrderId}
            onChange={(e) => setTransactionOrderId(e.target.value)}
            spellCheck={false}
            inputMode="numeric"
            placeholder="5793990727963214852"
            className="inp font-mono"
          />
        </>
      )}

      {typed && !result.ok && (
        <p className="alert alert-error mt-2 px-3 py-2 text-xs t-2">{result.reason}</p>
      )}

      {fullUrl !== null && (
        <div className="panel-success mt-2 flex items-center gap-2 px-3 py-2">
          <code className="flex-1 select-all break-all font-mono text-xs t-1">{fullUrl}</code>
          <CopyButton text={fullUrl} label="Copiar" />
        </div>
      )}

      <p className="mt-2 text-[11px] t-4">
        Envie esta URL ao sistema interno de assinatura. Ele acrescenta shop_cipher, app_key,
        timestamp e sign, e devolve a URL assinada para colar no passo 2.
        {tab === "order" && " O ids já vai na query porque é assinado junto com os demais parâmetros."}
      </p>
    </Card>
  );
}
