import { useMemo, useState } from "react";
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
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-semibold text-slate-700"
        >
          {open ? "▾" : "▸"} JSON bruto
        </button>
        <div className="flex gap-2">
          <CopyButton text={json} label="Copiar JSON" />
          <button
            type="button"
            onClick={handleDownload}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Baixar .json
          </button>
        </div>
      </header>
      {open && (
        <pre className="max-h-96 overflow-auto border-t border-slate-100 bg-slate-50 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-700">
          {json}
        </pre>
      )}
    </section>
  );
}
