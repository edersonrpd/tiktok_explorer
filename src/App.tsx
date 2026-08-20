import { useCallback, useEffect, useMemo, useState } from "react";
import { Music2, Search } from "lucide-react";
import { fetchResource, type FetchFailure } from "./lib/api";
import { runDiagnostics } from "./lib/diagnostics";
import { detectResourceKind, type ResourceKind } from "./lib/endpoint";
import { parseQueryParams, signatureAgeSeconds, type NormalizedUrl } from "./lib/signedUrl";
import type { Order, OrderListData, Product, TikTokApiResponse } from "./types/tiktok";
import { EndpointBuilder } from "./components/EndpointBuilder";
import { QueryForm } from "./components/QueryForm";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { ProductHeader } from "./components/ProductHeader";
import { Gallery } from "./components/Gallery";
import { SkuTable } from "./components/SkuTable";
import { DescriptionCard } from "./components/DescriptionCard";
import { AttributesCard, PackageCard } from "./components/AttributesCard";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { OrderView } from "./components/OrderView";
import { RawJson } from "./components/RawJson";
import { HistoryList } from "./components/HistoryList";
import { Card } from "./components/ui";
import { JsonDrawer } from "./components/JsonDrawer";
import { Toast } from "./components/Toast";

const TOKEN_STORAGE_KEY = "tiktok-product-viewer.access-token";
const HISTORY_LIMIT = 10;

/** Resultado já discriminado pelo tipo de recurso consultado. */
export type LoadedResource =
  | { kind: "product"; product: Product }
  | { kind: "order"; orders: Order[]; requestedIds: string[] }
  | { kind: "other" };

export interface HistoryEntry {
  key: string;
  label: string;
  subtitle: string;
  time: Date;
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
  | { kind: "success"; response: TikTokApiResponse<unknown>; resource: LoadedResource; historyKey: string };

/** Lê os `ids` pedidos na query — só para conferir o que voltou, nunca para alterar a URL. */
function requestedOrderIds(normalized: NormalizedUrl): string[] {
  const param = parseQueryParams(normalized.rawQuery).find((p) => p.name === "ids");
  if (param === undefined) return [];
  return param.value.split(",").map((id) => id.trim()).filter((id) => id !== "");
}

export default function App() {
  // O token persiste em localStorage; a URL assinada NÃO (expira em minutos).
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? "");
  useEffect(() => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }, [token]);

  const [view, setView] = useState<ViewState>({ kind: "idle" });
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
        response: result.response,
        resource,
      };
      setHistory((prev) => [entry, ...prev].slice(0, HISTORY_LIMIT));
      setView({ kind: "success", response: result.response, resource, historyKey: entry.key });
    },
    [token],
  );

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    // Recarrega da memória, sem nova chamada à API.
    setView({
      kind: "success",
      response: entry.response,
      resource: entry.resource,
      historyKey: entry.key,
    });
  }, []);

  const diagnostics = useMemo(
    () =>
      view.kind === "success" && view.resource.kind === "product"
        ? runDiagnostics(view.resource.product)
        : [],
    [view],
  );

  return (
    <div className="min-h-screen">
      <header className="app-header px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="hdr-mark">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-none tracking-tight hdr-title">
                TikTok Shop
              </h1>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-widest hdr-sub">
                Viewer de Anúncios &amp; Pedidos
              </p>
            </div>
          </div>
          <div className="hdr-chip hidden sm:inline-flex">open-api.tiktokglobalshop.com</div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <EndpointBuilder />
          <Card title="2. Consultar" icon={<Search />}>
            <QueryForm
              token={token}
              onTokenChange={setToken}
              onSubmit={(n) => void handleSubmit(n)}
              loading={view.kind === "loading"}
            />
          </Card>
        </div>

        <HistoryList
          entries={history}
          onSelect={handleHistorySelect}
          activeId={view.kind === "success" ? view.historyKey : null}
        />

        <div className="space-y-4">
          {view.kind === "idle" && (
            <div className="loading-card px-6 py-16 text-center text-sm t-4">
              Cole a URL assinada e o access token acima e clique em <strong>Consultar</strong>.
            </div>
          )}

          {view.kind === "loading" && (
            <div className="loading-card px-6 py-16 text-center text-sm t-3">
              <span className="inline-block animate-pulse">Consultando a API do TikTok Shop…</span>
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

          {view.kind === "success" && (
            <>
              {view.resource.kind === "product" && (
                <>
                  <ProductHeader product={view.resource.product} onToast={displayToast} />
                  <DiagnosticsPanel alerts={diagnostics} />
                  <SkuTable skus={view.resource.product.skus ?? []} />
                  <Gallery
                    images={view.resource.product.main_images ?? []}
                    video={view.resource.product.video}
                  />
                  <AttributesCard attributes={view.resource.product.product_attributes ?? []} />
                  <PackageCard
                    dimensions={view.resource.product.package_dimensions}
                    weight={view.resource.product.package_weight}
                  />
                  <DescriptionCard html={view.resource.product.description} />
                </>
              )}

              {view.resource.kind === "order" && (
                <OrderView
                  orders={view.resource.orders}
                  requestedIds={view.resource.requestedIds}
                />
              )}

              {view.resource.kind === "other" && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900">
                  Endpoint sem exibição dedicada nesta aplicação — a resposta completa está no JSON
                  bruto abaixo.
                </div>
              )}

              <RawJson response={view.response} onView={() => setJsonDrawerOpen(true)} />
            </>
          )}
        </div>
      </main>

      {view.kind === "success" && (
        <JsonDrawer
          isOpen={jsonDrawerOpen}
          onClose={() => setJsonDrawerOpen(false)}
          data={view.response}
          title="Resposta da API"
          subtitle={view.response.code === 0 ? "OK" : `code ${view.response.code}`}
          onToast={displayToast}
        />
      )}

      <Toast message={toastMsg} show={showToast} />
    </div>
  );
}
