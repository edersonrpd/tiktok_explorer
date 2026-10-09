import { Package } from "lucide-react";
import type { PackageDetail } from "../types/tiktok";
import { packageOrderIds } from "../lib/packages";
import { Card, CopyButton } from "./ui";

function Field({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <dt className="font-medium t-4">{label}</dt>
      <dd className="font-mono t-1">{value !== undefined && value !== "" ? value : "—"}</dd>
    </div>
  );
}

/** Exibição do pacote retornado por GET /fulfillment/202309/packages/{id}. */
export function PackageView({ data, requestedId }: { data: PackageDetail; requestedId: string }) {
  const orderIds = packageOrderIds(data);

  return (
    <Card title={`Pacote ${data.package_id ?? requestedId}`} icon={<Package />}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
        <Field label="Status do pacote" value={data.package_status} />
        <Field label="Transportadora" value={data.shipping_provider_name} />
        <Field label="Rastreio" value={data.tracking_number} />
      </dl>

      <div className="mt-3 text-xs">
        <p className="font-medium t-4">
          {orderIds.length === 1 ? "Pedido do pacote" : "Pedidos do pacote"}
        </p>
        {orderIds.length === 0 ? (
          <p className="mt-1 t-3">
            A resposta não trouxe o ID do pedido nos campos conhecidos — confira o{" "}
            <strong>JSON bruto</strong>.
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {orderIds.map((id) => (
              <span key={id} className="font-mono t-1">
                {id}
              </span>
            ))}
            <CopyButton text={orderIds.join(", ")} label="Copiar" />
          </div>
        )}
        <p className="mt-2 t-4">
          Cole o ID na aba <strong>Pedidos</strong> para ver o pedido completo.
        </p>
      </div>
    </Card>
  );
}
