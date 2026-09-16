import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { DiagnosticAlert, Severity } from "../lib/diagnostics";

const SEVERITY_STYLE: Record<Severity, { label: string; badge: string; borderColor: string }> = {
  critical: { label: "Crítico", badge: "badge pink", borderColor: "var(--accent)" },
  warning: { label: "Atenção", badge: "badge amber", borderColor: "#f59e0b" },
  info: { label: "Informativo", badge: "badge blue", borderColor: "#0ea5e9" },
};

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

export function DiagnosticsPanel({ alerts }: { alerts: DiagnosticAlert[] }) {
  const sorted = [...alerts].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return (
    <section className="card">
      <div className="card-hd">
        <div className="hd-left">
          <span className="ico">
            <ShieldAlert />
          </span>
          <h2 className="text-sm font-bold t-1">Diagnóstico de integração</h2>
          <span className="count">{alerts.length}</span>
        </div>
      </div>
      <div className="card-bd">
        {sorted.length === 0 ? (
          <div className="ok-state !p-0 !text-left">
            <p className="flex items-center gap-1.5 text-xs font-semibold t-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--green)]" />
              Nenhuma inconsistência típica de cadastro encontrada.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((alert, i) => {
              const style = SEVERITY_STYLE[alert.severity];
              return (
                <li
                  key={i}
                  className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 py-2"
                  style={{ borderLeft: `4px solid ${style.borderColor}` }}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 ${style.badge}`}>{style.label}</span>
                    <div>
                      <p className="text-xs font-semibold t-1">{alert.title}</p>
                      <p className="mt-0.5 text-xs t-2">{alert.detail}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
