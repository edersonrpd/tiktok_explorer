import { useMemo, useState } from "react";
import type { AmountBreakdown, OrderFeesData, SkuTransaction } from "../types/tiktok";
import {
  amountsEqual,
  breakdownLines,
  nonZeroLines,
  orderFeeLines,
  sumAmounts,
  type AmountLine,
} from "../lib/fees";
import { formatEpochBR, formatPrice } from "../lib/format";
import { Card, CopyButton } from "./ui";

/**
 * Exibição de GET /finance/202501/orders/{id}/statement_transactions — as
 * taxas que o TikTok cobra do vendedor, que NÃO aparecem no endpoint de
 * pedido (lá só existe o lado do comprador: preço, desconto, frete pago).
 *
 * A resposta detalha tudo por SKU. Os totais do pedido vêm prontos em
 * `data`; as rubricas (comissão, referral, transação, impostos) só existem
 * por SKU, então são somadas aqui para dar a visão do pedido inteiro.
 */
export function FeesView({ fees }: { fees: OrderFeesData }) {
  const skus = useMemo(() => fees.sku_transactions ?? [], [fees.sku_transactions]);
  const { fees: feeLines, taxes: taxLines } = useMemo(() => orderFeeLines(skus), [skus]);
  const [showZeroed, setShowZeroed] = useState(false);

  const currency = fees.currency;
  const visibleFees = showZeroed ? feeLines : nonZeroLines(feeLines);
  const visibleTaxes = showZeroed ? taxLines : nonZeroLines(taxLines);
  const hiddenCount =
    feeLines.length - nonZeroLines(feeLines).length + taxLines.length - nonZeroLines(taxLines).length;

  // As rubricas por SKU devem somar o total de taxas do pedido. Quando não
  // somam, alguma rubrica veio fora do breakdown — vale avisar em vez de
  // deixar o usuário conferir na mão contra o extrato.
  const breakdownTotal = sumAmounts([
    ...feeLines.map((l) => l.amount),
    ...taxLines.map((l) => l.amount),
  ]);
  const skuFeeTotal = sumAmounts(skus.map((sku) => sku.fee_tax_amount));
  const breakdownMatches = amountsEqual(breakdownTotal, skuFeeTotal);

  return (
    <>
      <Card
        title={`Taxas do pedido ${fees.order_id ?? "—"}`}
        actions={
          currency !== undefined && currency !== "" ? (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {currency}
            </span>
          ) : undefined
        }
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
          <Total label="Receita" value={fees.revenue_amount} currency={currency} />
          <Total label="Frete" value={fees.shipping_cost_amount} currency={currency} />
          <Total label="Taxas + impostos" value={fees.fee_and_tax_amount} currency={currency} />
          <Total label="Repasse" value={fees.settlement_amount} currency={currency} strong />
        </dl>

        <p className="mt-3 text-[11px] text-slate-400">
          Liquidação do pedido criado em {formatEpochBR(fees.order_create_time)}.
          {fees.total_count !== undefined && ` ${fees.total_count} registro(s) de transação.`} Os
          sinais são os que a API devolve — taxas normalmente chegam negativas.
        </p>

        {skus.length === 0 && (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            A resposta não trouxe nenhum SKU liquidado. Pedido ainda não liquidado não aparece
            aqui: nesse caso o caminho é <code className="font-mono">/finance/202507/orders/unsettled</code>,
            que devolve os valores estimados e não é montado por esta aplicação.
          </p>
        )}

        {skus.length > 0 && !breakdownMatches && (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
            As rubricas detalhadas somam {formatPrice(breakdownTotal, currency)}, mas as taxas por
            SKU somam {formatPrice(skuFeeTotal, currency)}. Alguma cobrança veio fora do
            detalhamento — confira o JSON bruto antes de usar estes números.
          </p>
        )}
      </Card>

      {(feeLines.length > 0 || taxLines.length > 0) && (
        <Card
          title="Detalhamento do pedido"
          actions={
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <input
                type="checkbox"
                checked={showZeroed}
                onChange={(e) => setShowZeroed(e.target.checked)}
                className="h-3 w-3"
              />
              Mostrar zeradas
            </label>
          }
        >
          <LineTable
            title="Taxas da plataforma"
            lines={visibleFees}
            currency={currency}
            emptyLabel="Nenhuma taxa com valor nesta liquidação."
          />
          <div className="mt-4">
            <LineTable
              title="Impostos"
              lines={visibleTaxes}
              currency={currency}
              emptyLabel="Nenhum imposto com valor nesta liquidação."
            />
          </div>

          {!showZeroed && hiddenCount > 0 && (
            <p className="mt-3 text-[11px] text-slate-400">
              {hiddenCount} rubrica(s) zerada(s) oculta(s). As rubricas variam por região e por
              programa do vendedor, então a maioria chega em zero.
            </p>
          )}
        </Card>
      )}

      {skus.length > 0 && <SkuBreakdown skus={skus} currency={currency} />}
    </>
  );
}

