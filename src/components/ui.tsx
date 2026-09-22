import { useState, type ReactNode } from "react";
import { Check, Copy, Download } from "lucide-react";

/** Cartão padrão do layout. */
export function Card({
  title,
  icon,
  count,
  children,
  actions,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="card">
      <header className="card-hd">
        <div className="hd-left">
          {icon !== undefined && <span className="ico">{icon}</span>}
          <h2 className="text-sm font-bold t-1">{title}</h2>
          {count !== undefined && <span className="count">{count}</span>}
        </div>
        {actions}
      </header>
      <div className="card-bd">{children}</div>
    </section>
  );
}

/** Botão que copia texto para o clipboard com feedback visual. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button type="button" onClick={handleCopy} className={`chip ${copied ? "chip-active" : ""}`}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : label}
    </button>
  );
}

/**
 * Baixa um arquivo. Existe ao lado do CopyButton porque os dois resolvem
 * problemas diferentes: copiar serve para colar numa planilha já aberta;
 * baixar entrega o arquivo para anexar, versionar ou abrir com dois
 * cliques — que é o que se faz com um fechamento financeiro.
 *
 * `build` devolve o conteúdo e só roda no clique: gerar um .xlsx a cada
 * re-render, para um arquivo que talvez ninguém baixe, é trabalho jogado
 * fora a cada tecla digitada no filtro.
 *
 * Texto ganha o BOM (\uFEFF), e isso não é decorativo: sem ele o Excel lê
 * o CSV como Latin-1 e "Transações" vira "TransaÃ§Ãµes". Bytes vão como
 * estão — um .xlsx é binário e um BOM o corromperia.
 */
export function DownloadButton({
  build,
  filename,
  label,
  mimeType = "text/csv;charset=utf-8",
}: {
  build: () => string | Uint8Array;
  filename: string;
  label: string;
  mimeType?: string;
}) {
  const handleDownload = () => {
    const content = build();
    const blob =
      typeof content === "string"
        ? new Blob([`\uFEFF${content}`], { type: mimeType })
        : new Blob([content as unknown as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Sem revoke o blob fica na memória até a aba fechar.
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={handleDownload} className="chip">
      <Download className="h-3 w-3" />
      {label}
    </button>
  );
}
