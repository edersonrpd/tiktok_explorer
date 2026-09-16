import { useMemo, useState } from "react";
import { Landmark, Link2, Package, Receipt, Tag } from "lucide-react";
import {
  buildOrderEndpoint,
  buildProductEndpoint,
  buildStatementEndpoint,
  buildTransactionEndpoint,
  DEFAULT_STATEMENT_PAGE_SIZE,
  MAX_STATEMENT_PAGE_SIZE,
  MIN_STATEMENT_PAGE_SIZE,
  parseOrderIds,
  STATEMENT_SORT_FIELD,
  STATEMENT_SORT_ORDERS,
  type StatementSortOrder,
} from "../lib/endpoint";
import { TIKTOK_API_HOST } from "../lib/signedUrl";
import { Card, CopyButton } from "./ui";

type BuilderTab = "product" | "order" | "transaction" | "statement";

/**
 * Passo 1 do fluxo: informar os códigos e obter o endpoint que será
 * enviado ao sistema interno de assinatura.
 *
 * Os endpoints diferem em onde o código entra: o ID do produto e o do
 * extrato vão no path, enquanto os IDs de pedido vão na query (`ids`).
 * Tudo que está na query é assinado junto — daí o caminho de pedidos sair
 * com `?ids=...` e o do extrato já sair com `sort_field` e a paginação.
 */
export function EndpointBuilder() {
  const [tab, setTab] = useState<BuilderTab>("product");
  const [productId, setProductId] = useState("");
  const [orderIds, setOrderIds] = useState("");
  const [transactionOrderId, setTransactionOrderId] = useState("");
  const [statementId, setStatementId] = useState("");
  const [pageSize, setPageSize] = useState(String(DEFAULT_STATEMENT_PAGE_SIZE));
  const [sortOrder, setSortOrder] = useState<StatementSortOrder>("DESC");
  const [pageToken, setPageToken] = useState("");

  const productResult = useMemo(() => buildProductEndpoint(productId), [productId]);
  const orderResult = useMemo(() => buildOrderEndpoint(orderIds), [orderIds]);
  const parsedOrderIds = useMemo(() => parseOrderIds(orderIds), [orderIds]);
  const transactionResult = useMemo(
    () => buildTransactionEndpoint(transactionOrderId),
    [transactionOrderId],
  );
  const statementResult = useMemo(
    () =>
      buildStatementEndpoint(statementId, {
        // Campo vazio cai no padrão; texto inválido vira NaN e o builder
        // recusa explicando a faixa aceita.
        pageSize: pageSize.trim() === "" ? DEFAULT_STATEMENT_PAGE_SIZE : Number(pageSize),
        sortOrder,
        pageToken,
      }),
    [statementId, pageSize, sortOrder, pageToken],
  );

  const RESULTS: Record<BuilderTab, { result: typeof productResult; input: string }> = {
    product: { result: productResult, input: productId },
    order: { result: orderResult, input: orderIds },
    transaction: { result: transactionResult, input: transactionOrderId },
    statement: { result: statementResult, input: statementId },
  };
  const { result, input } = RESULTS[tab];
  const typed = input.trim() !== "";
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
        <button
          type="button"
          onClick={() => setTab("statement")}
          className={`tab-btn flex-1 justify-center ${tab === "statement" ? "tab-active" : ""}`}
        >
          <Landmark className="mr-1.5 h-3.5 w-3.5" />
          Extrato
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

      {tab === "statement" && (
        <>
          <label htmlFor="statement-id" className="mb-1 block text-xs font-bold t-3">
            Código do extrato (statement_id)
          </label>
          <input
            id="statement-id"
            value={statementId}
            onChange={(e) => setStatementId(e.target.value)}
            spellCheck={false}
            inputMode="numeric"
            placeholder="7238804564097517339"
            className="inp font-mono"
          />

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="statement-page-size" className="mb-1 block text-xs font-bold t-3">
                page_size
              </label>
              <input
                id="statement-page-size"
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value)}
                inputMode="numeric"
                min={MIN_STATEMENT_PAGE_SIZE}
                max={MAX_STATEMENT_PAGE_SIZE}
                className="inp font-mono"
              />
            </div>
            <div>
              <label htmlFor="statement-sort-order" className="mb-1 block text-xs font-bold t-3">
                sort_order
              </label>
              <select
                id="statement-sort-order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as StatementSortOrder)}
                className="inp font-mono"
              >
                {STATEMENT_SORT_ORDERS.map((order) => (
                  <option key={order} value={order}>
                    {order}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-bold t-3">
              page_token (só a partir da 2ª página)
            </summary>
            <textarea
              value={pageToken}
              onChange={(e) => setPageToken(e.target.value)}
              spellCheck={false}
              rows={2}
              aria-label="page_token"
              placeholder="cole aqui o next_page_token devolvido na página anterior"
              className="inp mt-1 font-mono leading-relaxed"
            />
            <p className="mt-1 text-[11px] t-4">
              Cole exatamente como veio, inclusive <code>+</code>, <code>/</code> e <code>=</code>.
              Cada página é uma assinatura nova, porque o token faz parte da query assinada.
            </p>
          </details>

          <p className="mt-2 text-[11px] t-3">
            <code>sort_field={STATEMENT_SORT_FIELD}</code> é obrigatório e entra sozinho — a
            documentação não aceita outro valor. Este endpoint exige o escopo{" "}
            <code>seller.finance.info</code> no app.
          </p>
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
        {tab === "statement" &&
          " Os parâmetros da query já vão na URL porque são assinados junto com os demais."}
      </p>
    </Card>
  );
}