function Total({
  label,
  value,
  currency,
  strong,
}: {
  label: string;
  value: string | undefined;
  currency: string | undefined;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd
        className={
          strong === true ? "text-sm font-semibold text-slate-900" : "text-sm text-slate-800"
        }
      >
        {formatPrice(value, currency)}
      </dd>
    </div>
  );
}

/**
 * Tabela de rubricas. A chave crua da API aparece junto do rótulo de
 * propósito: é por ela que se procura no JSON bruto e na documentação, e
 * rubrica sem tradução conhecida só tem esse nome.
 */
function LineTable({
  title,
  lines,
  currency,
  emptyLabel,
}: {
  title: string;
  lines: AmountLine[];
  currency: string | undefined;
  emptyLabel: string;
}) {
  const total = sumAmounts(lines.map((l) => l.amount));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700">{title}</h3>
        {lines.length > 0 && (
          <CopyButton
            text={lines.map((l) => `${l.key}\t${l.amount}`).join("\n")}
            label="Copiar"
          />
        )}
      </div>

      {lines.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyLabel}</p>
      ) : (
        <table className="w-full text-left text-xs">
          <tbody>
            {lines.map((line) => (
              <tr key={line.key} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-3">
                  <span className="text-slate-800">{line.label}</span>
                  <span className="ml-1.5 select-all font-mono text-[10px] text-slate-400">
                    {line.key}
                  </span>
                </td>
                <td className="whitespace-nowrap py-1.5 text-right font-medium text-slate-800">
                  {formatPrice(line.amount, currency)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 pr-3 text-right text-[11px] font-medium text-slate-500">
                Soma das linhas exibidas
              </td>
              <td className="whitespace-nowrap py-1.5 text-right font-semibold text-slate-900">
                {formatPrice(total, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Um bloco por SKU, já que é nesse nível que a API detalha tudo. */
function SkuBreakdown({ skus, currency }: { skus: SkuTransaction[]; currency: string | undefined }) {
  return (
    <Card title={`Por SKU — ${skus.length} item(ns) liquidado(s)`}>
      <div className="space-y-2">
        {skus.map((sku, index) => (
          <details
            key={sku.sku_id ?? `sku-${index}`}
            className="rounded border border-slate-200 px-3 py-2"
          >
            <summary className="cursor-pointer text-xs text-slate-800">
              <span className="font-medium">{sku.product_name ?? "(sem nome)"}</span>
              {sku.sku_name !== undefined && sku.sku_name !== "" && (
                <span className="text-slate-500"> · {sku.sku_name}</span>
              )}
              {sku.quantity !== undefined && <span className="text-slate-500"> · {sku.quantity}un</span>}
              <span className="ml-1 font-semibold">
                {" "}
                repasse {formatPrice(sku.settlement_amount, currency)}
              </span>
            </summary>

            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
              <Total label="Receita" value={sku.revenue_amount} currency={currency} />
              <Total label="Frete" value={sku.shipping_cost_amount} currency={currency} />
              <Total label="Taxas + impostos" value={sku.fee_tax_amount} currency={currency} />
              <Total label="SKU ID" value={sku.sku_id} currency={undefined} />
            </dl>

            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <SkuGroup title="Taxas" group={sku.fee_tax_breakdown?.fee} currency={currency} />
              <SkuGroup title="Impostos" group={sku.fee_tax_breakdown?.tax} currency={currency} />
              <SkuGroup title="Receita" group={sku.revenue_breakdown} currency={currency} />
              <SkuGroup title="Frete" group={sku.shipping_cost_breakdown} currency={currency} />
            </div>

            {sku.statement_id !== undefined && (
              <p className="mt-2 text-[11px] text-slate-400">
                Extrato <span className="select-all font-mono">{sku.statement_id}</span>
              </p>
            )}
          </details>
        ))}
      </div>
    </Card>
  );
}

function SkuGroup({
  title,
  group,
  currency,
}: {
  title: string;
  group: AmountBreakdown | undefined;
  currency: string | undefined;
}) {
  // No nível do SKU as zeradas ficam sempre fora: o grupo completo chega
  // com dezenas de "0" e o que interessa é o que foi cobrado.
  const lines = nonZeroLines(breakdownLines(group));
  if (lines.length === 0) return null;

  return <LineTable title={title} lines={lines} currency={currency} emptyLabel="" />;
}
