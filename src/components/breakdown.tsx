import { useMemo, type ReactNode } from "react";
import type { FeeTaxBreakdown } from "../types/tiktok";
import { readFeeTax, type AmountEntry } from "../lib/statements";
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
    <div className={`kpi ${strong === true ? "kpi-strong" : ""}`}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
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

/**
 * Tarifas, impostos e — a parte que importa — a CONTA entre eles e o
 * total que a API declara para o bloco.
 *
 * Somar as linhas exibidas não dá o total, por dois motivos que este
 * componente separa em vez de misturar: a comissão de afiliado aparece
 * duas vezes (antes e depois do IR do criador), e sobra um valor por
 * pedido que a API cobra sem detalhar em campo nenhum. Antes disso, quem
 * conferia via um punhado de linhas que não fechavam com o desconto e não
 * tinha como saber onde estava a diferença.
 *
 * Vale para os dois endpoints que devolvem `fee_tax_breakdown`: o extrato
 * e as transações a liquidar. Só o rótulo do total muda.
 */
export function FeeTaxBlock({
  title,
  breakdown,
  total,
  totalField,
  currency,
  labelFor,
}: {
  title: string;
  breakdown: FeeTaxBreakdown | undefined;
  total: Money | undefined;
  /** Nome do campo da API, mostrado na linha de total da conferência. */
  totalField: string;
  currency: string | undefined;
  labelFor: (field: string) => string;
}) {
  const { entries, reference, reconciliation, zeros } = useMemo(
    () => readFeeTax(breakdown, total, labelFor),
    [breakdown, total, labelFor],
  );

  return (
    <div className="space-y-3">
      <BreakdownBlock
        title={title}
        total={total}
        entries={entries}
        zeros={zeros}
        currency={currency}
      />

      {reconciliation !== undefined && !reconciliation.matches && (
        <div className="panel px-3 py-2">
          <dl className="space-y-0.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="t-4">Soma das linhas acima</dt>
              <dd className="shrink-0 font-medium t-1">
                {formatMoney(reconciliation.sum, currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="t-2">Cobrado sem detalhamento</dt>
              <dd
                className={`shrink-0 font-semibold ${
                  reconciliation.undetailed < 0 ? "text-red-600" : "t-1"
                }`}
              >
                {formatMoney(reconciliation.undetailed, currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-0.5">
              <dt className="font-medium t-2">Total ({totalField})</dt>
              <dd className="shrink-0 font-semibold t-1">
                {formatMoney(reconciliation.total, currency)}
              </dd>
            </div>
          </dl>
          <p className="mt-1 text-[10px] t-4">
            A API cobra esta diferença sem informar em qual campo ela entra — nenhum dos campos de{" "}
            <code>fee</code> ou <code>tax</code> a reporta. Ela está no total e, portanto, já foi
            descontada do repasse.
          </p>
        </div>
      )}

      {reference.length > 0 && (
        <BreakdownBlock
          title="Comissão de afiliado — recortes"
          note="Não somam: são a mesma comissão acima, vista antes do IR do criador."
          entries={reference}
          zeros={0}
          currency={currency}
        />
      )}
    </div>
  );
}

export interface CompositionSegment {
  label: string;
  value: Money | undefined;
  tone: "ink" | "accent" | "amber" | "gray";
}

/**
 * Para onde vai a receita: uma barra com o repasse e cada custo na
 * proporção do seu valor absoluto. É leitura rápida, não conferência — os
 * números exatos ficam na legenda e nas abas abaixo.
 */
export function CompositionBar({
  title,
  segments,
  currency,
  note,
}: {
  title: string;
  segments: CompositionSegment[];
  currency: string | undefined;
  note?: string;
}) {
  const total = segments.reduce((sum, s) => sum + Math.abs(s.value ?? 0), 0);
  if (total === 0) return null;

  return (
    <div className="composition">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-bold t-2">{title}</h3>
        {note !== undefined && <span className="text-[11px] t-4">{note}</span>}
      </div>
      <div className="composition-bar" aria-hidden="true">
        {segments.map((s) =>
          Math.abs(s.value ?? 0) === 0 ? null : (
            <span
              key={s.label}
              className={`seg-${s.tone}`}
              style={{ width: `${(Math.abs(s.value ?? 0) / total) * 100}%` }}
            />
          ),
        )}
      </div>
      <dl className="composition-legend">
        {segments.map((s) => (
          <div key={s.label}>
            <dt>
              <span className={`swatch seg-${s.tone}`} />
              {s.label}
            </dt>
            <dd className="font-mono">{formatMoney(s.value, currency)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
