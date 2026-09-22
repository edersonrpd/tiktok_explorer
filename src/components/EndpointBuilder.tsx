import { useMemo, useState } from "react";
import { Banknote, Hourglass, Landmark, Link2, Package, Receipt, Tag } from "lucide-react";
import {
  buildOrderEndpoint,
  buildProductEndpoint,
  buildStatementEndpoint,
  buildStatementListEndpoint,
  buildTransactionEndpoint,
  buildUnsettledEndpoint,
  DEFAULT_STATEMENT_PAGE_SIZE,
  DEFAULT_UNSETTLED_PAGE_SIZE,
  MAX_STATEMENT_PAGE_SIZE,
  MAX_UNSETTLED_PAGE_SIZE,
  DEFAULT_STATEMENT_LIST_PAGE_SIZE,
  MAX_STATEMENT_LIST_PAGE_SIZE,
  MIN_STATEMENT_LIST_PAGE_SIZE,
  MIN_STATEMENT_PAGE_SIZE,
  MIN_UNSETTLED_PAGE_SIZE,
  parseOrderIds,
  parseSearchTime,
  PAYMENT_STATUSES,
  STATEMENT_LIST_SORT_FIELD,
  STATEMENT_SORT_FIELD,
  STATEMENT_SORT_ORDERS,
  UNSETTLED_DEFAULT_SEARCH_START,
  UNSETTLED_SORT_FIELD,
  type EndpointResult,
  type PaymentStatus,
  type StatementSortOrder,
} from "../lib/endpoint";
import { TIKTOK_API_HOST } from "../lib/signedUrl";
import { Card, CopyButton } from "./ui";

type BuilderTab =
  | "product"
  | "order"
  | "transaction"
  | "statementList"
  | "statement"
  | "unsettled";

