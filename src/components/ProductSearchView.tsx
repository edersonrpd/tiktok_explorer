import { useMemo, useRef, useState } from "react";
import { Boxes, Layers, ListChecks, Play, Square, Trash2 } from "lucide-react";
import type { Product, ProductSearchData, ProductSummary } from "../types/tiktok";
import {
  buildProductEndpoint,
  buildProductSearchEndpoint,
  type ProductStatus,
} from "../lib/endpoint";
import { fetchProduct } from "../lib/api";
import {
  DEFAULT_BATCH_CONCURRENCY,
  describeFailure,
  parseBatchInput,
  runBatch,
  type BatchOutcome,
} from "../lib/productBatch";
import {
  productsCsv,
  productsFileName,
  productsTsv,
  productsXlsx,
  productRows,
} from "../lib/productExport";
import { TIKTOK_API_HOST } from "../lib/signedUrl";
import { formatEpochDateBR } from "../lib/format";
import { Card, CopyButton, DownloadButton } from "./ui";
import { Field, Highlight } from "./breakdown";

/** Parâmetros da consulta que gerou esta página, para montar a próxima. */
export interface ProductSearchPageQuery {
  pageSize: number | undefined;
  status: ProductStatus | undefined;
  /** Corpo exatamente como foi enviado (e assinado). */
  body: string;
}

/** O que a sessão acumulou entre páginas — vive no App, não nesta tela. */
export interface ProductCollection {
  /** Anúncios vistos nas páginas já consultadas, sem repetidos. */
  collected: ProductSummary[];
  /** Cadastros completos já extraídos, sem repetidos. */
  extracted: Product[];
}

function statusTone(status: string | undefined): string {
  switch (status) {
    case "ACTIVATE":
      return "green";
    case "DRAFT":
    case "PENDING":
      return "blue";
    case "FAILED":
    case "PLATFORM_DEACTIVATED":
    case "FREEZE":
      return "red";
    case "SELLER_DEACTIVATED":
    case "DELETED":
      return "gray";
    default:
      return "gray";
  }
}

function skuStock(product: ProductSummary): number {
  return (product.skus ?? []).reduce(
    (sum, sku) => sum + (sku.inventory ?? []).reduce((s, inv) => s + (inv.quantity ?? 0), 0),
    0,
  );
}

/**
 * Exibição de POST /product/202502/products/search.
 *
 * A busca só devolve as propriedades-chave de cada anúncio; o cadastro
 * completo exige uma chamada de detalhe por anúncio. Por isso a tela tem
 * três partes: o que veio nesta página, a paginação (cada página é uma
 * nova assinatura) e a extração em lote, que junta os anúncios de todas
 * as páginas já consultadas.
 */
export function ProductSearchView({
  data,
  query,
  token,
  collection,
  onExtracted,
  onReset,
}: {
  data: ProductSearchData;
  query: ProductSearchPageQuery;
  token: string;
  collection: ProductCollection;
  onExtracted: (products: Product[]) => void;
  onReset: () => void;
}) {
  const products = data.products ?? [];

  return (
    <>
      <SummaryCard data={data} collection={collection} />
      <NextPageCard data={data} query={query} />
      <ProductsCard products={products} />
      <BatchCard
        token={token}
        collection={collection}
        total={data.total_count}
        hasMore={(data.next_page_token ?? "") !== ""}
        onExtracted={onExtracted}
        onReset={onReset}
      />
    </>
  );
}

function SummaryCard({
  data,
  collection,
}: {
  data: ProductSearchData;
  collection: ProductCollection;
}) {
  const products = data.products ?? [];
  const byStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      const key = product.status ?? "—";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [products]);

  return (
    <Card title="Anúncios da loja" icon={<Boxes />} count={products.length}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Highlight
          label="Total que atende ao filtro"
          value={data.total_count === undefined ? "—" : String(data.total_count)}
          strong
        />
        <Highlight label="Nesta página" value={String(products.length)} />
        <Highlight label="Coletados na sessão" value={String(collection.collected.length)} />
      </div>

      {byStatus.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs t-3">
          Nesta página:
          {byStatus.map(([status, count]) => (
            <span key={status} className={`badge ${statusTone(status)}`}>
              {status} · {count}
            </span>
          ))}
        </p>
      )}
    </Card>
  );
}

