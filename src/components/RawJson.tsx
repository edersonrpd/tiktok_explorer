import { Braces } from "lucide-react";
import type { TikTokApiResponse } from "../types/tiktok";
import { Card } from "./ui";

/** Cartão que abre o drawer com o JSON completo da resposta. */
export function RawJson({
  response,
  onView,
}: {
  response: TikTokApiResponse<unknown>;
  onView: () => void;
}) {
  return (
    <Card title="JSON bruto" icon={<Braces />}>
      <p className="mb-3 text-xs t-3">
        Resposta completa da API (request_id{" "}
        <span className="select-all font-mono">{response.request_id}</span>), exatamente como
        recebida, para conferência ou depuração.
      </p>
      <button type="button" onClick={onView} className="btn-secondary">
        <Braces className="h-3.5 w-3.5" />
        Ver JSON Original
      </button>
    </Card>
  );
}
