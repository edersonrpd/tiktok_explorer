import type { Order, OrderLineItem, OrderPayment, RecipientAddress } from "../types/tiktok";
import { formatEpochBR, formatPrice } from "../lib/format";
import { Card, CopyButton } from "./ui";

/** Exibição dos pedidos retornados por GET /order/202507/orders. */
export function OrderView({ orders, requestedIds }: { orders: Order[]; requestedIds: string[] }) {
  const returnedIds = new Set(orders.map((o) => o.id));
  const missing = requestedIds.filter((id) => !returnedIds.has(id));

  return (
    <>
      {missing.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-amber-900">
            {missing.length} pedido(s) solicitado(s) não vieram na resposta
          </h3>
          <p className="mt-1 text-xs text-amber-800">
            IDs sem retorno: <span className="font-mono">{missing.join(", ")}</span>. Normalmente
            significa ID inexistente, de outra loja, ou fora do alcance do shop_cipher usado.
          </p>
        </div>
      )}

      {orders.length === 0 ? (
        <Card title="Pedidos">
          <p className="text-xs text-slate-400">A resposta não trouxe nenhum pedido.</p>
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
      actions={
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {order.status ?? "—"}
        </span>
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
        <Field label="Criado em" value={formatEpochBR(order.create_time)} />
        <Field label="Pago em" value={formatEpochBR(order.paid_time)} />
        <Field label="Atualizado em" value={formatEpochBR(order.update_time)} />
        <Field label="Total" value={formatPrice(order.payment?.total_amount, currency)} />
        <Field label="Entrega" value={order.delivery_type} />
        <Field label="Fulfillment" value={order.fulfillment_type} />
        <Field label="Transportadora" value={order.shipping_provider} />
        <Field label="Rastreio" value={order.tracking_number} mono />
        <Field label="Comprador" value={order.buyer_nickname ?? order.user_id} mono />
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
              <span className="font-medium text-slate-500">Mensagem do comprador: </span>
              <span className="text-slate-800">{order.buyer_message}</span>
            </p>
          )}
          {order.seller_note !== undefined && order.seller_note !== "" && (
            <p>
              <span className="font-medium text-slate-500">Nota do vendedor: </span>
              <span className="text-slate-800">{order.seller_note}</span>
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

/** Itens do pedido — a visão que interessa para o de-para com o ERP. */
function LineItemsTable({ items }: { items: OrderLineItem[] }) {
  if (items.length === 0) {
    return <p className="mt-3 text-xs text-slate-400">Pedido sem itens.</p>;
  }

  const sellerSkuColumn = items.map((i) => i.seller_sku ?? "").join("\n");

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700">Itens ({items.length})</h3>
        <CopyButton text={sellerSkuColumn} label="Copiar coluna seller_sku" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
              <th className="py-1.5 pr-3 font-medium">Produto</th>
              <th className="py-1.5 pr-3 font-medium">Variação</th>
              <th className="py-1.5 pr-3 font-medium">seller_sku</th>
              <th className="py-1.5 pr-3 font-medium">SKU ID</th>
              <th className="py-1.5 pr-3 text-right font-medium">Preço</th>
              <th className="py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="max-w-[16rem] py-1.5 pr-3 text-slate-800">
                  {item.product_name ?? "—"}
                </td>
                <td className="py-1.5 pr-3 text-slate-600">{item.sku_name ?? "—"}</td>
                <td className="select-all py-1.5 pr-3 font-mono text-slate-800">
                  {item.seller_sku !== undefined && item.seller_sku !== "" ? (
                    item.seller_sku
                  ) : (
                    <span className="font-sans text-red-600">vazio!</span>
                  )}
                </td>
                <td className="select-all py-1.5 pr-3 font-mono text-slate-500">
                  {item.sku_id ?? "—"}
                </td>
                <td className="py-1.5 pr-3 text-right text-slate-800">
                  {formatPrice(item.sale_price, item.currency)}
                </td>
                <td className="py-1.5 text-slate-500">{item.display_status ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <div>
      <h3 className="mb-1 text-xs font-semibold text-slate-700">Pagamento</h3>
      <dl className="space-y-0.5 text-xs">
        {rows
          .filter(([, value]) => value !== undefined && value !== "")
          .map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2">
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-medium text-slate-800">{formatPrice(value, c)}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

function RecipientBlock({ address }: { address: RecipientAddress | undefined }) {
  if (address === undefined) return null;

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold text-slate-700">Destinatário</h3>
      <dl className="space-y-0.5 text-xs">
        <Row label="Nome" value={address.name} />
        <Row label="Telefone" value={address.phone_number} />
        <Row label="Endereço" value={address.full_address} />
        <Row
          label="CEP / região"
          value={[address.postal_code, address.region_code].filter(Boolean).join(" · ") || undefined}
        />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  if (value === undefined || value === "") return null;
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | undefined; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`text-slate-800 ${mono === true ? "select-all font-mono" : ""}`}>
        {value !== undefined && value !== "" ? value : "—"}
      </dd>
    </div>
  );
}
