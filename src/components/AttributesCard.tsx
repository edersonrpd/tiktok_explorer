import { ClipboardList, PackageSearch } from "lucide-react";
import type { PackageDimensions, PackageWeight, ProductAttribute } from "../types/tiktok";

export function AttributesCard({ attributes }: { attributes: ProductAttribute[] }) {
  return (
    <section className="card">
      <div className="card-hd">
        <div className="hd-left">
          <span className="ico">
            <ClipboardList />
          </span>
          <h2 className="text-sm font-bold t-1">Atributos</h2>
          <span className="count">{attributes.length}</span>
        </div>
      </div>
      {attributes.length === 0 ? (
        <p className="px-4 py-3 text-xs t-4">Sem atributos cadastrados.</p>
      ) : (
        <div className="attr-list">
          {attributes.map((attr, i) => (
            <div key={attr.id ?? i} className="attr-row">
              <span className="akey">{attr.name ?? "—"}</span>
              <span className="aval">
                {(attr.values ?? [])
                  .map((v) => v.name)
                  .filter((n): n is string => n !== undefined && n !== "")
                  .join(", ") || "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
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
    <section className="card">
      <div className="card-hd">
        <div className="hd-left">
          <span className="ico">
            <PackageSearch />
          </span>
          <h2 className="text-sm font-bold t-1">Dimensões e peso da embalagem</h2>
        </div>
      </div>
      <div className="attr-list">
        <div className="attr-row">
          <span className="akey">Dimensões (C × L × A)</span>
          <span className="aval mono">{dimText}</span>
        </div>
        <div className="attr-row">
          <span className="akey">Peso</span>
          <span className="aval mono">{weightText}</span>
        </div>
      </div>
    </section>
  );
}