function NextPageCard({
  data,
  query,
}: {
  data: ProductSearchData;
  query: ProductSearchPageQuery;
}) {
  const token = data.next_page_token;

  const next = useMemo(() => {
    if (token === undefined || token === "") return null;
    const result = buildProductSearchEndpoint({ pageSize: query.pageSize, pageToken: token });
    return result.ok ? `${TIKTOK_API_HOST}${result.path}` : null;
  }, [token, query.pageSize]);

  if (token === undefined || token === "") {
    return (
      <Card title="Paginação" icon={<Layers />}>
        <p className="text-xs t-3">
          A resposta não trouxe <code>next_page_token</code> — esta é a última página.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Próxima página" icon={<Layers />}>
      <p className="text-xs t-3">
        Ainda há anúncios. O <code>page_token</code> faz parte da query e é assinado junto, então
        cada página exige uma <strong className="t-1">nova assinatura</strong> — do caminho e do
        mesmo corpo desta consulta.
      </p>
      {next !== null && (
        <>
          <div className="panel-success mt-2 flex items-center gap-2 px-3 py-2">
            <code className="flex-1 select-all break-all font-mono text-[11px] t-1">{next}</code>
            <CopyButton text={next} label="Copiar" />
          </div>
          <div className="panel-success mt-2 flex items-center gap-2 px-3 py-2">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide t-3">
              Corpo
            </span>
            <code className="flex-1 select-all break-all font-mono text-[11px] t-1">
              {query.body}
            </code>
            <CopyButton text={query.body} label="Copiar corpo" />
          </div>
        </>
      )}
    </Card>
  );
}

function ProductsCard({ products }: { products: ProductSummary[] }) {
  if (products.length === 0) {
    return (
      <Card title="Anúncios desta página" icon={<ListChecks />}>
        <p className="text-xs t-4">Nenhum anúncio retornado para este filtro.</p>
      </Card>
    );
  }

  return (
    <Card
      title="Anúncios desta página"
      icon={<ListChecks />}
      count={products.length}
      actions={<CopyButton text={products.map((p) => p.id).join("\n")} label="Copiar IDs" />}
    >
      <div className="overflow-x-auto">
        <table className="tbl text-xs">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Status</th>
              <th className="text-right">SKUs</th>
              <th className="text-right">Estoque</th>
              <th>Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td className="select-all font-mono t-3">{product.id}</td>
                <td className="t-1">{product.title ?? "—"}</td>
                <td>
                  <span className={`badge ${statusTone(product.status)}`}>
                    {product.status ?? "—"}
                  </span>
                </td>
                <td className="text-right t-1">{product.skus?.length ?? 0}</td>
                <td className="text-right t-1">{skuStock(product)}</td>
                <td className="t-3">{formatEpochDateBR(product.update_time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Extração em lote                                                    */
/* ------------------------------------------------------------------ */

type RunState =
  | { kind: "idle" }
  | { kind: "running"; done: number; total: number }
  | { kind: "finished"; failed: BatchOutcome[]; stopped: boolean; total: number };

function BatchCard({
  token,
  collection,
  total,
  hasMore,
  onExtracted,
  onReset,
}: {
  token: string;
  collection: ProductCollection;
  total: number | undefined;
  hasMore: boolean;
  onExtracted: (products: Product[]) => void;
  onReset: () => void;
}) {
  const [input, setInput] = useState("");
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const controller = useRef<AbortController | null>(null);

  const { collected, extracted } = collection;
  const extractedIds = useMemo(() => new Set(extracted.map((p) => p.id)), [extracted]);

  // Os caminhos a assinar são os anúncios coletados que ainda não foram extraídos.
  const pendingPaths = useMemo(
    () =>
      collected
        .filter((p) => !extractedIds.has(p.id))
        .map((p) => buildProductEndpoint(p.id))
        .flatMap((r) => (r.ok ? [`${TIKTOK_API_HOST}${r.path}`] : [])),
    [collected, extractedIds],
  );

  const parsed = useMemo(() => parseBatchInput(input), [input]);
  const expired = parsed.items.filter((i) => i.expired).length;
  const running = run.kind === "running";
  const canRun = parsed.items.length > 0 && token.trim() !== "" && !running;

  const start = async () => {
    const abort = new AbortController();
    controller.current = abort;
    setRun({ kind: "running", done: 0, total: parsed.items.length });

    const outcomes = await runBatch(
      parsed.items,
      (item) => fetchProduct(item.normalized, token),
      {
        concurrency: DEFAULT_BATCH_CONCURRENCY,
        signal: abort.signal,
        onProgress: (done, count) => setRun({ kind: "running", done, total: count }),
      },
    );

    onExtracted(outcomes.flatMap((o) => (o.ok ? [o.product] : [])));
    setRun({
      kind: "finished",
      failed: outcomes.filter((o) => !o.ok),
      stopped: abort.signal.aborted,
      total: parsed.items.length,
    });
    controller.current = null;
  };

  return (
    <Card
      title="Extrair o cadastro completo"
      icon={<Boxes />}
      count={extracted.length}
      actions={
        collected.length > 0 || extracted.length > 0 ? (
          <button type="button" onClick={onReset} className="chip" disabled={running}>
            <Trash2 className="h-3 w-3" />
            Zerar coleta
          </button>
        ) : undefined
      }
    >
      <p className="text-xs t-3">
        A busca devolve só o resumo de cada anúncio. O cadastro completo (SKUs, EAN, categoria,
        atributos, imagens, dimensões) vem do detalhe de <strong className="t-1">cada anúncio</strong>
        , e cada chamada precisa da própria assinatura. Assine o lote abaixo no sistema interno e
        cole as URLs assinadas, uma por linha.
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
        <Field label="Coletados (todas as páginas)" value={String(collected.length)} />
        <Field label="Total da loja" value={total === undefined ? "—" : String(total)} />
        <Field label="Já extraídos" value={String(extracted.length)} />
        <Field label="Falta extrair" value={String(pendingPaths.length)} />
      </dl>

      {hasMore && (
        <p className="alert alert-warning mt-2 px-3 py-2 text-xs t-2">
          Ainda há páginas na busca. A lista abaixo só inclui os anúncios já coletados — consulte as
          páginas restantes para juntá-los antes de assinar, ou extraia por partes.
        </p>
      )}

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="batch-paths" className="text-xs font-bold t-3">
            1. Caminhos para assinar ({pendingPaths.length})
          </label>
          <CopyButton text={pendingPaths.join("\n")} label="Copiar todos" />
        </div>
        <textarea
          id="batch-paths"
          readOnly
          value={pendingPaths.join("\n")}
          rows={4}
          spellCheck={false}
          placeholder="Nenhum anúncio pendente — consulte a busca para coletar os IDs."
          className="inp font-mono text-[11px] leading-relaxed"
        />
      </div>

      <div className="mt-3">
        <label htmlFor="batch-signed" className="mb-1 block text-xs font-bold t-3">
          2. URLs assinadas — uma por linha
        </label>
        <textarea
          id="batch-signed"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          spellCheck={false}
          disabled={running}
          placeholder={`${TIKTOK_API_HOST}/product/202309/products/1736320032383141477?shop_cipher=...&app_key=...&timestamp=...&sign=...`}
          className="inp font-mono text-[11px] leading-relaxed"
        />
        {input.trim() !== "" && (
          <p className="mt-1 text-[11px] t-3">
            {parsed.items.length} URL(s) válida(s)
            {parsed.duplicates > 0 && ` · ${parsed.duplicates} repetida(s) ignorada(s)`}
            {parsed.problems.length > 0 && ` · ${parsed.problems.length} com problema`}.
          </p>
        )}
        {expired > 0 && (
          <p className="alert alert-warning mt-1 px-3 py-2 text-xs t-2">
            {expired} URL(s) com assinatura de mais de ~4 minutos — essas devem voltar com erro
            106001. O lote roda em poucos segundos, então assine e cole logo em seguida.
          </p>
        )}
        {parsed.problems.length > 0 && (
          <ul className="alert alert-error mt-1 list-disc px-6 py-2 text-xs t-2">
            {parsed.problems.slice(0, 5).map((problem) => (
              <li key={problem.line}>
                Linha {problem.line}: {problem.reason}
              </li>
            ))}
            {parsed.problems.length > 5 && <li>… e mais {parsed.problems.length - 5}.</li>}
          </ul>
        )}
      </div>

      {token.trim() === "" && (
        <p className="mt-2 text-xs t-3">Informe o access token no painel lateral para extrair.</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button type="button" disabled={!canRun} onClick={() => void start()} className="btn-primary">
          <Play className="h-4 w-4" />
          {running
            ? "Extraindo..."
            : parsed.items.length > 0
              ? `Extrair ${parsed.items.length} anúncio(s)`
              : "Extrair"}
        </button>
        {running && (
          <button
            type="button"
            onClick={() => controller.current?.abort()}
            className="btn-secondary"
          >
            <Square className="h-3.5 w-3.5" />
            Parar
          </button>
        )}
        {run.kind === "running" && (
          <span className="text-xs t-3">
            {run.done} de {run.total} · {DEFAULT_BATCH_CONCURRENCY} por vez
          </span>
        )}
      </div>

      {run.kind === "finished" && <RunSummary run={run} />}

      {extracted.length > 0 && <ExportBar extracted={extracted} />}
    </Card>
  );
}

function RunSummary({ run }: { run: Extract<RunState, { kind: "finished" }> }) {
  const failed = run.failed.length;
  const done = run.total - failed;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs t-2">
        {run.stopped ? "Interrompido. " : ""}
        <strong className="t-1">{done}</strong> extraído(s)
        {failed > 0 && (
          <>
            , <strong className="text-red-700">{failed}</strong> com erro
          </>
        )}
        .
      </p>
      {failed > 0 && (
        <div className="alert alert-error px-3 py-2 text-xs t-2">
          <p className="font-bold text-red-700">
            Falharam — assine de novo só estes e cole no passo 2:
          </p>
          <ul className="mt-1 list-disc pl-4">
            {run.failed.slice(0, 10).map((outcome) => (
              <li key={outcome.item.productId}>
                <span className="font-mono">{outcome.item.productId}</span> —{" "}
                {outcome.ok ? "" : describeFailure(outcome.failure)}
              </li>
            ))}
            {failed > 10 && <li>… e mais {failed - 10}.</li>}
          </ul>
          <div className="mt-2">
            <CopyButton
              text={run.failed
                .flatMap((o) => {
                  const r = buildProductEndpoint(o.item.productId);
                  return r.ok ? [`${TIKTOK_API_HOST}${r.path}`] : [];
                })
                .join("\n")}
              label="Copiar caminhos das falhas"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ExportBar({ extracted }: { extracted: Product[] }) {
  const rowCount = useMemo(() => productRows(extracted).length, [extracted]);

  return (
    <div className="panel-success mt-3 flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="text-xs t-1">
        <strong>{extracted.length}</strong> anúncio(s) · <strong>{rowCount}</strong> linha(s), uma
        por SKU
      </span>
      <span className="ml-auto flex items-center gap-2">
        <DownloadButton
          build={() => productsXlsx(extracted)}
          filename={productsFileName("xlsx")}
          mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          label="Excel"
        />
        <DownloadButton
          build={() => productsCsv(extracted)}
          filename={productsFileName("csv")}
          label="CSV"
        />
        <CopyButton text={productsTsv(extracted)} label="Copiar" />
      </span>
    </div>
  );
}
