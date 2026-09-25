import { useCallback, useEffect, useMemo, useState } from "react";
import { Braces, ChevronDown, ChevronRight, PencilLine, Search } from "lucide-react";
import { fetchResource, type FetchFailure } from "./lib/api";
import { runDiagnostics } from "./lib/diagnostics";
import {
  cleanStatementId,
  detectResourceKind,
  PAYMENT_STATUSES,
  STATEMENT_SORT_ORDERS,
  type PaymentStatus,
  type ResourceKind,
  type StatementSortOrder,
} from "./lib/endpoint";
import { parseQueryParams, signatureAgeSeconds, type NormalizedUrl } from "./lib/signedUrl";
import { formatEpochDateBR } from "./lib/format";
import type {
  Order,
  OrderListData,
  Product,
  StatementListData,
  StatementTransactionsData,
  TikTokApiResponse,
  TransactionsByOrderData,
  UnsettledTransactionsData,
} from "./types/tiktok";
import { builderTabInfo, EndpointBuilder, type BuilderTab } from "./components/EndpointBuilder";
import { QueryForm } from "./components/QueryForm";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { ProductHeader } from "./components/ProductHeader";
import { Gallery } from "./components/Gallery";
import { SkuTable } from "./components/SkuTable";
import { DescriptionCard } from "./components/DescriptionCard";
import { AttributesCard, PackageCard } from "./components/AttributesCard";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { OrderView } from "./components/OrderView";
import { TransactionView } from "./components/TransactionView";
import { StatementView, type StatementPageQuery } from "./components/StatementView";
import { UnsettledView, type UnsettledPageQuery } from "./components/UnsettledView";
import {
  StatementListView,
  type StatementListPageQuery,
} from "./components/StatementListView";
import { Sidebar } from "./components/Sidebar";
import { Card } from "./components/ui";
import { JsonDrawer } from "./components/JsonDrawer";
import { Toast } from "./components/Toast";

const TOKEN_STORAGE_KEY = "tiktok-product-viewer.access-token";
const HISTORY_LIMIT = 10;

/** Resultado já discriminado pelo tipo de recurso consultado. */
export type LoadedResource =
  | { kind: "product"; product: Product }
  | { kind: "order"; orders: Order[]; requestedIds: string[] }
  | { kind: "transaction"; data: TransactionsByOrderData }
  | { kind: "statement"; statement: StatementTransactionsData; query: StatementPageQuery }
  | { kind: "unsettled"; unsettled: UnsettledTransactionsData; query: UnsettledPageQuery }
  | { kind: "statementList"; list: StatementListData; query: StatementListPageQuery }
  | { kind: "other" };

export interface HistoryEntry {
  key: string;
  label: string;
  subtitle: string;
  time: Date;
  /** Path + query enviados — mostrados na barra do resultado. */
  sentTarget: string;
  response: TikTokApiResponse<unknown>;
  resource: LoadedResource;
}

type ViewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "error";
      result: FetchFailure;
      resourceKind: ResourceKind;
      signatureAge: number | null;
      sentTarget: string;
    }
  | { kind: "success"; entry: HistoryEntry };

/** Lê os `ids` pedidos na query — só para conferir o que voltou, nunca para alterar a URL. */
function requestedOrderIds(normalized: NormalizedUrl): string[] {
  const param = parseQueryParams(normalized.rawQuery).find((p) => p.name === "ids");
  if (param === undefined) return [];
  return param.value.split(",").map((id) => id.trim()).filter((id) => id !== "");
}

/**
 * Lê da URL consultada o que é preciso para montar a PRÓXIMA página do
 * extrato: o ID do extrato (que está no path) e o page_size/sort_order
 * usados aqui, para a página seguinte sair com os mesmos parâmetros.
 * Leitura apenas — a URL enviada continua sendo a original.
 */
function statementPageQuery(normalized: NormalizedUrl): StatementPageQuery {
  const params = parseQueryParams(normalized.rawQuery);
  const pageSize = Number(params.find((p) => p.name === "page_size")?.value);
  const sortOrder = params.find((p) => p.name === "sort_order")?.value;

  return {
    statementId: cleanStatementId(normalized.path),
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : undefined,
    sortOrder: STATEMENT_SORT_ORDERS.includes(sortOrder as StatementSortOrder)
      ? (sortOrder as StatementSortOrder)
      : undefined,
  };
}

