import type { Sku } from "../types/tiktok";
import { formatPrice } from "../lib/format";
import { Card, CopyButton } from "./ui";

/** Tabela de variações — a visão mais importante para o de-para com o ERP. */
export function SkuTable({ skus }: { skus: Sku[] }) {
  if (skus.length === 0) {
    return (
      <Card title="Variações">
        <p className="text-xs text-slate-400">Produto sem variações (skus vazio).</p>
      </Card>
    );
  }

  const sellerSkuColumn = skus.map((s) => s.seller_sku ?? "").join("\n");

  return (
    <Card
      title={`Variações (${skus.length})`}
      actions={<CopyButton text={sellerSkuColumn} label="Copiar coluna seller_sku" />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
              <th className="py-1.5 pr-3 font-medium">Variação</th>
              <th className="py-1.5 pr-3 font-medium">seller_sku</th>
              <th className="py-1.5 pr-3 font-medium">SKU ID</th>
              <th className="py-1.5 pr-3 font-medium">EAN</th>
              <th className="py-1.5 pr-3 text-right font-medium">Preço</th>
              <th className="py-1.5 pr-3 text-right font-medium">Estoque</th>
              <th className="py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {skus.map((sku) => {
              const variation = (sku.sales_attributes ?? [])
                .map((a) => a.value_name)
                .filter((v): v is string => v !== undefined && v !== "")
                .join(" / ");
              const stock = (sku.inventory ?? []).reduce(
                (sum, inv) => sum + (inv.quantity ?? 0),
                0,
              );
              return (
                <tr key={sku.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 pr-3 text-slate-800">{variation !== "" ? variation : "—"}</td>
                  <td className="select-all py-1.5 pr-3 font-mono text-slate-800">
                    {sku.seller_sku !== undefined && sku.seller_sku !== "" ? (
                      sku.seller_sku
                    ) : (
                      <span className="font-sans text-red-600">vazio!</span>
                    )}
                  </td>
                  <td className="select-all py-1.5 pr-3 font-mono text-slate-500">{sku.id}</td>
                  <td className="select-all py-1.5 pr-3 font-mono text-slate-500">
                    {sku.identifier_code?.code ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-slate-800">
                    {formatPrice(sku.price?.sale_price, sku.price?.currency)}
                  </td>
                  <td
                    className={`py-1.5 pr-3 text-right ${stock === 0 ? "font-semibold text-red-600" : "text-slate-800"}`}
                  >
                    {stock}
                  </td>
                  <td className="py-1.5 text-slate-500">{sku.status_info?.status ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
