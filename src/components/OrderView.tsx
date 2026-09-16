import { Clock, FileText, MapPin, Package } from "lucide-react";
import type { Order, OrderLineItem, RecipientAddress } from "../types/tiktok";
import { groupLineItems, totalUnits } from "../lib/orders";
import { deadlineHint, formatEpochBR, formatPrice } from "../lib/format";
import { formatMoney, isZero } from "../lib/money";
import { PaymentStatement } from "./PaymentStatement";
import { Card, CopyButton } from "./ui";

const DONE_STATUSES = new Set(["COMPLETED", "DELIVERED"]);
const BAD_STATUSES = new Set(["CANCELLED", "CANCEL"]);

function statusBadgeClass(status: string | undefined): string {
  if (status === undefined) return "badge gray";
  if (DONE_STATUSES.has(status)) return "badge green";
  if (BAD_STATUSES.has(status)) return "badge gray";
  return "badge blue";
}

/** Exibição dos pedidos retornados por GET /order/202507/orders. */
export function OrderView({ orders, requestedIds }: { orders: Order[]; requestedIds: string[] }) {
  const returnedIds = new Set(orders.map((o) => o.id));
  const missing = requestedIds.filter((id) => !returnedIds.has(id));

  return (
    <>
      {missing.length > 0 && (
        <div className="alert alert-warning px-4 py-3">
          <h3 className="text-sm font-bold text-amber-800">
            {missing.length} pedido(s) solicitado(s) não vieram na resposta
          </h3>
          <p className="mt-1 text-xs t-2">
            IDs sem retorno: <span className="font-mono">{missing.join(", ")}</span>. Normalmente
            significa ID inexistente, de outra loja, ou fora do alcance do shop_cipher usado.
          </p>
        </div>
      )}

      {orders.length === 0 ? (
        <Card title="Pedidos" icon={<Package />}>
          <p className="text-xs t-4">A resposta não trouxe nenhum pedido.</p>
        </Card>
      ) : (
        orders.map((order) => <OrderCard key={order.id} order={order} />)
      )}
    </>
  );
}

function OrderCard({ order }: { order: Order }) {
  const items = order.line_items ?? [];
  const currency = order.payment?.currency;

  return (
    <Card
      title={`Pedido ${order.id}`}
      icon={<Package />}
      actions={<span className={statusBadgeClass(order.status)}>{order.status ?? "—"}</span>}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
        <Field label="Criado em" value={formatEpochBR(order.create_time)} />
        <Field label="Pago em" value={formatEpochBR(order.paid_time)} />
        <Field label="Atualizado em" value={formatEpochBR(order.update_time)} />
        <Field label="Total" value={formatPrice(order.payment?.total_amount, currency)} />
        <Field label="Entrega" value={order.delivery_type} />
        <Field label="Opção de entrega" value={order.delivery_option_name} />
        <Field label="Fulfillment" value={order.fulfillment_type} />
        <Field label="Transportadora" value={order.shipping_provider} />
        <Field label="Rastreio" value={order.tracking_number} mono />
        <Field label="Forma de pagamento" value={order.payment_method_name} />
        <Field label="Comprador" value={order.buyer_nickname ?? order.user_id} mono />
        <Field
          label="CPF do comprador"
          value={order.cpf !== undefined ? `${order.cpf}${order.cpf_name !== undefined ? ` (${order.cpf_name})` : ""}` : undefined}
          mono
        />
        {order.cancel_reason !== undefined && (
          <Field
            label="Cancelamento"
            value={`${order.cancel_reason}${order.cancellation_initiator !== undefined ? ` (${order.cancellation_initiator})` : ""}`}
          />
        )}
      </dl>

      <Flags order={order} />

      {(order.buyer_message ?? order.seller_note) !== undefined && (
        <div className="mt-3 space-y-1 text-xs">
          {order.buyer_message !== undefined && order.buyer_message !== "" && (
            <p>
              <span className="font-medium t-4">Mensagem do comprador: </span>
              <span className="t-1">{order.buyer_message}</span>
            </p>
          )}
          {order.seller_note !== undefined && order.seller_note !== "" && (
            <p>
              <span className="font-medium t-4">Nota do vendedor: </span>
              <span className="t-1">{order.seller_note}</span>
            </p>
          )}
        </div>
      )}

      <LineItemsTable items={items} currency={currency} />

      <div className="mt-4">
        <PaymentStatement order={order} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <RecipientBlock address={order.recipient_address} />
        <div className="space-y-4">
          <FiscalBlock order={order} />
          <DeadlinesBlock order={order} />
        </div>
      </div>
    </Card>
  );
}

