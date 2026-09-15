import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Scale, Truck, XCircle } from "lucide-react";
import type { Order } from "../types/tiktok";
import { sumLineItems } from "../lib/orders";
import {
  buildBuyerBreakdown,
  buildSellerStatement,
  effectiveRate,
  parseFeeInput,
  type BreakdownSection,
  type SellerStatement,
  type StatementLine,
} from "../lib/orderStatement";
import { formatMoney, isZero, moneyEquals, moneyOrZero, parseMoney, type Money } from "../lib/money";

/**
 * Extrato financeiro do pedido em três leituras que se completam:
 *
 * 1. **Crédito × débito** — o formato do extrato oficial, com o líquido a
 *    receber, mas mostrando de qual campo do JSON veio cada linha.
 * 2. **O que o comprador pagou** — a conta passo a passo que precisa fechar
 *    com `total_amount`; cada seção compara o somatório com o campo que a
 *    API já devolve pronto, então uma divergência aparece na hora.
 * 3. **Quem pagou o frete** — comprador, plataforma e vendedor separados,
 *    que é onde mora a confusão em pedido com etiqueta do TikTok.
 *
 * O percentual de comissão informado fica em `localStorage`: é a mesma taxa
 * para todos os pedidos da loja, e redigitar a cada consulta seria ruído.
 * Valor absoluto não persiste — ele é específico daquele pedido.
 */

const FEE_STORAGE_KEY = "tiktok-product-viewer.fee-input";

