import type { Product } from "../types/tiktok";
import { formatEpochBR } from "../lib/format";
import { Card } from "./ui";

export function ProductHeader({ product }: { product: Product }) {
  const chains = product.category_chains ?? [];

  return (
    <Card title="Produto">
      <h1 className="text-base font-semibold text-slate-900">{product.title ?? "(sem título)"}</h1>

      {chains.length > 0 && (
        <nav className="mt-1 text-xs text-slate-500">
          {chains.map((c, i) => (
            <span key={c.id}>
              {i > 0 && <span className="mx-1 text-slate-300">›</span>}
              <span className={c.is_leaf ? "font-semibold text-slate-800" : ""}>{c.local_name}</span>
            </span>
          ))}
        </nav>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
        <Field label="ID" value={product.id} mono />
        <Field label="Status" value={product.status} />
        <Field label="Auditoria" value={product.audit?.status} />
        <Field label="Marca" value={product.brand?.name} />
        <Field label="external_product_id" value={product.external_product_id} mono />
        <Field label="Criado em" value={formatEpochBR(product.create_time)} />
        <Field label="Atualizado em" value={formatEpochBR(product.update_time)} />
      </dl>
    </Card>
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
