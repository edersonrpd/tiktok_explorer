import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProduct, type FetchResult } from "./lib/api";
import { runDiagnostics } from "./lib/diagnostics";
import type { NormalizedUrl } from "./lib/signedUrl";
import type { Product, ProductResponse } from "./types/tiktok";
import { QueryForm } from "./components/QueryForm";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { ProductHeader } from "./components/ProductHeader";
import { Gallery } from "./components/Gallery";
import { SkuTable } from "./components/SkuTable";
import { DescriptionCard } from "./components/DescriptionCard";
import { AttributesCard, PackageCard } from "./components/AttributesCard";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { RawJson } from "./components/RawJson";
import { HistoryList } from "./components/HistoryList";

const TOKEN_STORAGE_KEY = "tiktok-product-viewer.access-token";
const HISTORY_LIMIT = 10;

export interface HistoryEntry {
  key: string;
  productId: string;
  title: string;
  time: Date;
  response: ProductResponse;
  product: Product;
}

type ViewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; result: Exclude<FetchResult, { kind: "ok" }> }
  | { kind: "success"; response: ProductResponse; product: Product; historyKey: string };

export default function App() {
  // O token persiste em localStorage; a URL assinada NÃO (expira em minutos).
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? "");
  useEffect(() => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }, [token]);

  const [view, setView] = useState<ViewState>({ kind: "idle" });
  // Histórico só em memória — some ao recarregar a página, de propósito.
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const handleSubmit = useCallback(
    async (normalized: NormalizedUrl) => {
      setView({ kind: "loading" });
      const result = await fetchProduct(normalized, token);

      if (result.kind !== "ok") {
        setView({ kind: "error", result });
        return;
      }

      const entry: HistoryEntry = {
        key: `${result.product.id}-${Date.now()}`,
        productId: result.product.id,
        title: result.product.title ?? "(sem título)",
        time: new Date(),
        response: result.response,
        product: result.product,
      };
      setHistory((prev) => [entry, ...prev].slice(0, HISTORY_LIMIT));
      setView({
        kind: "success",
        response: result.response,
        product: result.product,
        historyKey: entry.key,
      });
    },
    [token],
  );

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    // Recarrega da memória, sem nova chamada à API.
    setView({
      kind: "success",
      response: entry.response,
      product: entry.product,
      historyKey: entry.key,
    });
  }, []);

  const diagnostics = useMemo(
    () => (view.kind === "success" ? runDiagnostics(view.product) : []),
    [view],
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-base font-bold">TikTok Product Viewer</h1>
        <p className="text-xs text-slate-500">
          Consulta de anúncios via URL pré-assinada — a query string nunca é modificada.
        </p>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <QueryForm
              token={token}
              onTokenChange={setToken}
              onSubmit={(n) => void handleSubmit(n)}
              loading={view.kind === "loading"}
            />
          </section>
          <HistoryList
            entries={history}
            onSelect={handleHistorySelect}
            activeId={view.kind === "success" ? view.historyKey : null}
          />
        </div>

        <div className="space-y-4">
          {view.kind === "idle" && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm text-slate-400">
              Cole a URL assinada e o access token à esquerda e clique em <strong>Consultar</strong>.
            </div>
          )}

          {view.kind === "loading" && (
            <div className="rounded-lg border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
              <span className="inline-block animate-pulse">Consultando a API do TikTok Shop…</span>
            </div>
          )}

          {view.kind === "error" && <ErrorDisplay result={view.result} />}

          {view.kind === "success" && (
            <>
              <ProductHeader product={view.product} />
              <DiagnosticsPanel alerts={diagnostics} />
              <SkuTable skus={view.product.skus ?? []} />
              <Gallery images={view.product.main_images ?? []} video={view.product.video} />
              <DescriptionCard html={view.product.description} />
              <AttributesCard attributes={view.product.product_attributes ?? []} />
              <PackageCard
                dimensions={view.product.package_dimensions}
                weight={view.product.package_weight}
              />
              <RawJson response={view.response} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
