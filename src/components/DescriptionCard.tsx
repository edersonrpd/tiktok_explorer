import { useMemo } from "react";
import DOMPurify from "dompurify";
import { FileText } from "lucide-react";
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
    <Card title="Descrição" icon={<FileText />}>
      {sanitized === "" ? (
        <p className="text-xs t-4">Sem descrição.</p>
      ) : (
        <div
          className="prose-sm max-w-none text-xs leading-relaxed t-2 [&_img]:max-w-full [&_p]:mb-2"
          // Seguro: `sanitized` já passou pelo DOMPurify acima.
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )}
    </Card>
  );
}