/** Marcadores que mudam o tratamento do pedido e são fáceis de perder no JSON. */
function Flags({ order }: { order: Order }) {
  const flags: string[] = [];
  if (order.is_cod === true) flags.push("pagamento na entrega");
  if (order.is_sample_order === true) flags.push("pedido amostra");
  if (order.is_on_hold_order === true) flags.push("retido (on hold)");
  if (order.is_replacement_order === true) flags.push("reposição");
  if (order.is_buyer_request_cancel === true) flags.push("comprador pediu cancelamento");
  if (order.has_updated_recipient_address === true) flags.push("endereço alterado pelo comprador");
  if (order.split_or_combine_tag !== undefined && order.split_or_combine_tag !== "") {
    flags.push(order.split_or_combine_tag.toLowerCase());
  }
  if (flags.length === 0) return null;

  return (
    <div className="badges">
      {flags.map((flag) => (
        <span key={flag} className="badge amber">
          {flag}
        </span>
      ))}
    </div>
  );
}

/**
 * Itens do pedido — a visão que interessa para o de-para com o ERP.
 *
 * Cada entrada de `line_items` é UMA unidade (ver src/lib/orders.ts), então
 * a tabela agrupa por SKU e mostra a quantidade, em vez de repetir linhas.
 * As colunas de preço mostram a conta do item: preço cheio, o desconto de
 * cada lado e o que o comprador pagou por aquele SKU. As duas colunas de
 * desconto só aparecem quando algum item teve desconto — senão seriam duas
 * colunas de travessão.
 */
function LineItemsTable({ items, currency }: { items: OrderLineItem[]; currency: string | undefined }) {
  if (items.length === 0) {
    return <p className="mt-3 text-xs t-4">Pedido sem itens.</p>;
  }

  const grouped = groupLineItems(items);
  const units = totalUnits(items);
  // Uma linha por SKU: é o formato usado para cruzar com o cadastro do ERP.
  const sellerSkuColumn = grouped.map((g) => g.sellerSku ?? "").join("\n");
  const anyDiscount = grouped.some(
    (g) => !isZero(g.sellerDiscountTotal) || !isZero(g.platformDiscountTotal),
  );

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-xs font-bold t-2">
          Itens — {grouped.length} SKU(s), {units} unidade(s)
        </h3>
        <CopyButton text={sellerSkuColumn} label="Copiar coluna seller_sku" />
      </div>
      <div className="overflow-x-auto">
        <table className="tbl text-xs">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Variação</th>
              <th>seller_sku</th>
              <th>SKU ID</th>
              <th className="text-right">Qtd</th>
              <th className="text-right">Preço cheio</th>
              {anyDiscount && (
                <>
                  <th className="text-right">Desc. vendedor</th>
                  <th className="text-right">Desc. TikTok</th>
                </>
              )}
              <th className="text-right">Total do item</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <tr key={g.key}>
                <td className="max-w-[18rem] t-1">
                  <div className="flex items-center gap-2.5">
                    <div className="item-thumb">
                      {g.skuImage !== undefined && g.skuImage !== "" ? (
                        <img src={g.skuImage} alt="" />
                      ) : (
                        <div className="item-thumb-ph" />
                      )}
                    </div>
                    <span>{g.productName ?? "—"}</span>
                  </div>
                </td>
                <td className="t-2">{g.skuName ?? "—"}</td>
                <td className="select-all font-mono t-1">
                  {g.sellerSku !== undefined && g.sellerSku !== "" ? (
                    g.sellerSku
                  ) : (
                    <span className="font-sans text-red-600">vazio!</span>
                  )}
                </td>
                <td className="select-all font-mono t-3">{g.skuId ?? "—"}</td>
                <td className="text-right font-semibold t-1">{g.quantity}</td>
                <td className="text-right t-2">
                  {formatMoney(g.originalTotal, g.currency ?? currency)}
                </td>
                {anyDiscount && (
                  <>
                    <td className="text-right text-[var(--green)]">
                      {isZero(g.sellerDiscountTotal)
                        ? "—"
                        : `− ${formatMoney(g.sellerDiscountTotal, g.currency ?? currency)}`}
                    </td>
                    <td className="text-right text-[var(--green)]">
                      {isZero(g.platformDiscountTotal)
                        ? "—"
                        : `− ${formatMoney(g.platformDiscountTotal, g.currency ?? currency)}`}
                    </td>
                  </>
                )}
                <td className="text-right font-semibold t-1">
                  {formatMoney(g.saleTotal, g.currency ?? currency)}
                  {g.priceVaries && (
                    <span className="ml-1 text-amber-600" title="Unidades deste SKU saíram com preços diferentes">
                      *
                    </span>
                  )}
                </td>
                <td className="t-3">{g.statuses.length > 0 ? g.statuses.join(" / ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {grouped.some((g) => g.priceVaries) && (
        <p className="mt-1 text-[11px] text-amber-700">
          * unidades do mesmo SKU com preços diferentes — confira o JSON bruto.
        </p>
      )}
    </div>
  );
}