/**
 * Lê da URL consultada os filtros e a paginação das transações a
 * liquidar, para a próxima página sair com o MESMO recorte. Aqui não há
 * ID no path — o que identifica a consulta é a janela de datas.
 */
function unsettledPageQuery(normalized: NormalizedUrl): UnsettledPageQuery {
  const params = parseQueryParams(normalized.rawQuery);

  const positiveInt = (name: string): number | undefined => {
    const value = Number(params.find((p) => p.name === name)?.value);
    return Number.isInteger(value) && value > 0 ? value : undefined;
  };

  const sortOrder = params.find((p) => p.name === "sort_order")?.value;

  return {
    pageSize: positiveInt("page_size"),
    sortOrder: STATEMENT_SORT_ORDERS.includes(sortOrder as StatementSortOrder)
      ? (sortOrder as StatementSortOrder)
      : undefined,
    searchTimeGe: positiveInt("search_time_ge"),
    searchTimeLt: positiveInt("search_time_lt"),
  };
}

/**
 * Lê da URL consultada os filtros da lista de repasses, para a próxima
 * página sair com o mesmo recorte. Como nas transações a liquidar, aqui
 * não há ID no path: o que identifica a consulta é a janela de datas.
 */
function statementListPageQuery(normalized: NormalizedUrl): StatementListPageQuery {
  const params = parseQueryParams(normalized.rawQuery);

  const positiveInt = (name: string): number | undefined => {
    const value = Number(params.find((p) => p.name === name)?.value);
    return Number.isInteger(value) && value > 0 ? value : undefined;
  };

  const sortOrder = params.find((p) => p.name === "sort_order")?.value;
  const paymentStatus = params.find((p) => p.name === "payment_status")?.value;

  return {
    pageSize: positiveInt("page_size"),
    sortOrder: STATEMENT_SORT_ORDERS.includes(sortOrder as StatementSortOrder)
      ? (sortOrder as StatementSortOrder)
      : undefined,
    statementTimeGe: positiveInt("statement_time_ge"),
    statementTimeLt: positiveInt("statement_time_lt"),
    paymentStatus: PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus)
      ? (paymentStatus as PaymentStatus)
      : undefined,
  };
}

