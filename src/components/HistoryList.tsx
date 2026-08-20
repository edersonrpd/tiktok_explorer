import { History } from "lucide-react";
import type { HistoryEntry } from "../App";
import { Card } from "./ui";

/**
 * Últimas consultas bem-sucedidas da sessão (só em memória — some ao
 * recarregar). Clicar recarrega o resultado guardado, sem nova chamada.
 * Layout horizontal porque agora ocupa a largura toda, acima dos resultados.
 */
export function HistoryList({
  entries,
  onSelect,
  activeId,
}: {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  activeId: string | null;
}) {
  if (entries.length === 0) return null;

  return (
    <Card title="Histórico da sessão" icon={<History />} count={entries.length}>
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => onSelect(entry)}
            className={`max-w-[240px] rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-left transition-colors ${
              activeId === entry.key
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--surface2)] hover:border-[var(--border2)]"
            }`}
          >
            <p className="truncate text-xs font-bold t-1">{entry.label}</p>
            <p className="truncate font-mono text-[10px] t-4">
              {entry.subtitle} · {entry.time.toLocaleTimeString("pt-BR")}
            </p>
          </button>
        ))}
      </div>
    </Card>
  );
}
