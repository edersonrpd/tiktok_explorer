import type { DiagnosticAlert, Severity } from "../lib/diagnostics";
import { Card } from "./ui";

const SEVERITY_STYLE: Record<Severity, { label: string; badge: string; border: string }> = {
  critical: {
    label: "Crítico",
    badge: "bg-red-100 text-red-800",
    border: "border-red-200 bg-red-50",
  },
  warning: {
    label: "Atenção",
    badge: "bg-amber-100 text-amber-800",
    border: "border-amber-200 bg-amber-50",
  },
  info: {
    label: "Informativo",
    badge: "bg-sky-100 text-sky-800",
    border: "border-sky-200 bg-sky-50",
  },
};

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

export function DiagnosticsPanel({ alerts }: { alerts: DiagnosticAlert[] }) {
  const sorted = [...alerts].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return (
    <Card title={`Diagnóstico de integração (${alerts.length} alerta${alerts.length === 1 ? "" : "s"})`}>
      {sorted.length === 0 ? (
        <p className="text-xs text-emerald-700">
          ✓ Nenhuma inconsistência típica de cadastro encontrada.
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((alert, i) => {
            const style = SEVERITY_STYLE[alert.severity];
            return (
              <li key={i} className={`rounded border px-3 py-2 ${style.border}`}>
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${style.badge}`}
                  >
                    {style.label}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{alert.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{alert.detail}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