export default function App() {
  // O token persiste em localStorage; a URL assinada NÃO (expira em minutos).
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? "");
  useEffect(() => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }, [token]);

  const [view, setView] = useState<ViewState>({ kind: "idle" });
  // Aba do passo 1, escolhida no painel lateral. Depois de uma consulta ela
  // acompanha o tipo do resultado, para "Nova consulta" abrir no lugar certo.
  const [builderTab, setBuilderTab] = useState<BuilderTab>("product");
  // Com um resultado na tela, o formulário recolhe para dar espaço a ele —
  // recolhe só visualmente, sem desmontar, para não perder o que foi digitado.
  const [queryOpen, setQueryOpen] = useState(true);
  // Histórico só em memória — some ao recarregar a página, de propósito.
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [jsonDrawerOpen, setJsonDrawerOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  const displayToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
  }, []);

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 2000);
    return () => clearTimeout(timer);
  }, [showToast]);

  const handleSubmit = useCallback(
    async (normalized: NormalizedUrl) => {
      setView({ kind: "loading" });

      // O tipo vem do path da URL assinada, não da aba escolhida no passo 1.
      const kind: ResourceKind = detectResourceKind(normalized.path);
      const age = signatureAgeSeconds(normalized);
      const result = await fetchResource<unknown>(normalized, token);

      if (result.kind !== "ok") {
        // Idade medida no envio: separa "expirou" de "query diferente da assinada".
        setView({
          kind: "error",
          result,
          resourceKind: kind,
          signatureAge: age,
          sentTarget: normalized.pathWithQuery,
        });
        return;
      }

      let resource: LoadedResource;
      let label: string;
      let subtitle: string;

      if (kind === "product") {
        const product = result.data as Product;
        resource = { kind: "product", product };
        label = product.title ?? "(sem título)";
        subtitle = `Anúncio ${product.id}`;
      } else if (kind === "order") {
        const orders = (result.data as OrderListData).orders ?? [];
        resource = { kind: "order", orders, requestedIds: requestedOrderIds(normalized) };
        label = `${orders.length} pedido(s)`;
        subtitle = orders.map((o) => o.id).join(", ") || "nenhum retornado";
      } else if (kind === "transaction") {
        const data = result.data as TransactionsByOrderData;
        resource = { kind: "transaction", data };
        label = `Transações do pedido ${data.order_id}`;
        subtitle = `${data.sku_transactions?.length ?? 0} SKU(s) · settlement ${data.settlement_amount ?? "—"} ${data.currency ?? ""}`.trim();
      } else if (kind === "statement") {
        const statement = result.data as StatementTransactionsData;
        const count = statement.transactions?.length ?? 0;
        resource = { kind: "statement", statement, query: statementPageQuery(normalized) };
        label = `Extrato ${statement.id ?? ""}`.trim();
        subtitle = `${count} transação(ões)${statement.total_count !== undefined ? ` de ${statement.total_count}` : ""}`;
      } else if (kind === "statementList") {
        const list = result.data as StatementListData;
        const count = list.statements?.length ?? 0;
        resource = { kind: "statementList", list, query: statementListPageQuery(normalized) };
        label = `${count} repasse(s)`;
        subtitle =
          count === 0
            ? "nenhum repasse na janela consultada"
            : `de ${formatEpochDateBR(list.statements?.[count - 1]?.statement_time)} a ${formatEpochDateBR(list.statements?.[0]?.statement_time)}`;
      } else if (kind === "unsettled") {
        const unsettled = result.data as UnsettledTransactionsData;
        const count = unsettled.transactions?.length ?? 0;
        resource = { kind: "unsettled", unsettled, query: unsettledPageQuery(normalized) };
        label = "Transações a liquidar";
        subtitle = `${count} transação(ões)${unsettled.total_count !== undefined ? ` de ${unsettled.total_count}` : ""} · repasse estimado ${unsettled.sum_est_settlement_amount ?? "—"}`;
      } else {
        resource = { kind: "other" };
        label = "Resposta bruta";
        subtitle = normalized.path;
      }

      const entry: HistoryEntry = {
        key: `${kind}-${Date.now()}`,
        label,
        subtitle,
        time: new Date(),
        sentTarget: normalized.pathWithQuery,
        response: result.response,
        resource,
      };
      setHistory((prev) => [entry, ...prev].slice(0, HISTORY_LIMIT));
      setView({ kind: "success", entry });
      if (kind !== "other") setBuilderTab(kind);
      setQueryOpen(false);
    },
    [token],
  );

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    // Recarrega da memória, sem nova chamada à API.
    setView({ kind: "success", entry });
    if (entry.resource.kind !== "other") setBuilderTab(entry.resource.kind);
    setQueryOpen(false);
  }, []);

  const handleTabSelect = useCallback((tab: BuilderTab) => {
    setBuilderTab(tab);
    setQueryOpen(true);
  }, []);

  const diagnostics = useMemo(
    () =>
      view.kind === "success" && view.entry.resource.kind === "product"
        ? runDiagnostics(view.entry.resource.product)
        : [],
    [view],
  );

  const activeTab = builderTabInfo(builderTab);
  const success = view.kind === "success" ? view.entry : null;

  return (
    <div className="app-shell">
      <Sidebar
        tab={builderTab}
        onTabSelect={handleTabSelect}
        history={history}
        activeHistoryId={success?.key ?? null}
        onHistorySelect={handleHistorySelect}
        token={token}
        onTokenChange={setToken}
      />

      <div className="app-main">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold t-3">
            <span className="truncate">{activeTab.label}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-bold t-1">
              {success !== null && !queryOpen ? "Resultado" : "Nova consulta"}
            </span>
          </div>
          <div className="hdr-chip">open-api.tiktokglobalshop.com</div>
        </header>

        <main className="content">
          {success !== null && !queryOpen && (
            <div className="query-bar">
              <span className="query-method">GET</span>
              <code className="query-target" title={success.sentTarget}>
                {success.sentTarget}
              </code>
              <button type="button" onClick={() => setQueryOpen(true)} className="btn-primary btn-sm">
                <PencilLine className="h-3.5 w-3.5" />
                Nova consulta
              </button>
            </div>
          )}

          {/* Recolhido com `hidden`, não desmontado: os campos preservam o que foi digitado. */}
          <div className={queryOpen ? "grid gap-4 lg:grid-cols-2 lg:items-start" : "hidden"}>
            <EndpointBuilder tab={builderTab} />
            <Card
              title="2. Colar a URL assinada e consultar"
              icon={<Search />}
              actions={
                success !== null ? (
                  <button type="button" onClick={() => setQueryOpen(false)} className="chip">
                    <ChevronDown className="h-3 w-3" />
                    Voltar ao resultado
                  </button>
                ) : undefined
              }
            >
              <QueryForm
                token={token}
                onSubmit={(n) => void handleSubmit(n)}
                loading={view.kind === "loading"}
              />
            </Card>
          </div>

          {view.kind === "idle" && (
            <div className="empty-state">
              <ol className="empty-steps">
                <li>
                  <span className="step-num">1</span>
                  Escolha o tipo de consulta no painel lateral e monte o endpoint.
                </li>
                <li>
                  <span className="step-num">2</span>
                  Assine o endpoint no sistema interno.
                </li>
                <li>
                  <span className="step-num">3</span>
                  Cole a URL assinada e clique em <strong>Consultar</strong>.
                </li>
              </ol>
            </div>
          )}

          {view.kind === "loading" && (
            <div className="empty-state">
              <span className="inline-block animate-pulse text-sm t-3">
                Consultando a API do TikTok Shop…
              </span>
            </div>
          )}

          {view.kind === "error" && (
            <ErrorDisplay
              result={view.result}
              resourceKind={view.resourceKind}
              signatureAge={view.signatureAge}
              sentTarget={view.sentTarget}
            />
          )}

          {success !== null && (
            <section className="space-y-4" aria-label="Resultado">
              <div className="result-head">
                <div className="min-w-0">
                  <h1 className="result-title">{success.label}</h1>
                  <p className="result-sub">
                    {success.subtitle}
                    <span className="t-4">
                      {" "}
                      · {success.time.toLocaleTimeString("pt-BR")} · request_id{" "}
                      <span className="select-all font-mono">{success.response.request_id}</span>
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setJsonDrawerOpen(true)}
                  className="btn-secondary shrink-0"
                >
                  <Braces className="h-3.5 w-3.5" />
                  JSON bruto
                </button>
              </div>

              {success.resource.kind === "product" && (
                <>
                  <ProductHeader product={success.resource.product} onToast={displayToast} />
                  <DiagnosticsPanel alerts={diagnostics} />
                  <SkuTable
                    skus={success.resource.product.skus ?? []}
                    productId={success.resource.product.id}
                  />
                  <Gallery
                    images={success.resource.product.main_images ?? []}
                    video={success.resource.product.video}
                  />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AttributesCard attributes={success.resource.product.product_attributes ?? []} />
                    <PackageCard
                      dimensions={success.resource.product.package_dimensions}
                      weight={success.resource.product.package_weight}
                    />
                  </div>
                  <DescriptionCard html={success.resource.product.description} />
                </>
              )}

              {success.resource.kind === "order" && (
                <OrderView
                  orders={success.resource.orders}
                  requestedIds={success.resource.requestedIds}
                />
              )}

              {success.resource.kind === "transaction" && (
                <TransactionView data={success.resource.data} />
              )}

              {success.resource.kind === "statement" && (
                <StatementView data={success.resource.statement} query={success.resource.query} />
              )}

              {success.resource.kind === "unsettled" && (
                <UnsettledView data={success.resource.unsettled} query={success.resource.query} />
              )}

              {success.resource.kind === "statementList" && (
                <StatementListView data={success.resource.list} query={success.resource.query} />
              )}

              {success.resource.kind === "other" && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
                  Endpoint sem exibição dedicada nesta aplicação — a resposta completa está no{" "}
                  <strong>JSON bruto</strong>, no botão acima.
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {success !== null && (
        <JsonDrawer
          isOpen={jsonDrawerOpen}
          onClose={() => setJsonDrawerOpen(false)}
          data={success.response}
          title="Resposta da API"
          subtitle={success.response.code === 0 ? "OK" : `code ${success.response.code}`}
          onToast={displayToast}
        />
      )}

      <Toast message={toastMsg} show={showToast} />
    </div>
  );
}
