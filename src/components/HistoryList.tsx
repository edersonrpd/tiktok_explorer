import { History } from "lucide-react";
import type { HistoryEntry } from "../App";
import { Card } from "./ui";

/**
 * Últimas consultas bem-sucedidas da sessão (só em memória — some ao
 * recarregar). Clicar recarrega o resultado guardado, sem nova chamada.
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
  return (
    <Card title="Histórico da sessão" icon={<History />} count={entries.length || undefined}>
      {entries.length === 0 ? (
        <p className="text-xs t-4">Nenhuma consulta bem-sucedida ainda.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {entries.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className={`w-full rounded px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--surface2)] ${
                  activeId === entry.key ? "bg-[var(--accent-soft)]" : ""
                }`}
              >
                <p className="truncate text-xs font-bold t-1">{entry.label}</p>
                <p className="truncate font-mono text-[10px] t-4">
                  {entry.subtitle} · {entry.time.toLocaleTimeString("pt-BR")}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
