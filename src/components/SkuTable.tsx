import { Download, Layers } from "lucide-react";
import type { Sku } from "../types/tiktok";
import { formatPrice } from "../lib/format";
import { downloadCsv, toCsv, toTsv } from "../lib/csv";
import { Card, CopyButton } from "./ui";

const CSV_HEADERS = ["Variação", "seller_sku", "SKU ID", "EAN", "Preço", "Moeda", "Estoque", "Status"];

/** Tabela de variações — a visão mais importante para o de-para com o ERP. */
export function SkuTable({ skus, productId }: { skus: Sku[]; productId?: string }) {
  if (skus.length === 0) {
    return (
      <Card title="Variações" icon={<Layers />}>
        <p className="text-xs t-4">Produto sem variações (skus vazio).</p>
      </Card>
    );
  }

  const rows = skus.map((sku) => {
    const variation = (sku.sales_attributes ?? [])
      .map((a) => a.value_name)
      .filter((v): v is string => v !== undefined && v !== "")
      .join(" / ");
    const stock = (sku.inventory ?? []).reduce((sum, inv) => sum + (inv.quantity ?? 0), 0);
    return {
      id: sku.id,
      variation,
      sellerSku: sku.seller_sku ?? "",
      skuId: sku.id,
      ean: sku.identifier_code?.code ?? "",
      price: sku.price?.sale_price ?? "",
      currency: sku.price?.currency ?? "",
      stock,
      status: sku.status_info?.status ?? "",
    };
  });

  // Linhas cruas (sem "—" nem símbolo de moeda embutido) — pensadas para cair
  // certas em colunas de planilha, tanto ao colar (TSV) quanto ao baixar (CSV).
  const csvRows = rows.map((r) => [
    r.variation,
    r.sellerSku,
    r.skuId,
    r.ean,
    r.price,
    r.currency,
    String(r.stock),
    r.status,
  ]);

  const handleDownload = () => {
    downloadCsv(`variacoes${productId !== undefined ? `-${productId}` : ""}.csv`, toCsv(CSV_HEADERS, csvRows));
  };

  return (
    <Card
      title="Variações"
      icon={<Layers />}
      count={skus.length}
      actions={
        <div className="flex items-center gap-2">
          <CopyButton text={toTsv(CSV_HEADERS, csvRows)} label="Copiar tabela" />
          <button type="button" onClick={handleDownload} className="chip">
            <Download className="h-3 w-3" />
            Baixar CSV
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="tbl text-xs">
          <thead>
            <tr>
              <th>Variação</th>
              <th>seller_sku</th>
              <th>SKU ID</th>
              <th>EAN</th>
              <th className="text-right">Preço</th>
              <th className="text-right">Estoque</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="t-1">{r.variation !== "" ? r.variation : "—"}</td>
                <td className="select-all font-mono t-1">
                  {r.sellerSku !== "" ? r.sellerSku : <span className="font-sans text-red-600">vazio!</span>}
                </td>
                <td className="select-all font-mono t-3">{r.skuId}</td>
                <td className="select-all font-mono t-3">{r.ean !== "" ? r.ean : "—"}</td>
                <td className="text-right t-1">{formatPrice(r.price, r.currency)}</td>
                <td className="text-right">
                  <span className={`badge ${r.stock === 0 ? "pink" : "green"}`}>{r.stock}</span>
                </td>
                <td className="t-3">{r.status !== "" ? r.status : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
