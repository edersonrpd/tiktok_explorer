import { CheckCircle2, AlertTriangle } from "lucide-react";
import { requiredParamsFor, type QueryParam } from "../lib/signedUrl";
import type { ResourceKind } from "../lib/endpoint";

/**
 * Painel sempre visível com os parâmetros detectados na query da URL
 * assinada, exatamente como serão enviados (valores brutos, sem decode),
 * para conferência visual: devem ser exatamente 4 e nada a mais.
 */
export function ParamsPanel({
  params,
  resourceKind,
}: {
  params: QueryParam[];
  resourceKind: ResourceKind;
}) {
  const expected = requiredParamsFor(resourceKind);
  const requiredSet = new Set<string>(expected);
  const extras = params.filter((p) => !requiredSet.has(p.name));
  const complete = params.length === expected.length && extras.length === 0;

  return (
    <div className="panel px-3 py-2">
      <p className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide t-3">
        <span>Parâmetros detectados na URL</span>
        <span className={`flex items-center gap-1 ${complete ? "text-emerald-600" : "text-amber-600"}`}>
          {complete ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {params.length} de {expected.length} esperados
          {extras.length > 0 ? ` (${extras.length} extra!)` : ""}
        </span>
      </p>
      {params.length === 0 ? (
        <p className="text-xs t-4">Nenhum parâmetro ainda — cole a URL assinada acima.</p>
      ) : (
        <dl className="space-y-0.5">
          {params.map((p, i) => (
            <div key={`${p.name}-${i}`} className="flex gap-2 font-mono text-[11px]">
              <dt
                className={
                  requiredSet.has(p.name) ? "shrink-0 font-bold t-2" : "shrink-0 font-bold text-amber-700"
                }
              >
                {p.name}
                {!requiredSet.has(p.name) && " (inesperado)"}
              </dt>
              <dd className="truncate t-3" title={p.value}>
                {p.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
