import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

/** Cartão padrão do layout. */
export function Card({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      <header className="card-hd">
        <h2 className="text-sm font-bold t-1">{title}</h2>
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