export function PaymentStatement({ order }: { order: Order }) {
  const [feeText, setFeeText] = useState(() => localStorage.getItem(FEE_STORAGE_KEY) ?? "");

  useEffect(() => {
    // Só o percentual vale para o próximo pedido.
    const trimmed = feeText.trim();
    if (trimmed.endsWith("%") || trimmed === "") localStorage.setItem(FEE_STORAGE_KEY, trimmed);
  }, [feeText]);

  const currency = order.payment?.currency;
  const buyer = useMemo(() => buildBuyerBreakdown(order), [order]);
  const feeBase = buyer.reportedTotal ?? buyer.computedTotal;
  const fee = useMemo(() => parseFeeInput(feeText, feeBase), [feeText, feeBase]);
  const feeAmount = fee.kind === "amount" || fee.kind === "rate" ? fee.amount : undefined;
  const statement = useMemo(() => buildSellerStatement(order, feeAmount), [order, feeAmount]);

  return (
    <div className="space-y-4">
      <SellerLedger
        statement={statement}
        currency={currency}
        feeText={feeText}
        onFeeChange={setFeeText}
        feeStatus={fee}
        feeBase={feeBase}
        orderId={order.id}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <BuyerColumn buyer={buyer} currency={currency} />
        <div className="space-y-4">
          <ShippingFundingBlock statement={statement} currency={currency} />
          <ChecksBlock order={order} currency={currency} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* 1. Crédito × débito                                               */
/* ---------------------------------------------------------------- */

function SellerLedger({
  statement,
  currency,
  feeText,
  onFeeChange,
  feeStatus,
  feeBase,
  orderId,
}: {
  statement: SellerStatement;
  currency: string | undefined;
  feeText: string;
  onFeeChange: (value: string) => void;
  feeStatus: ReturnType<typeof parseFeeInput>;
  feeBase: Money;
  orderId: string;
}) {
  const [showZeros, setShowZeros] = useState(false);
  const visible = statement.lines.filter(
    (line) => showZeros || !isZero(line.amount) || line.estimated === true,
  );
  const hidden = statement.lines.length - visible.length;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5">
        <div className="side-label !mb-0 flex items-center gap-1.5">
          <Scale className="h-3 w-3" />
          Extrato do vendedor
        </div>
        {hidden > 0 || showZeros ? (
          <button
            type="button"
            onClick={() => setShowZeros((v) => !v)}
            className="text-[11px] font-medium t-4 underline decoration-dotted hover:t-1"
          >
            {showZeros ? "ocultar linhas zeradas" : `mostrar linhas zeradas (${hidden})`}
          </button>
        ) : null}
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="tbl text-xs">
          <thead>
            <tr>
              <th>Descrição</th>
              <th className="text-right">Crédito</th>
              <th className="text-right">Débito</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((line) => (
              <LedgerRow key={line.label} line={line} currency={currency} />
            ))}
            <tr>
              <td className="font-bold t-1">Totais</td>
              <td className="text-right font-bold text-[var(--green)]">
                {formatMoney(statement.credit, currency)}
              </td>
              <td className="text-right font-bold text-[var(--rose)]">
                {formatMoney(statement.debit, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3">
        <div className="line">
          <div className="ln-l">
            <span className="ln-k !font-sans">Total líquido a receber</span>
            {!statement.feeKnown && (
              <span className="ln-s">sem as comissões, este é o valor máximo</span>
            )}
          </div>
          <span className="ln-v amount">{formatMoney(statement.net, currency)}</span>
        </div>
      </div>

      <FeeField
        feeText={feeText}
        onFeeChange={onFeeChange}
        feeStatus={feeStatus}
        feeBase={feeBase}
        currency={currency}
        orderId={orderId}
      />
    </div>
  );
}

function LedgerRow({ line, currency }: { line: StatementLine; currency: string | undefined }) {
  const value = formatMoney(line.amount, currency);
  const dim = isZero(line.amount) ? "opacity-50" : "";

  return (
    <tr className="align-top">
      <td>
        <span className={`t-1 ${dim}`}>{line.label}</span>
        {line.estimated === true && <span className="badge amber ml-1.5">informado</span>}
        <div className="font-mono text-[10px] t-4">{line.field}</div>
        {line.note !== undefined && <div className="text-[10px] t-3">{line.note}</div>}
      </td>
      <td className={`text-right ${line.side === "credit" ? `text-[var(--green)] ${dim}` : ""}`}>
        {line.side === "credit" ? value : ""}
      </td>
      <td className={`text-right ${line.side === "debit" ? `text-[var(--rose)] ${dim}` : ""}`}>
        {line.side === "debit" ? value : ""}
      </td>
    </tr>
  );
}

function FeeField({
  feeText,
  onFeeChange,
  feeStatus,
  feeBase,
  currency,
  orderId,
}: {
  feeText: string;
  onFeeChange: (value: string) => void;
  feeStatus: ReturnType<typeof parseFeeInput>;
  feeBase: Money;
  currency: string | undefined;
  orderId: string;
}) {
  const rate = feeStatus.kind === "amount" ? effectiveRate(feeStatus.amount, feeBase) : undefined;

  return (
    <div className="border-t border-[var(--border)] px-4 py-3">
      <label className="flex flex-wrap items-center gap-2 text-[11px] t-2">
        <span className="font-semibold">Comissões e taxas de venda</span>
        <input
          value={feeText}
          onChange={(e) => onFeeChange(e.target.value)}
          placeholder="36% ou 6,82"
          className="inp font-mono !w-28 !py-1 text-xs"
        />
        {feeStatus.kind === "rate" && (
          <span className="t-4">
            = {formatMoney(feeStatus.amount, currency)} sobre {formatMoney(feeBase, currency)}
          </span>
        )}
        {feeStatus.kind === "amount" && rate !== undefined && (
          <span className="t-4">= {rate.toFixed(2)}% do total pago</span>
        )}
        {feeStatus.kind === "invalid" && (
          <span className="text-[var(--rose)]">{feeStatus.reason}</span>
        )}
      </label>
      <p className="mt-1.5 text-[10px] leading-relaxed t-4">
        O <span className="font-mono">Get Order Detail</span> não devolve comissão — nenhum campo do
        pedido carrega esse valor. Para o número oficial, consulte as{" "}
        <strong className="t-2">transações do pedido</strong> (
        <span className="font-mono">/finance/202501/orders/{orderId}/statement_transactions</span>),
        que trazem receita, taxas e o <span className="font-mono">settlement_amount</span> já
        apurados. Enquanto nada for informado aqui, o líquido acima é o valor máximo.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* 2. O que o comprador pagou                                        */
/* ---------------------------------------------------------------- */

function BuyerColumn({
  buyer,
  currency,
}: {
  buyer: ReturnType<typeof buildBuyerBreakdown>;
  currency: string | undefined;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="side-block !pb-3">
        <div className="side-label flex items-center gap-1.5">
          <CreditCard className="h-3 w-3" />O que o comprador pagou
        </div>

        <div className="space-y-3">
          {buyer.sections.map((s) => (
            <BreakdownBlock key={s.title} section={s} currency={currency} />
          ))}
        </div>

        <div
          className={`mt-3 flex items-center justify-between gap-2 border-t pt-2 text-xs font-bold ${
            buyer.totalMatches ? "border-[var(--border)] t-1" : "border-[var(--rose)] text-[var(--rose)]"
          }`}
        >
          <span>
            Total pago
            <span className="ml-1 font-mono text-[10px] font-normal t-4">total_amount</span>
          </span>
          <span>{formatMoney(buyer.reportedTotal ?? buyer.computedTotal, currency)}</span>
        </div>
        {!buyer.totalMatches && (
          <p className="mt-1 text-[10px] text-[var(--rose)]">
            A soma das seções dá {formatMoney(buyer.computedTotal, currency)}, mas{" "}
            <span className="font-mono">total_amount</span> diz{" "}
            {formatMoney(buyer.reportedTotal, currency)} — confira o JSON bruto: algum campo de taxa
            não está previsto nesta tela.
          </p>
        )}
      </div>
    </div>
  );
}

function BreakdownBlock({
  section,
  currency,
}: {
  section: BreakdownSection;
  currency: string | undefined;
}) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wide t-4">{section.title}</h4>
      <dl className="mt-1 space-y-1 text-xs">
        {section.rows.map((row) => (
          <div key={row.field + row.label} className="flex items-baseline justify-between gap-2">
            <dt className={isZero(row.amount) ? "t-4 opacity-60" : "t-2"}>
              {row.sign === "minus" ? "− " : ""}
              {row.label}
              <span className="ml-1 font-mono text-[10px] t-4">{row.field}</span>
            </dt>
            <dd
              className={`shrink-0 tabular-nums ${
                isZero(row.amount)
                  ? "t-4 opacity-60"
                  : row.sign === "minus"
                    ? "text-[var(--green)]"
                    : "t-1"
              }`}
            >
              {row.sign === "minus" ? "− " : ""}
              {formatMoney(row.amount, currency)}
            </dd>
          </div>
        ))}
        <div
          className={`flex items-baseline justify-between gap-2 border-t pt-1 font-semibold ${
            section.matches ? "border-[var(--border)] t-1" : "border-[var(--rose)] text-[var(--rose)]"
          }`}
        >
          <dt>
            = {section.reportedLabel}
            {section.reportedField !== undefined && section.reportedField !== "" && (
              <span className="ml-1 font-mono text-[10px] font-normal t-4">
                {section.reportedField}
              </span>
            )}
          </dt>
          <dd className="shrink-0 tabular-nums">
            {formatMoney(section.reported ?? section.computed, currency)}
            {!section.matches && (
              <span className="ml-1 text-[10px]">
                (a conta dá {formatMoney(section.computed, currency)})
              </span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* 3. Quem pagou o frete                                             */
/* ---------------------------------------------------------------- */

function ShippingFundingBlock({
  statement,
  currency,
}: {
  statement: SellerStatement;
  currency: string | undefined;
}) {
  const { shipping } = statement;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="side-block !pb-3">
        <div className="side-label flex items-center gap-1.5">
          <Truck className="h-3 w-3" />
          Quem pagou o frete
        </div>

        <dl className="space-y-1 text-xs">
          <FundingRow label="Comprador" amount={shipping.buyer} currency={currency} />
          <FundingRow label="TikTok Shop (subsídio)" amount={shipping.platform} currency={currency} />
          <FundingRow
            label="Vendedor (desconto concedido)"
            amount={shipping.seller}
            currency={currency}
          />
          {!isZero(shipping.cofunded) && (
            <FundingRow label="Cofinanciado" amount={shipping.cofunded} currency={currency} />
          )}
          <div
            className={`flex justify-between border-t pt-1 font-semibold ${
              shipping.matches ? "border-[var(--border)] t-1" : "border-[var(--rose)] text-[var(--rose)]"
            }`}
          >
            <dt>
              = Frete cheio
              <span className="ml-1 font-mono text-[10px] font-normal t-4">
                original_shipping_fee
              </span>
            </dt>
            <dd className="tabular-nums">{formatMoney(shipping.original, currency)}</dd>
          </div>
        </dl>

        <p className="mt-2 text-[10px] leading-relaxed t-4">
          {shipping.byPlatform ? (
            <>
              <strong className="t-2">Etiqueta do TikTok</strong> (
              <span className="font-mono">shipping_type: TIKTOK</span>
              {shipping.provider !== undefined ? ` · ${shipping.provider}` : ""}): a plataforma
              contrata e paga o envio. O frete cobrado do comprador entra e sai do extrato do
              vendedor — por isso aparece como crédito e como débito, fechando em zero.
            </>
          ) : (
            <>
              Envio por conta do vendedor (
              <span className="font-mono">shipping_type: {shipping.shippingType ?? "—"}</span>): o
              frete cobrado do comprador fica com o vendedor, que paga a transportadora por fora —
              esse custo real não está no pedido.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function FundingRow({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: Money;
  currency: string | undefined;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className={isZero(amount) ? "t-4 opacity-60" : "t-2"}>{label}</dt>
      <dd className={`tabular-nums ${isZero(amount) ? "t-4 opacity-60" : "t-1"}`}>
        {formatMoney(amount, currency)}
      </dd>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Conferências entre `line_items` e `payment`                       */
/* ---------------------------------------------------------------- */

interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

function ChecksBlock({ order, currency }: { order: Order; currency: string | undefined }) {
  const payment = order.payment;
  const items = order.line_items ?? [];
  const totals = sumLineItems(items);
  const checks: Check[] = [];

  const subTotal = parseMoney(payment?.sub_total);
  if (subTotal !== undefined && items.length > 0) {
    checks.push({
      label: "Soma dos itens = sub_total",
      ok: moneyEquals(totals.sale, subTotal),
      detail: `${formatMoney(totals.sale, currency)} × ${formatMoney(subTotal, currency)}`,
    });
  }

  const sellerDiscount = parseMoney(payment?.seller_discount);
  if (sellerDiscount !== undefined && items.length > 0) {
    checks.push({
      label: "Descontos do vendedor nos itens = seller_discount",
      ok: moneyEquals(totals.sellerDiscount, sellerDiscount),
      detail: `${formatMoney(totals.sellerDiscount, currency)} × ${formatMoney(sellerDiscount, currency)}`,
    });
  }

  const platformDiscount = parseMoney(payment?.platform_discount);
  if (platformDiscount !== undefined && items.length > 0) {
    checks.push({
      label: "Descontos da plataforma nos itens = platform_discount",
      ok: moneyEquals(totals.platformDiscount, platformDiscount),
      detail: `${formatMoney(totals.platformDiscount, currency)} × ${formatMoney(platformDiscount, currency)}`,
    });
  }

  const totalAmount = parseMoney(payment?.total_amount);
  if (totalAmount !== undefined && subTotal !== undefined) {
    const expected = subTotal + moneyOrZero(payment?.shipping_fee);
    checks.push({
      label: "sub_total + frete = total_amount",
      ok: moneyEquals(expected, totalAmount),
      detail: `${formatMoney(expected, currency)} × ${formatMoney(totalAmount, currency)}`,
    });
  }

  if (checks.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="side-block !pb-3">
        <div className="side-label flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3" />
          Conferências
        </div>
        <ul className="space-y-1.5 text-xs">
          {checks.map((check) => (
            <li key={check.label} className="flex items-baseline gap-2">
              {check.ok ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 translate-y-0.5 text-[var(--green)]" />
              ) : (
                <XCircle className="h-3 w-3 shrink-0 translate-y-0.5 text-[var(--rose)]" />
              )}
              <span className={check.ok ? "t-2" : "text-[var(--rose)]"}>
                {check.label}
                <span className="ml-1 font-mono text-[10px] t-4">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] t-4">
          Divergência aqui costuma ser pedido parcialmente cancelado ou item de brinde — confira o
          JSON bruto antes de lançar no ERP.
        </p>
      </div>
    </div>
  );
}
