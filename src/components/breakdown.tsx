import type { ReactNode } from "react";
import type { AmountEntry } from "../lib/statements";
import { formatMoney, type Money } from "../lib/money";

/**
 * Peças de exibição compartilhadas pelas telas de finanças.
 *
 * Os três endpoints financeiros devolvem os MESMOS blocos de
 * detalhamento (receita, frete, tarifas, impostos) — muda o nível de cada
 * linha e o prefixo dos totais, não o formato. Manter a renderização em
 * um lugar só é o que garante que uma melhoria na leitura do extrato
 * valha também para as transações a liquidar.
 */

/**
 * Lista de um detalhamento. Só mostra o que é diferente de zero e informa
 * quantos campos zerados foram omitidos — sem isso a tela viraria uma
 * parede de "R$ 0,00" e esconderia as linhas que importam.
 */
export function BreakdownBlock({
  title,
  note,
  total,
  entries,
  zeros,
  currency,
  extra,
}: {
  title: string;
  note?: string;
  total?: Money | undefined;
  entries: AmountEntry[];
  zeros: number;
  currency: string | undefined;
  extra?: ReactNode;
}) {
  if (entries.length === 0 && zeros === 0 && extra === undefined) return null;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wide t-3">{title}</h4>
        {total !== undefined && (
          <span className="text-xs font-semibold t-1">{formatMoney(total, currency)}</span>
        )}
      </div>
      {note !== undefined && <p className="mb-1 text-[11px] t-4">{note}</p>}
      {entries.length === 0 ? (
        <p className="text-[11px] t-4">
          {zeros > 0 ? `Todos os ${zeros} campos vieram zerados ou vazios.` : "Nada informado."}
        </p>
      ) : (
        <dl className="space-y-0.5 text-xs">
          {entries.map((entry) => (
            <div key={entry.field} className="flex items-center justify-between gap-2">
              <dt className="t-4" title={entry.field}>
                {entry.label}
              </dt>
              <dd className={`shrink-0 font-medium ${entry.value < 0 ? "text-red-600" : "t-1"}`}>
                {formatMoney(entry.value, currency)}
              </dd>
            </div>
          ))}
          {zeros > 0 && (
            <p className="pt-0.5 text-[11px] t-4">
              + {zeros} campo(s) zerado(s) ou vazio(s) omitido(s).
            </p>
          )}
        </dl>
      )}
      {extra !== undefined && <div className="mt-3">{extra}</div>}
    </div>
  );
}

/** Valor de destaque no topo do cartão. */
export function Highlight({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`${strong === true ? "panel-success" : "panel"} px-3 py-2`}>
      <p className="text-[10px] font-bold uppercase tracking-wide t-4">{label}</p>
      <p className={`font-mono ${strong === true ? "text-base font-bold t-1" : "text-sm t-1"}`}>
        {value}
      </p>
    </div>
  );
}

/** Par rótulo/valor das listas de campos. */
export function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide t-4">{label}</dt>
      <dd className={`t-1 ${mono === true ? "select-all font-mono" : ""}`}>
        {value !== undefined && value !== "" ? value : "—"}
      </dd>
    </div>
  );
}
