import { optionalParamsFor, requiredParamsFor, type QueryParam } from "../lib/signedUrl";
import type { ResourceKind } from "../lib/endpoint";

/**
 * Painel sempre visível com os parâmetros detectados na query da URL
 * assinada, exatamente como serão enviados (valores brutos, sem decode),
 * para conferência visual: os obrigatórios precisam estar todos lá, e
 * nada além dos que a documentação prevê.
 *
 * O extrato aceita três parâmetros OPCIONAIS (paginação e ordenação), que
 * por isso não entram na contagem de obrigatórios nem são marcados como
 * inesperados — mas continuam listados, já que também são assinados.
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
  const allowedSet = new Set<string>([...expected, ...optionalParamsFor(resourceKind)]);
  const extras = params.filter((p) => !allowedSet.has(p.name));
  const presentRequired = expected.filter((name) => params.some((p) => p.name === name)).length;
  const optionalCount = params.filter((p) => allowedSet.has(p.name) && !requiredSet.has(p.name))
    .length;

  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Parâmetros detectados na URL</span>
        <span
          className={
            presentRequired === expected.length && extras.length === 0
              ? "text-emerald-600"
              : "text-amber-600"
          }
        >
          {presentRequired} de {expected.length} obrigatórios
          {optionalCount > 0 ? ` + ${optionalCount} opcional(is)` : ""}
          {extras.length > 0 ? ` (${extras.length} extra!)` : ""}
        </span>
      </p>
      {params.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum parâmetro ainda — cole a URL assinada acima.</p>
      ) : (
        <dl className="space-y-0.5">
          {params.map((p, i) => (
            <div key={`${p.name}-${i}`} className="flex gap-2 font-mono text-[11px]">
              <dt
                className={
                  allowedSet.has(p.name)
                    ? "shrink-0 font-semibold text-slate-700"
                    : "shrink-0 font-semibold text-amber-700"
                }
              >
                {p.name}
                {!allowedSet.has(p.name) && " (inesperado)"}
                {allowedSet.has(p.name) && !requiredSet.has(p.name) && " (opcional)"}
              </dt>
              <dd className="truncate text-slate-500" title={p.value}>
                {p.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
