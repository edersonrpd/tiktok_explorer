import { useEffect } from "react";
import { Copy, Download, X } from "lucide-react";

interface JsonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: unknown;
  title: string;
  subtitle?: string;
  onToast: (msg: string) => void;
}

/** Escapa HTML e colore tokens do JSON (chave, string, número, booleano, null). */
function syntaxHighlight(json: string): string {
  const escaped = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "jn";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "jk" : "js";
      } else if (/true|false/.test(match)) {
        cls = "jb";
      } else if (/null/.test(match)) {
        cls = "jnull";
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

/** Painel deslizante escuro com o JSON bruto da resposta, à direita da tela. */
export function JsonDrawer({ isOpen, onClose, data, title, subtitle, onToast }: JsonDrawerProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    void navigator.clipboard.writeText(jsonString).then(() => onToast("JSON copiado!"));
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tiktok-${title.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className={`overlay ${isOpen ? "open" : ""}`} onClick={onClose}></div>
      <div className={`drawer ${isOpen ? "open" : ""}`}>
        <div className="drawer-head">
          <h3>{title}</h3>
          {subtitle !== undefined && <span className="sub">{subtitle}</span>}
          <div className="right">
            <button type="button" className="icon-btn" title="Copiar tudo" onClick={handleCopy}>
              <Copy />
            </button>
            <button type="button" className="icon-btn" title="Baixar .json" onClick={handleDownload}>
              <Download />
            </button>
            <button type="button" className="icon-btn" onClick={onClose} title="Fechar">
              <X />
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <pre dangerouslySetInnerHTML={{ __html: syntaxHighlight(jsonString) }}></pre>
        </div>
      </div>
    </>
  );
}
