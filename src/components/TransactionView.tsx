import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Receipt } from "lucide-react";
import type { SkuTransaction, TransactionsByOrderData } from "../types/tiktok";
import { formatEpochBR, formatPrice, isZeroOrEmpty, prettyFieldLabel } from "../lib/format";
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
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-xs font-bold t-2">
        Transações por SKU — {skus.length} registro(s)
      </h3>
      <div className="overflow-x-auto">
        <table className="tbl text-xs">
          <thead>
            <tr>
              <th />
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
            {skus.map((sku, index) => {
              const isOpen = expanded.has(index);
              const rowKey = `${sku.statement_id ?? "sem-statement"}-${sku.sku_id ?? index}`;
              return (
                <Fragment key={rowKey}>
                  <tr className="cursor-pointer" onClick={() => toggle(index)}>
                    <td className="w-6">
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 t-4" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 t-4" />
                      )}
                    </td>
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
                    <td className="text-right t-1">
                      {formatPrice(sku.shipping_cost_amount, currency)}
                    </td>
                    <td className="text-right t-1">{formatPrice(sku.fee_tax_amount, currency)}</td>
                    <td className="text-right font-semibold t-1">
                      {formatPrice(sku.settlement_amount, currency)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={9} className="bg-[var(--surface2)] p-0">
                        <SkuBreakdown sku={sku} currency={currency} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Detalhamento de uma transação de SKU: só mostra os componentes diferentes de zero de cada breakdown. */
function SkuBreakdown({ sku, currency }: { sku: SkuTransaction; currency: string | undefined }) {
  const revenue = sku.revenue_breakdown ?? {};
  const { supplementary_component: shippingSupplement, ...shipping } =
    sku.shipping_cost_breakdown ?? {};
  const fee = sku.fee_tax_breakdown?.fee ?? {};
  const tax = sku.fee_tax_breakdown?.tax ?? {};

  return (
    <div className="grid gap-4 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
      <BreakdownBlock
        title="Receita"
        total={sku.revenue_amount}
        currency={currency}
        entries={Object.entries(revenue)}
      />
      <BreakdownBlock
        title="Frete"
        total={sku.shipping_cost_amount}
        currency={currency}
        entries={Object.entries(shipping)}
        extra={
          shippingSupplement !== undefined ? (
            <BreakdownBlock
              title="Frete — componentes suplementares"
              currency={currency}
              entries={Object.entries(shippingSupplement)}
              compact
            />
          ) : null
        }
      />
      <div className="space-y-3">
        <BreakdownBlock title="Taxas" currency={currency} entries={Object.entries(fee)} compact />
        <BreakdownBlock title="Impostos" currency={currency} entries={Object.entries(tax)} compact />
      </div>
    </div>
  );
}

function BreakdownBlock({
  title,
  total,
  currency,
  entries,
  extra,
  compact,
}: {
  title: string;
  total?: string;
  currency: string | undefined;
  entries: Array<[string, string | undefined]>;
  extra?: ReactNode;
  compact?: boolean;
}) {
  const rows = entries.filter(([, value]) => !isZeroOrEmpty(value));

  return (
    <div>
      <div className={`flex items-center justify-between ${compact ? "mb-1" : "mb-1.5"}`}>
        <h4 className="text-[11px] font-bold uppercase tracking-wide t-3">{title}</h4>
        {total !== undefined && (
          <span className="text-xs font-semibold t-1">{formatPrice(total, currency)}</span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-[11px] t-4">Nenhum componente diferente de zero.</p>
      ) : (
        <dl className="space-y-0.5 text-xs">
          {rows.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <dt className="t-4">{prettyFieldLabel(key)}</dt>
              <dd className="font-medium t-1">{formatPrice(value, currency)}</dd>
            </div>
          ))}
        </dl>
      )}
      {extra}
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
