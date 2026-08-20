import { CreditCard, MapPin, Package } from "lucide-react";
import type { Order, OrderLineItem, OrderPayment, RecipientAddress } from "../types/tiktok";
import { groupLineItems, totalUnits } from "../lib/orders";
import { formatEpochBR, formatPrice } from "../lib/format";
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

      <LineItemsTable items={items} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PaymentBlock payment={order.payment} />
        <RecipientBlock address={order.recipient_address} />
      </div>
    </Card>
  );
}

/**
 * Itens do pedido — a visão que interessa para o de-para com o ERP.
 *
 * Cada entrada de `line_items` é UMA unidade (ver src/lib/orders.ts), então
 * a tabela agrupa por SKU e mostra a quantidade, em vez de repetir linhas.
 */
function LineItemsTable({ items }: { items: OrderLineItem[] }) {
  if (items.length === 0) {
    return <p className="mt-3 text-xs t-4">Pedido sem itens.</p>;
  }

  const grouped = groupLineItems(items);
  const units = totalUnits(items);
  // Uma linha por SKU: é o formato usado para cruzar com o cadastro do ERP.
  const sellerSkuColumn = grouped.map((g) => g.sellerSku ?? "").join("\n");

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
              <th className="text-right">Preço unit.</th>
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
                <td className="text-right t-1">
                  {formatPrice(g.salePrice, g.currency)}
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

function PaymentBlock({ payment }: { payment: OrderPayment | undefined }) {
  if (payment === undefined) return null;
  const c = payment.currency;

  const rows: Array<[string, string | undefined]> = [
    ["Subtotal produtos", payment.sub_total],
    ["Frete", payment.shipping_fee],
    ["Desconto do vendedor", payment.seller_discount],
    ["Desconto da plataforma", payment.platform_discount],
    ["Impostos", payment.tax],
    ["Taxa de serviço do comprador", payment.buyer_service_fee],
    ["Total", payment.total_amount],
  ];

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="side-block !pb-2">
        <div className="side-label flex items-center gap-1.5">
          <CreditCard className="h-3 w-3" />
          Pagamento
        </div>
        <dl className="space-y-1 text-xs">
          {rows
            .filter(([, value]) => value !== undefined && value !== "")
            .map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <dt className="t-4">{label}</dt>
                <dd className={label === "Total" ? "line !inline-flex !bg-transparent !border-0 !p-0" : "font-medium t-1"}>
                  {label === "Total" ? (
                    <span className="ln-v amount">{formatPrice(value, c)}</span>
                  ) : (
                    formatPrice(value, c)
                  )}
                </dd>
              </div>
            ))}
        </dl>
      </div>
    </div>
  );
}

function RecipientBlock({ address }: { address: RecipientAddress | undefined }) {
  if (address === undefined) return null;

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
          <Row label="Endereço" value={address.full_address} />
          <Row
            label="CEP / região"
            value={[address.postal_code, address.region_code].filter(Boolean).join(" · ") || undefined}
          />
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
