import { Receipt } from "lucide-react";
import type { SkuTransaction, TransactionsByOrderData } from "../types/tiktok";
import { formatEpochBR, formatPrice } from "../lib/format";
import { Card } from "./ui";

/** Exibição das transações retornadas por GET /finance/202501/orders/{id}/statement_transactions. */
export function TransactionView({ data }: { data: TransactionsByOrderData }) {
  const skuTransactions = data.sku_transactions ?? [];
  const currency = data.currency;

  return (
    <Card
      title={`Transações do pedido ${data.order_id}`}
      icon={<Receipt />}
      count={data.total_count}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
        <Field label="Criado em" value={formatEpochBR(data.order_create_time)} />
        <Field label="Receita" value={formatPrice(data.revenue_amount, currency)} />
        <Field label="Taxas e impostos" value={formatPrice(data.fee_and_tax_amount, currency)} />
        <Field label="Frete" value={formatPrice(data.shipping_cost_amount, currency)} />
        <Field label="Valor líquido (settlement)" value={formatPrice(data.settlement_amount, currency)} />
      </dl>

      {skuTransactions.length === 0 ? (
        <p className="mt-3 text-xs t-4">Nenhuma transação de SKU nesta resposta.</p>
      ) : (
        <SkuTransactionsTable skus={skuTransactions} currency={currency} />
      )}
    </Card>
  );
}

function SkuTransactionsTable({
  skus,
  currency,
}: {
  skus: SkuTransaction[];
  currency: string | undefined;
}) {
  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-xs font-bold t-2">
        Transações por SKU — {skus.length} registro(s)
      </h3>
      <div className="overflow-x-auto">
        <table className="tbl text-xs">
          <thead>
            <tr>
              <th>Produto</th>
              <th>SKU</th>
              <th>statement_id</th>
              <th className="text-right">Qtd</th>
              <th className="text-right">Receita</th>
              <th className="text-right">Frete</th>
              <th className="text-right">Taxas/impostos</th>
              <th className="text-right">Líquido</th>
            </tr>
          </thead>
          <tbody>
            {skus.map((sku, index) => (
              <tr key={`${sku.statement_id ?? "sem-statement"}-${sku.sku_id ?? index}`}>
                <td className="max-w-[16rem] t-1">{sku.product_name ?? "—"}</td>
                <td className="t-2">
                  {sku.sku_name ?? "—"}
                  {sku.sku_id !== undefined && (
                    <div className="select-all font-mono text-[10px] t-4">{sku.sku_id}</div>
                  )}
                </td>
                <td className="select-all font-mono t-3">{sku.statement_id ?? "—"}</td>
                <td className="text-right font-semibold t-1">{sku.quantity ?? "—"}</td>
                <td className="text-right t-1">{formatPrice(sku.revenue_amount, currency)}</td>
                <td className="text-right t-1">{formatPrice(sku.shipping_cost_amount, currency)}</td>
                <td className="text-right t-1">{formatPrice(sku.fee_tax_amount, currency)}</td>
                <td className="text-right font-semibold t-1">
                  {formatPrice(sku.settlement_amount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] t-4">
        Detalhamento completo de cada breakdown (receita, frete, taxas e impostos) está no JSON
        bruto abaixo.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide t-4">{label}</dt>
      <dd className="t-1">{value !== undefined && value !== "" ? value : "—"}</dd>
    </div>
  );
}
