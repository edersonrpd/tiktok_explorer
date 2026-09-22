import type { HistoryEntry } from "../App";

/**
 * Últimas consultas bem-sucedidas da sessão (só em memória — some ao
 * recarregar). Clicar recarrega o resultado guardado, sem nova chamada.
 * Vive no painel lateral, em lista vertical, para não empurrar o resultado
 * para baixo.
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
    <div className="side-section">
      <p className="side-label">
        Histórico da sessão
        {entries.length > 0 && <span className="side-count">{entries.length}</span>}
      </p>
      {entries.length === 0 ? (
        <p className="side-empty">As consultas feitas aparecem aqui.</p>
      ) : (
        <ul className="side-history">
          {entries.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                aria-current={activeId === entry.key ? "true" : undefined}
                className={`hist-item ${activeId === entry.key ? "hist-active" : ""}`}
              >
                <span className="hist-label">{entry.label}</span>
                <span className="hist-sub">
                  {entry.subtitle} · {entry.time.toLocaleTimeString("pt-BR")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
