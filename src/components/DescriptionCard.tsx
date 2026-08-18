import { useMemo } from "react";
import DOMPurify from "dompurify";
import { Card } from "./ui";

/**
 * A descrição vem em HTML da API. Sanitizamos com DOMPurify antes de
 * injetar — nunca dangerouslySetInnerHTML com o HTML cru, pois o conteúdo
 * é externo (cadastrado no seller center) e poderia carregar scripts.
 */
export function DescriptionCard({ html }: { html: string | undefined }) {
  const sanitized = useMemo(
    () => (html !== undefined ? DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) : ""),
    [html],
  );

  return (
    <Card title="Descrição">
      {sanitized === "" ? (
        <p className="text-xs text-slate-400">Sem descrição.</p>
      ) : (
        <div
          className="prose-sm max-w-none text-xs leading-relaxed text-slate-700 [&_img]:max-w-full [&_p]:mb-2"
          // Seguro: `sanitized` já passou pelo DOMPurify acima.
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )}
    </Card>
  );
}
