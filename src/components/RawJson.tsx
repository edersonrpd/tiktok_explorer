import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Download } from "lucide-react";
import type { TikTokApiResponse } from "../types/tiktok";
import { CopyButton } from "./ui";

/** Seção recolhida com o JSON completo da resposta, com copiar e baixar. */
export function RawJson({ response }: { response: TikTokApiResponse<unknown> }) {
  const [open, setOpen] = useState(false);
  const json = useMemo(() => JSON.stringify(response, null, 2), [response]);

  const handleDownload = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tiktok-${response.request_id !== "" ? response.request_id : "resposta"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card">
      <header className="card-hd">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-sm font-bold t-1"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          JSON bruto
        </button>
        <div className="flex gap-2">
          <CopyButton text={json} label="Copiar JSON" />
          <button type="button" onClick={handleDownload} className="btn-secondary">
            <Download className="h-3 w-3" />
            Baixar .json
          </button>
        </div>
      </header>
      {open && (
        <pre className="code-panel max-h-96 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-[color:var(--code-text)]">
          {json}
        </pre>
      )}
    </section>
  );
}
