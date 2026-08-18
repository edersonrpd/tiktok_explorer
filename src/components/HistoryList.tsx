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
    <Card title="Histórico da sessão">
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhuma consulta bem-sucedida ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className={`w-full py-1.5 text-left hover:bg-slate-50 ${
                  activeId === entry.key ? "bg-slate-50" : ""
                }`}
              >
                <p className="truncate text-xs font-medium text-slate-800">{entry.label}</p>
                <p className="truncate font-mono text-[10px] text-slate-400">
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
