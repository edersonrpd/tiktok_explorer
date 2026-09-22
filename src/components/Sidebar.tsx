import { KeyRound, Music2, X } from "lucide-react";
import type { HistoryEntry } from "../App";
import { BUILDER_TABS, type BuilderTab } from "./EndpointBuilder";
import { HistoryList } from "./HistoryList";

/**
 * Painel lateral fixo: escolhe o tipo de consulta, guarda o histórico da
 * sessão e o access token. Tudo que é "configuração" sai da área central,
 * que fica livre para o formulário e o resultado.
 */
export function Sidebar({
  tab,
  onTabSelect,
  history,
  activeHistoryId,
  onHistorySelect,
  token,
  onTokenChange,
}: {
  tab: BuilderTab;
  onTabSelect: (tab: BuilderTab) => void;
  history: HistoryEntry[];
  activeHistoryId: string | null;
  onHistorySelect: (entry: HistoryEntry) => void;
  token: string;
  onTokenChange: (token: string) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="side-brand">
        <div className="hdr-mark">
          <Music2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-base font-extrabold leading-none tracking-tight">TikTok Shop</p>
          <p className="mt-1 text-[11px] font-semibold side-muted">Explorer · API aberta</p>
        </div>
      </div>

      <nav aria-label="Tipo de consulta" className="side-section">
        <p className="side-label">Consultar</p>
        <ul className="side-nav">
          {BUILDER_TABS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onTabSelect(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`nav-item ${tab === id ? "nav-active" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <HistoryList entries={history} onSelect={onHistorySelect} activeId={activeHistoryId} />

      <TokenPanel token={token} onTokenChange={onTokenChange} />
    </aside>
  );
}

/** Access token (header x-tts-access-token), salvo neste navegador. */
function TokenPanel({
  token,
  onTokenChange,
}: {
  token: string;
  onTokenChange: (token: string) => void;
}) {
  const saved = token.trim() !== "";

  return (
    <div className="token-panel">
      <div className="flex items-center gap-2">
        <KeyRound className="h-3.5 w-3.5 shrink-0 text-[var(--cyan)]" />
        <label htmlFor="access-token" className="text-xs font-bold">
          Access token
        </label>
        <span className={`ml-auto text-[10.5px] font-bold ${saved ? "token-ok" : "token-missing"}`}>
          {saved ? "● salvo" : "● faltando"}
        </span>
      </div>
      <div className="flex gap-1.5">
        <input
          id="access-token"
          type="text"
          value={token}
          onChange={(e) => onTokenChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="ROW_..."
          className="side-inp font-mono"
        />
        {/* Limpar também apaga o token salvo: o App grava o campo vazio no localStorage. */}
        <button
          type="button"
          onClick={() => onTokenChange("")}
          disabled={!saved}
          aria-label="Limpar token"
          title="Limpar token"
          className="side-icon-btn"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-[10.5px] leading-snug side-muted">
        Vai no header x-tts-access-token e fica salvo neste navegador. A URL assinada não é salva.
      </p>
    </div>
  );
}