function RecipientBlock({ address }: { address: RecipientAddress | undefined }) {
  if (address === undefined) return null;

  const levels = address.district_info ?? [];
  const named = (level: string): string | undefined =>
    levels.find((d) => d.address_level === level)?.address_name;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="side-block !pb-2">
        <div className="side-label flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />
          Destinatário
        </div>
        <dl className="space-y-1 text-xs">
          <Row label="Nome" value={address.name} />
          <Row label="Telefone" value={address.phone_number} />
          <Row label="Logradouro" value={address.address_line2} />
          <Row label="Número" value={address.address_line1} />
          <Row label="Complemento" value={address.address_line3} />
          <Row label="Bairro" value={address.address_line4} />
          <Row label="Detalhe" value={address.address_detail} />
          <Row label="Cidade" value={named("L2")} />
          <Row label="Estado" value={named("L1")} />
          <Row label="País" value={named("L0")} />
          <Row label="CEP" value={address.postal_code} />
          <Row label="Endereço completo" value={address.full_address} />
        </dl>
        <p className="mt-2 text-[10px] leading-relaxed t-4">
          Telefone e e-mail vêm mascarados pela API; o valor real só aparece na etiqueta gerada pelo
          TikTok. Confira a ordem logradouro/número: o TikTok numera as linhas de endereço por região
          e nem sempre bate com o layout do ERP.
        </p>
      </div>
    </div>
  );
}

/** Dados que a emissão da nota fiscal no Brasil exige e o financeiro cobra. */
function FiscalBlock({ order }: { order: Order }) {
  const rows: Array<[string, string | undefined]> = [
    ["CNPJ do marketplace", order.channel_entity_national_registry_id],
    ["Nota fiscal", order.need_upload_invoice],
    ["Código do pagamento", order.payment_method_code],
    ["Autorização", order.payment_auth_code],
    ["E-mail do comprador", order.buyer_email],
    ["Canal", order.commerce_platform],
    ["Tipo de pedido", order.order_type],
    ["Armazém", order.warehouse_id],
  ];
  const present = rows.filter(([, value]) => value !== undefined && value !== "");
  if (present.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="side-block !pb-2">
        <div className="side-label flex items-center gap-1.5">
          <FileText className="h-3 w-3" />
          Fiscal e pagamento
        </div>
        <dl className="space-y-1 text-xs">
          {present.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-36 shrink-0 t-4">{label}</dt>
              <dd className="select-all break-all font-mono t-1">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Prazos do pedido, com quanto falta para cada um. */
function DeadlinesBlock({ order }: { order: Order }) {
  const rows: Array<[string, number | undefined]> = [
    ["Postar até (RTS)", order.rts_sla_time],
    ["Entregar à transportadora (TTS)", order.tts_sla_time],
    ["Coleta até", order.collection_due_time],
    ["Cancelamento automático", order.cancel_order_sla_time],
    ["SLA de entrega", order.delivery_sla_time],
    ["Envio até", order.shipping_due_time],
  ];
  const present = rows.filter(([, value]) => value !== undefined && value > 0);
  if (present.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="side-block !pb-2">
        <div className="side-label flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Prazos
        </div>
        <dl className="space-y-1 text-xs">
          {present.map(([label, value]) => {
            const hint = deadlineHint(value);
            return (
              <div key={label} className="flex items-baseline justify-between gap-2">
                <dt className="t-4">{label}</dt>
                <dd className="text-right t-1">
                  {formatEpochBR(value)}
                  {hint !== undefined && (
                    <span className={`ml-1 text-[10px] ${hint.overdue ? "text-[var(--rose)]" : "t-4"}`}>
                      ({hint.label})
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  if (value === undefined || value === "") return null;
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 t-4">{label}</dt>
      <dd className="t-1">{value}</dd>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | undefined; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide t-4">{label}</dt>
      <dd className={`t-1 ${mono === true ? "select-all font-mono" : ""}`}>
        {value !== undefined && value !== "" ? value : "—"}
      </dd>
    </div>
  );
}
