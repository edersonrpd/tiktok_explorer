import type { PackageDimensions, PackageWeight, ProductAttribute } from "../types/tiktok";
import { Card } from "./ui";

export function AttributesCard({ attributes }: { attributes: ProductAttribute[] }) {
  return (
    <Card title="Atributos">
      {attributes.length === 0 ? (
        <p className="text-xs text-slate-400">Sem atributos cadastrados.</p>
      ) : (
        <dl className="space-y-1.5 text-xs">
          {attributes.map((attr, i) => (
            <div key={attr.id ?? i} className="flex gap-2">
              <dt className="w-40 shrink-0 font-medium text-slate-500">{attr.name ?? "—"}</dt>
              <dd className="text-slate-800">
                {(attr.values ?? [])
                  .map((v) => v.name)
                  .filter((n): n is string => n !== undefined && n !== "")
                  .join(", ") || "—"}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

export function PackageCard({
  dimensions,
  weight,
}: {
  dimensions: PackageDimensions | undefined;
  weight: PackageWeight | undefined;
}) {
  const dimText =
    dimensions !== undefined
      ? `${dimensions.length ?? "?"} × ${dimensions.width ?? "?"} × ${dimensions.height ?? "?"} ${dimensions.unit ?? ""}`.trim()
      : "—";
  const weightText =
    weight !== undefined ? `${weight.value ?? "?"} ${weight.unit ?? ""}`.trim() : "—";

  return (
    <Card title="Dimensões e peso da embalagem">
      <dl className="space-y-1.5 text-xs">
        <div className="flex gap-2">
          <dt className="w-40 shrink-0 font-medium text-slate-500">Dimensões (C × L × A)</dt>
          <dd className="text-slate-800">{dimText}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-40 shrink-0 font-medium text-slate-500">Peso</dt>
          <dd className="text-slate-800">{weightText}</dd>
        </div>
      </dl>
    </Card>
  );
}
