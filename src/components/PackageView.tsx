import { ExternalLink, MapPin, Package, Truck } from "lucide-react";
import type { PackageAddress, PackageDetail } from "../types/tiktok";
import { formatEpochBR } from "../lib/format";
import { packageOrderIds } from "../lib/packages";
import { Card, CopyButton } from "./ui";

const DONE_STATUSES = new Set(["COMPLETED", "DELIVERED"]);
const BAD_STATUSES = new Set(["CANCELLED", "CANCEL", "FAILED"]);

function badgeClass(status: string | undefined): string {
  if (status === undefined) return "badge gray";
  if (DONE_STATUSES.has(status)) return "badge green";
  if (BAD_STATUSES.has(status)) return "badge gray";
  return "badge blue";
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

function Row({ label, value }: { label: string; value: string | undefined }) {
  if (value === undefined || value === "") return null;
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 t-4">{label}</dt>
      <dd className="t-1">{value}</dd>
    </div>
  );
}

function timeOrUndefined(epoch: number | undefined): string | undefined {
  return epoch !== undefined && epoch > 0 ? formatEpochBR(epoch) : undefined;
}

function measures(data: PackageDetail): string | undefined {
  const d = data.dimension;
  if (d === undefined) return undefined;
  const parts = [d.length, d.width, d.height].filter((v) => v !== undefined && v !== "");
  return parts.length === 0 ? undefined : `${parts.join(" × ")} ${d.unit ?? ""}`.trim();
}

function AddressBlock({ title, address }: { title: string; address: PackageAddress | undefined }) {
  if (address === undefined) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="side-block !pb-2">
        <div className="side-label flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />
          {title}
        </div>
        <dl className="space-y-1 text-xs">
          <Row label="Nome" value={address.name} />
          <Row label="Telefone" value={address.phone_number} />
          <Row label="Logradouro" value={address.address_line2} />
          <Row label="Número" value={address.address_line3} />
          <Row label="Complemento" value={address.address_line4} />
          <Row label="Bairro" value={address.address_line1} />
          <Row label="CEP" value={address.postal_code} />
          <Row label="Endereço completo" value={address.full_address} />
        </dl>
      </div>
    </div>
  );
}

/** Exibição do pacote retornado por GET /fulfillment/202309/packages/{id}. */
export function PackageView({
  data,
  requestedId,
  onOpenOrders,
}: {
  data: PackageDetail;
  requestedId: string;
  onOpenOrders: (ids: string[]) => void;
}) {
  const orderIds = packageOrderIds(data);
  const orders = data.orders ?? [];
  const sameTracking =
    data.last_mile_tracking_number === undefined ||
    data.last_mile_tracking_number === data.tracking_number;

  return (
    <>
      <Card
        title={`Pacote ${data.package_id ?? requestedId}`}
        icon={<Package />}
        actions={
          <span className={badgeClass(data.package_status)}>
            {data.package_status ?? "—"}
            {data.package_sub_status !== undefined ? ` · ${data.package_sub_status}` : ""}
          </span>
        }
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
          <Field label="Código do pacote" value={data.package_id} mono />
          <Field label="Rastreio" value={data.tracking_number} mono />
          {!sameTracking && (
            <Field label="Rastreio última milha" value={data.last_mile_tracking_number} mono />
          )}
          <Field label="Transportadora" value={data.shipping_provider_name} />
          <Field label="Tipo de envio" value={data.shipping_type} />
          <Field label="Entrega" value={data.delivery_option_name} />
          <Field label="Coleta" value={data.handover_method} />
          <Field label="Criado em" value={formatEpochBR(data.create_time)} />
          <Field label="Atualizado em" value={formatEpochBR(data.update_time)} />
          <Field label="Dimensões" value={measures(data)} />
          <Field
            label="Peso"
            value={data.weight?.value !== undefined ? `${data.weight.value} ${data.weight.unit ?? ""}`.trim() : undefined}
          />
          <Field
            label="Vários SKUs"
            value={data.has_multi_skus === undefined ? undefined : data.has_multi_skus ? "Sim" : "Não"}
          />
          <Field label="Janela de coleta (início)" value={timeOrUndefined(data.pickup_slot?.start_time)} />
          <Field label="Janela de coleta (fim)" value={timeOrUndefined(data.pickup_slot?.end_time)} />
          <Field label="Marcador do comprador" value={data.note_tag} />
          <Field label="Divisão/junção" value={data.split_and_combine_tag} />
        </dl>
      </Card>

      <Card title={orderIds.length === 1 ? "Pedido do pacote" : "Pedidos do pacote"} icon={<Truck />}>
        {orderIds.length === 0 ? (
          <p className="text-xs t-3">
            A resposta não trouxe o ID do pedido — confira o <strong>JSON bruto</strong>.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {orderIds.map((id) => (
              <span key={id} className="select-all font-mono t-1">
                {id}
              </span>
            ))}
            <CopyButton text={orderIds.join(", ")} label="Copiar" />
            <button
              type="button"
              onClick={() => onOpenOrders(orderIds)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1 font-bold t-1 hover:bg-[var(--surface-2,transparent)]"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir pedido
            </button>
          </div>
        )}
        <p className="mt-2 text-[11px] t-4">
          O botão leva o ID para a aba <strong>Pedidos</strong> com o endpoint já montado; falta só
          assinar e colar a URL assinada, porque cada consulta é assinada separadamente.
        </p>

        {orders.some((o) => (o.skus ?? []).length > 0) && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide t-4">
                  <th className="py-1 pr-3 font-medium">Pedido</th>
                  <th className="py-1 pr-3 font-medium">SKU</th>
                  <th className="py-1 pr-3 font-medium">Nome</th>
                  <th className="py-1 text-right font-medium">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {orders.flatMap((order) =>
                  (order.skus ?? []).map((sku, i) => (
                    <tr key={`${order.id ?? ""}-${sku.id ?? i}`} className="border-t border-[var(--border)]">
                      <td className="select-all py-1.5 pr-3 font-mono t-2">{order.id}</td>
                      <td className="select-all py-1.5 pr-3 font-mono t-2">{sku.id}</td>
                      <td className="py-1.5 pr-3 t-1">
                        <span className="flex items-center gap-2">
                          {sku.image_url !== undefined && (
                            <img
                              src={sku.image_url}
                              alt=""
                              loading="lazy"
                              className="h-8 w-8 rounded object-cover"
                            />
                          )}
                          {sku.name}
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-mono t-1">{sku.quantity}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}

        {(data.order_line_item_ids ?? []).length > 0 && (
          <p className="mt-3 text-[11px] t-4">
            Itens do pedido neste pacote:{" "}
            <span className="select-all font-mono">{data.order_line_item_ids?.join(", ")}</span>
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <AddressBlock title="Destinatário" address={data.recipient_address} />
        <AddressBlock title="Remetente" address={data.sender_address} />
      </div>
    </>
  );
}
