import { useMemo, useState } from "react";
import {
  buildOrderEndpoint,
  buildProductEndpoint,
  buildStatementEndpoint,
  DEFAULT_STATEMENT_PAGE_SIZE,
  MAX_STATEMENT_PAGE_SIZE,
  MIN_STATEMENT_PAGE_SIZE,
  ORDER_API_VERSION,
  ORDER_API_VERSIONS,
  parseOrderIds,
  STATEMENT_SORT_FIELD,
  STATEMENT_SORT_ORDERS,
  type OrderApiVersion,
  type StatementSortOrder,
} from "../lib/endpoint";
import { Card, CopyButton } from "./ui";

type BuilderTab = "product" | "order" | "statement";

/**
 * Passo 1 do fluxo: informar os códigos e obter o endpoint que será
 * enviado ao sistema interno de assinatura.
 *
 * Os três endpoints diferem em onde o código entra: o ID do produto vai
 * no path; os IDs de pedido vão na query (`ids`); o extrato leva o ID no
 * path E parâmetros de paginação/ordenação na query. Tudo que está na
 * query é assinado junto — daí o caminho gerado já sair completo.
 */
export function EndpointBuilder() {
  const [tab, setTab] = useState<BuilderTab>("product");

  const [productId, setProductId] = useState("");
  const [orderIds, setOrderIds] = useState("");
  const [orderVersion, setOrderVersion] = useState<OrderApiVersion>(ORDER_API_VERSION);

  const [statementId, setStatementId] = useState("");
  const [pageSize, setPageSize] = useState(String(DEFAULT_STATEMENT_PAGE_SIZE));
  const [sortOrder, setSortOrder] = useState<StatementSortOrder>("DESC");
  const [pageToken, setPageToken] = useState("");

  const productResult = useMemo(() => buildProductEndpoint(productId), [productId]);
  const orderResult = useMemo(
    () => buildOrderEndpoint(orderIds, orderVersion),
    [orderIds, orderVersion],
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
  const parsedOrderIds = useMemo(() => parseOrderIds(orderIds), [orderIds]);

  const result =
    tab === "product" ? productResult : tab === "order" ? orderResult : statementResult;
  const rawInput = tab === "product" ? productId : tab === "order" ? orderIds : statementId;
  const typed = rawInput.trim() !== "";

  return (
    <Card title="1. Montar endpoint para assinatura">
      <div className="mb-3 flex gap-1 rounded bg-slate-100 p-0.5">
        <TabButton active={tab === "product"} onClick={() => setTab("product")} label="Anúncio" />
        <TabButton active={tab === "order"} onClick={() => setTab("order")} label="Pedidos" />
        <TabButton
          active={tab === "statement"}
          onClick={() => setTab("statement")}
          label="Extrato"
        />
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

      {tab === "statement" && (
        <>
          <label htmlFor="statement-id" className="mb-1 block text-xs font-medium text-slate-600">
            Código do extrato (statement_id)
          </label>
          <input
            id="statement-id"
            value={statementId}
            onChange={(e) => setStatementId(e.target.value)}
            spellCheck={false}
            inputMode="numeric"
            placeholder="7238804564097517339"
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs focus:border-slate-500 focus:outline-none"
          />

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="statement-page-size"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                page_size
              </label>
              <input
                id="statement-page-size"
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value)}
                inputMode="numeric"
                min={MIN_STATEMENT_PAGE_SIZE}
                max={MAX_STATEMENT_PAGE_SIZE}
                className="w-full rounded border border-slate-300 px-3 py-1.5 font-mono text-xs focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="statement-sort-order"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                sort_order
              </label>
              <select
                id="statement-sort-order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as StatementSortOrder)}
                className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-700"
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
            <summary className="cursor-pointer text-xs font-medium text-slate-600">
              page_token (só a partir da 2ª página)
            </summary>
            <textarea
              value={pageToken}
              onChange={(e) => setPageToken(e.target.value)}
              spellCheck={false}
              rows={2}
              aria-label="page_token"
              placeholder="cole aqui o next_page_token devolvido na página anterior"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-[11px] leading-relaxed focus:border-slate-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Cole exatamente como veio, inclusive <code>+</code>, <code>/</code> e <code>=</code>.
              Cada página é uma assinatura nova, porque o token faz parte da query assinada.
            </p>
          </details>

          <p className="mt-2 text-[11px] text-slate-500">
            <code className="rounded bg-slate-100 px-1">sort_field={STATEMENT_SORT_FIELD}</code> é
            obrigatório e entra sozinho — a documentação não aceita outro valor. Este endpoint
            exige o escopo <code className="rounded bg-slate-100 px-1">seller.finance.info</code>{" "}
            no app.
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
        {tab === "statement" &&
          " Os parâmetros da query já vão no caminho porque são assinados junto com os demais."}
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