/**
 * Passo 1 do fluxo: informar os códigos e obter o endpoint que será
 * enviado ao sistema interno de assinatura.
 *
 * Os endpoints diferem em onde o código entra: o ID do produto e o do
 * extrato vão no path, enquanto os IDs de pedido vão na query (`ids`).
 * Tudo que está na query é assinado junto — daí o caminho de pedidos sair
 * com `?ids=...` e o do extrato já sair com `sort_field` e a paginação.
 *
 * As transações a liquidar são o caso extremo disso: não têm código
 * nenhum, e o que define a consulta (a janela de datas) vive inteiramente
 * na query assinada.
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
  const [unsettledFrom, setUnsettledFrom] = useState("");
  const [unsettledTo, setUnsettledTo] = useState("");
  const [unsettledPageSize, setUnsettledPageSize] = useState(String(DEFAULT_UNSETTLED_PAGE_SIZE));
  const [unsettledSortOrder, setUnsettledSortOrder] = useState<StatementSortOrder>("DESC");
  const [unsettledPageToken, setUnsettledPageToken] = useState("");
  const [listFrom, setListFrom] = useState("");
  const [listTo, setListTo] = useState("");
  const [listPageSize, setListPageSize] = useState(String(DEFAULT_STATEMENT_LIST_PAGE_SIZE));
  const [listSortOrder, setListSortOrder] = useState<StatementSortOrder>("DESC");
  const [listPaymentStatus, setListPaymentStatus] = useState<PaymentStatus>("");
  const [listPageToken, setListPageToken] = useState("");

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

  const unsettledResult = useMemo((): EndpointResult => {
    // A data inválida precisa ser reportada com a própria explicação de
    // `parseSearchTime` ("a data não existe", "está em milissegundos"):
    // convertê-la em undefined montaria uma consulta silenciosamente sem
    // filtro, que é o pior resultado possível aqui.
    const from = parseSearchTime(unsettledFrom, "start");
    if (!from.ok) return from;
    const to = parseSearchTime(unsettledTo, "end");
    if (!to.ok) return to;

    return buildUnsettledEndpoint({
      pageSize:
        unsettledPageSize.trim() === ""
          ? DEFAULT_UNSETTLED_PAGE_SIZE
          : Number(unsettledPageSize),
      sortOrder: unsettledSortOrder,
      pageToken: unsettledPageToken,
      searchTimeGe: from.epoch,
      searchTimeLt: to.epoch,
    });
  }, [unsettledFrom, unsettledTo, unsettledPageSize, unsettledSortOrder, unsettledPageToken]);

  const statementListResult = useMemo((): EndpointResult => {
    const from = parseSearchTime(listFrom, "start");
    if (!from.ok) return from;
    const to = parseSearchTime(listTo, "end");
    if (!to.ok) return to;

    return buildStatementListEndpoint({
      pageSize:
        listPageSize.trim() === "" ? DEFAULT_STATEMENT_LIST_PAGE_SIZE : Number(listPageSize),
      sortOrder: listSortOrder,
      pageToken: listPageToken,
      statementTimeGe: from.epoch,
      statementTimeLt: to.epoch,
      paymentStatus: listPaymentStatus,
    });
  }, [listFrom, listTo, listPageSize, listSortOrder, listPageToken, listPaymentStatus]);

  /**
   * `input` decide se já vale reclamar do que foi digitado: sem nada
   * digitado, a aba não mostra erro. As transações a liquidar não têm
   * código nenhum — a consulta vale para a loja inteira —, então ali o
   * resultado é sempre conferido (`alwaysCheck`).
   */
  const RESULTS: Record<
    BuilderTab,
    { result: EndpointResult; input: string; alwaysCheck?: boolean }
  > = {
    product: { result: productResult, input: productId },
    order: { result: orderResult, input: orderIds },
    transaction: { result: transactionResult, input: transactionOrderId },
    statementList: { result: statementListResult, input: "", alwaysCheck: true },
    statement: { result: statementResult, input: statementId },
    unsettled: { result: unsettledResult, input: "", alwaysCheck: true },
  };
  const { result, input, alwaysCheck } = RESULTS[tab];
  const typed = alwaysCheck === true || input.trim() !== "";
  const fullUrl = result.ok ? `${TIKTOK_API_HOST}${result.path}` : null;

  return (
    <Card title="1. Montar endpoint para assinatura" icon={<Link2 />}>
      <div className="tab-bar mb-3 w-full flex-wrap">
        <button
          type="button"
          onClick={() => setTab("product")}
          className={`tab-btn flex-1 justify-center whitespace-nowrap ${tab === "product" ? "tab-active" : ""}`}
        >
          <Tag className="mr-1.5 h-3.5 w-3.5" />
          Anúncio
        </button>
        <button
          type="button"
          onClick={() => setTab("order")}
          className={`tab-btn flex-1 justify-center whitespace-nowrap ${tab === "order" ? "tab-active" : ""}`}
        >
          <Package className="mr-1.5 h-3.5 w-3.5" />
          Pedidos
        </button>
        <button
          type="button"
          onClick={() => setTab("transaction")}
          className={`tab-btn flex-1 justify-center whitespace-nowrap ${tab === "transaction" ? "tab-active" : ""}`}
        >
          <Receipt className="mr-1.5 h-3.5 w-3.5" />
          Transações
        </button>
        <button
          type="button"
          onClick={() => setTab("statementList")}
          className={`tab-btn flex-1 justify-center whitespace-nowrap ${tab === "statementList" ? "tab-active" : ""}`}
        >
          <Banknote className="mr-1.5 h-3.5 w-3.5" />
          Repasses
        </button>
        <button
          type="button"
          onClick={() => setTab("statement")}
          className={`tab-btn flex-1 justify-center whitespace-nowrap ${tab === "statement" ? "tab-active" : ""}`}
        >
          <Landmark className="mr-1.5 h-3.5 w-3.5" />
          Extrato
        </button>
        <button
          type="button"
          onClick={() => setTab("unsettled")}
          className={`tab-btn flex-1 justify-center whitespace-nowrap ${tab === "unsettled" ? "tab-active" : ""}`}
        >
          <Hourglass className="mr-1.5 h-3.5 w-3.5" />
          A liquidar
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

      {tab === "statementList" && (
        <>
          <p className="text-xs t-3">
            Lista os repasses da loja por período — <strong className="t-1">sem precisar de
            código</strong>. É por aqui que se começa: o resultado traz o{" "}
            <code>statement_id</code> de cada repasse, que é o que a aba{" "}
            <strong className="t-1">Extrato</strong> pede.
          </p>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="list-from" className="mb-1 block text-xs font-bold t-3">
                Gerados a partir de
              </label>
              <input
                id="list-from"
                type="date"
                value={listFrom}
                onChange={(e) => setListFrom(e.target.value)}
                className="inp font-mono"
              />
            </div>
            <div>
              <label htmlFor="list-to" className="mb-1 block text-xs font-bold t-3">
                Gerados até
              </label>
              <input
                id="list-to"
                type="date"
                value={listTo}
                onChange={(e) => setListTo(e.target.value)}
                className="inp font-mono"
              />
            </div>
          </div>

          <p className="mt-1 text-[11px] t-4">
            As datas filtram <code>statement_time</code> (quando o repasse foi gerado) e valem pelo
            horário local. O dia escolhido em <strong className="t-3">Gerados até</strong> entra
            inteiro. Esta API só devolve dados a partir de 01/07/2023.
          </p>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="list-status" className="mb-1 block text-xs font-bold t-3">
                payment_status
              </label>
              <select
                id="list-status"
                value={listPaymentStatus}
                onChange={(e) => setListPaymentStatus(e.target.value as PaymentStatus)}
                className="inp font-mono"
              >
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === "" ? "(todos)" : status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="list-page-size" className="mb-1 block text-xs font-bold t-3">
                page_size
              </label>
              <input
                id="list-page-size"
                value={listPageSize}
                onChange={(e) => setListPageSize(e.target.value)}
                inputMode="numeric"
                min={MIN_STATEMENT_LIST_PAGE_SIZE}
                max={MAX_STATEMENT_LIST_PAGE_SIZE}
                className="inp font-mono"
              />
            </div>
            <div>
              <label htmlFor="list-sort-order" className="mb-1 block text-xs font-bold t-3">
                sort_order
              </label>
              <select
                id="list-sort-order"
                value={listSortOrder}
                onChange={(e) => setListSortOrder(e.target.value as StatementSortOrder)}
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
              value={listPageToken}
              onChange={(e) => setListPageToken(e.target.value)}
              spellCheck={false}
              rows={2}
              aria-label="page_token dos repasses"
              placeholder="cole aqui o next_page_token devolvido na página anterior"
              className="inp mt-1 font-mono leading-relaxed"
            />
          </details>

          <p className="mt-2 text-[11px] t-3">
            <code>sort_field={STATEMENT_LIST_SORT_FIELD}</code> é obrigatório e entra sozinho —
            repare que é diferente do das outras consultas de finanças, porque aqui cada linha é um
            repasse, não um pedido. Exige o escopo <code>seller.finance.info</code>.
          </p>
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
          <p className="mt-1 text-[11px] t-4">
            O código identifica <strong className="t-3">um</strong> repasse, e a paginação acima é
            das <strong className="t-3">transações dentro dele</strong> — um repasse pode ter
            milhares de pedidos, e por isso o <code>page_size</code> e a ordenação convivem com o
            ID. Não sabe o código? A aba <strong className="t-3">Repasses</strong> lista os
            repasses por período e devolve o ID de cada um.
          </p>
        </>
      )}

      {tab === "unsettled" && (
        <>
          <p className="text-xs t-3">
            Esta consulta não tem código: ela devolve tudo que ainda está pendente de liquidação na
            loja. Os filtros abaixo recortam por <code>order_create_time</code> e já vão na query,
            porque são assinados junto.
          </p>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="unsettled-from" className="mb-1 block text-xs font-bold t-3">
                Criados a partir de
              </label>
              <input
                id="unsettled-from"
                type="date"
                value={unsettledFrom}
                onChange={(e) => setUnsettledFrom(e.target.value)}
                className="inp font-mono"
              />
            </div>
            <div>
              <label htmlFor="unsettled-to" className="mb-1 block text-xs font-bold t-3">
                Criados até
              </label>
              <input
                id="unsettled-to"
                type="date"
                value={unsettledTo}
                onChange={(e) => setUnsettledTo(e.target.value)}
                className="inp font-mono"
              />
            </div>
          </div>

          <p className="mt-1 text-[11px] t-4">
            As duas datas são opcionais e valem pelo horário local. O dia escolhido em{" "}
            <strong className="t-3">Criados até</strong> entra inteiro: a API recebe{" "}
            <code>search_time_lt</code> (estritamente menor), então a aplicação envia a meia-noite
            do dia seguinte. Deixando um dos campos vazio, a própria API completa — sem o fim, vale
            até agora; sem o início, vale desde {UNSETTLED_DEFAULT_SEARCH_START}.
          </p>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="unsettled-page-size" className="mb-1 block text-xs font-bold t-3">
                page_size
              </label>
              <input
                id="unsettled-page-size"
                value={unsettledPageSize}
                onChange={(e) => setUnsettledPageSize(e.target.value)}
                inputMode="numeric"
                min={MIN_UNSETTLED_PAGE_SIZE}
                max={MAX_UNSETTLED_PAGE_SIZE}
                className="inp font-mono"
              />
            </div>
            <div>
              <label htmlFor="unsettled-sort-order" className="mb-1 block text-xs font-bold t-3">
                sort_order
              </label>
              <select
                id="unsettled-sort-order"
                value={unsettledSortOrder}
                onChange={(e) => setUnsettledSortOrder(e.target.value as StatementSortOrder)}
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
              value={unsettledPageToken}
              onChange={(e) => setUnsettledPageToken(e.target.value)}
              spellCheck={false}
              rows={2}
              aria-label="page_token das transações a liquidar"
              placeholder="cole aqui o next_page_token devolvido na página anterior"
              className="inp mt-1 font-mono leading-relaxed"
            />
            <p className="mt-1 text-[11px] t-4">
              Repita as MESMAS datas da página anterior: o token foi emitido para aquela janela, e
              mudar o filtro no meio da paginação devolve um recorte incoerente.
            </p>
          </details>

          <p className="mt-2 text-[11px] t-3">
            <code>sort_field={UNSETTLED_SORT_FIELD}</code> é obrigatório e entra sozinho — a
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
        {(tab === "statement" || tab === "unsettled" || tab === "statementList") &&
          " Os parâmetros da query já vão na URL porque são assinados junto com os demais."}
      </p>
    </Card>
  );
}
