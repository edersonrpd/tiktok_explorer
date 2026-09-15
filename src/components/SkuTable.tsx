import { Layers } from "lucide-react";
import type { Sku } from "../types/tiktok";
import { formatPrice } from "../lib/format";
import { Card, CopyButton } from "./ui";

/** Tabela de variações — a visão mais importante para o de-para com o ERP. */
export function SkuTable({ skus }: { skus: Sku[] }) {
  if (skus.length === 0) {
    return (
      <Card title="Variações" icon={<Layers />}>
        <p className="text-xs t-4">Produto sem variações (skus vazio).</p>
      </Card>
    );
  }

  const sellerSkuColumn = skus.map((s) => s.seller_sku ?? "").join("\n");

  return (
    <Card
      title="Variações"
      icon={<Layers />}
      count={skus.length}
      actions={<CopyButton text={sellerSkuColumn} label="Copiar coluna seller_sku" />}
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
                <tr key={sku.id}>
                  <td className="t-1">{variation !== "" ? variation : "—"}</td>
                  <td className="select-all font-mono t-1">
                    {sku.seller_sku !== undefined && sku.seller_sku !== "" ? (
                      sku.seller_sku
                    ) : (
                      <span className="font-sans text-red-600">vazio!</span>
                    )}
                  </td>
                  <td className="select-all font-mono t-3">{sku.id}</td>
                  <td className="select-all font-mono t-3">{sku.identifier_code?.code ?? "—"}</td>
                  <td className="text-right t-1">
                    {formatPrice(sku.price?.sale_price, sku.price?.currency)}
                  </td>
                  <td className="text-right">
                    <span className={`badge ${stock === 0 ? "pink" : "green"}`}>{stock}</span>
                  </td>
                  <td className="t-3">{sku.status_info?.status ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
