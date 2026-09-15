import { useMemo, useState } from "react";
import type { StatementTransaction, StatementTransactionsData } from "../types/tiktok";
import {
  buildStatementEndpoint,
  type StatementSortOrder,
} from "../lib/endpoint";
import {
  checkStatementFormulas,
  nonZeroEntries,
  parseAmount,
  totalsByType,
  transactionsTsv,
  zeroFieldCount,
  type AmountEntry,
} from "../lib/statements";
import {
  FEE_TAX_LABELS,
  labelForType,
  REVENUE_LABELS,
  SHIPPING_LABELS,
  SHIPPING_SUPPLEMENTARY_LABELS,
  STATEMENT_TOTAL_LABELS,
  TRANSACTION_SUPPLEMENTARY_LABELS,
} from "../lib/statementLabels";
import { formatAmount, formatEpochBR, formatEpochDateBR } from "../lib/format";
import { Card, CopyButton } from "./ui";

/** Parâmetros da consulta que gerou esta página, para montar a próxima. */
export interface StatementPageQuery {
  statementId: string;
  pageSize: number | undefined;
  sortOrder: StatementSortOrder | undefined;
}

/**
 * Exibição de GET /finance/202501/statements/{id}/statement_transactions.
 *
 * O extrato é o que o financeiro concilia: o topo mostra os totais do
 * repasse e o detalhamento por transação fica sob demanda, porque a API
 * devolve ~70 campos por transação e quase todos vêm zerados.
 */
export function StatementView({
  data,
  query,
}: {
  data: StatementTransactionsData;
  query: StatementPageQuery;
}) {
  const transactions = data.transactions ?? [];
  const currency = data.currency;

  return (
    <>
      <StatementSummary data={data} transactions={transactions} />
      <NextPageCard data={data} query={query} />
      <TypeTotalsCard transactions={transactions} currency={currency} />
      <TransactionsCard transactions={transactions} currency={currency} />
    </>
  );
}

function StatementSummary({
  data,
  transactions,
}: {
  data: StatementTransactionsData;
  transactions: StatementTransaction[];
}) {
  const currency = data.currency;
  const checks = useMemo(() => checkStatementFormulas(data), [data]);
  const breakdown = data.total_settlement_breakdown;

  return (
    <Card
      title={`Extrato ${data.id ?? "—"}`}
      actions={
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {data.status ?? "—"}
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Highlight
          label="Valor a pagar"
          value={formatAmount(parseAmount(data.payable_amount), currency)}
          strong
        />
        <Highlight
          label="Total repassado"
          value={formatAmount(parseAmount(data.total_settlement_amount), currency)}
        />
        <Highlight
          label="Reserva (retida/liberada)"
          value={formatAmount(parseAmount(data.total_reserve_amount), currency)}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-slate-100 pt-3 text-xs sm:grid-cols-4">
        <Field label="Gerado em" value={formatEpochBR(data.create_time)} />
        <Field label="Moeda" value={currency} />
        <Field
          label="Transações no extrato"
          value={data.total_count !== undefined ? String(data.total_count) : undefined}
        />
        <Field label="Nesta página" value={String(transactions.length)} />
      </dl>

      {breakdown !== undefined && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <h3 className="mb-1 text-xs font-semibold text-slate-700">
            Composição do total repassado
          </h3>
          <dl className="space-y-0.5 text-xs">
            {Object.entries(STATEMENT_TOTAL_LABELS).map(([field, label]) => (
              <div key={field} className="flex justify-between gap-2">
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-medium text-slate-800">
                  {formatAmount(parseAmount(breakdown[field as keyof typeof breakdown]), currency)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {checks.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <h3 className="mb-1 text-xs font-semibold text-slate-700">
            Conferência das fórmulas da documentação
          </h3>
          <ul className="space-y-1 text-xs">
            {checks.map((check) => (
              <li
                key={check.label}
                className={check.matches ? "text-emerald-700" : "text-amber-800"}
              >
                {check.matches ? "✓" : "⚠️"} {check.label}
                {!check.matches && (
                  <span className="ml-1 text-amber-700">
                    — calculado {formatAmount(check.expected, currency)}, retornado{" "}
                    {formatAmount(check.returned, currency)}. Confira o JSON bruto antes de lançar
                    o valor.
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/**
 * Paginação — o ponto onde este endpoint difere dos outros da aplicação.
 *
 * `page_token` vai na QUERY e por isso é assinado junto. Não dá para
 * "avançar página" aqui: cada página é uma URL nova que precisa passar
 * pelo sistema interno de assinatura. O que a tela pode fazer — e faz — é
 * entregar o caminho da próxima página pronto para assinar, já com o
 * mesmo page_size e sort_order desta consulta.
 */
function NextPageCard({
  data,
  query,
}: {
  data: StatementTransactionsData;
  query: StatementPageQuery;
}) {
  const token = data.next_page_token;
  const statementId = data.id ?? query.statementId;

  const nextPath = useMemo(() => {
    if (token === undefined || token === "" || statementId === "") return null;
    const result = buildStatementEndpoint(statementId, {
      pageSize: query.pageSize,
      sortOrder: query.sortOrder,
      pageToken: token,
    });
    return result.ok ? result.path : null;
  }, [token, statementId, query.pageSize, query.sortOrder]);

  if (token === undefined || token === "") {
    return (
      <Card title="Paginação">
        <p className="text-xs text-slate-500">
          A resposta não trouxe <code className="rounded bg-slate-100 px-1">next_page_token</code> —
          esta é a última página do extrato.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Próxima página">
      <p className="text-xs text-slate-600">
        Ainda há transações. O <code className="rounded bg-slate-100 px-1">page_token</code> faz
        parte da query e é assinado junto, então a próxima página exige uma{" "}
        <strong>nova assinatura</strong> — não é possível avançar direto daqui.
      </p>
      {nextPath !== null ? (
        <>
          <div className="mt-2 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
            <code className="flex-1 select-all break-all font-mono text-[11px] text-slate-800">
              {nextPath}
            </code>
            <CopyButton text={nextPath} label="Copiar" />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Envie este caminho ao sistema interno de assinatura e cole a URL assinada no passo 2.
            O page_token vai literal, como veio na resposta — reescrevê-lo (ou codificar o{" "}
            <code className="rounded bg-slate-100 px-1">+</code> e a{" "}
            <code className="rounded bg-slate-100 px-1">/</code>) muda a string assinada e devolve
            106001.
          </p>
        </>
      ) : (
        <div className="mt-2 flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
          <code className="flex-1 select-all break-all font-mono text-[11px] text-slate-800">
            {token}
          </code>
          <CopyButton text={token} label="Copiar token" />
        </div>
      )}
    </Card>
  );
}

function TypeTotalsCard({
  transactions,
  currency,
}: {
  transactions: StatementTransaction[];
  currency: string | undefined;
}) {
  const totals = useMemo(() => totalsByType(transactions), [transactions]);
  if (totals.length === 0) return null;

  return (
    <Card title="Totais por tipo de transação (nesta página)">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
            <th className="py-1.5 pr-3 font-medium">Tipo</th>
            <th className="py-1.5 pr-3 text-right font-medium">Qtd</th>
            <th className="py-1.5 pr-3 text-right font-medium">Repasse</th>
            <th className="py-1.5 pr-3 text-right font-medium">Ajustes</th>
            <th className="py-1.5 text-right font-medium">Reserva</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((total) => (
            <tr key={total.type} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 pr-3 text-slate-800">
                {labelForType(total.type)}
                <span className="ml-1 font-mono text-[10px] text-slate-400">{total.type}</span>
              </td>
              <td className="py-1.5 pr-3 text-right text-slate-800">{total.count}</td>
              <td className="py-1.5 pr-3 text-right font-medium text-slate-800">
                {formatAmount(total.settlement, currency)}
              </td>
              <td className="py-1.5 pr-3 text-right text-slate-600">
                {formatAmount(total.adjustment, currency)}
              </td>
              <td className="py-1.5 text-right text-slate-600">
                {formatAmount(total.reserve, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function TransactionsCard({
  transactions,
  currency,
}: {
  transactions: StatementTransaction[];
  currency: string | undefined;
}) {
  if (transactions.length === 0) {
    return (
      <Card title="Transações">
        <p className="text-xs text-slate-400">A resposta não trouxe nenhuma transação.</p>
      </Card>
    );
  }

  return (
    <Card
      title={`Transações (${transactions.length})`}
      actions={
        <CopyButton text={transactionsTsv(transactions)} label="Copiar para planilha" />
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
              <th className="py-1.5 pr-2 font-medium">Tipo</th>
              <th className="py-1.5 pr-2 font-medium">Pedido / ajuste</th>
              <th className="py-1.5 pr-2 font-medium">Data do pedido</th>
              <th className="py-1.5 pr-2 text-right font-medium">Receita</th>
              <th className="py-1.5 pr-2 text-right font-medium">Frete</th>
              <th className="py-1.5 pr-2 text-right font-medium">Taxas/impostos</th>
              <th className="py-1.5 pr-2 text-right font-medium">Repasse</th>
              <th className="py-1.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} currency={currency} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Valores negativos são custos descontados do repasse. Abra uma linha para ver o
        detalhamento — só os campos diferentes de zero aparecem.
      </p>
    </Card>
  );
}

function TransactionRow({
  tx,
  currency,
}: {
  tx: StatementTransaction;
  currency: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const reference = tx.order_id ?? tx.adjustment_order_id ?? tx.associated_order_id;

  return (
    <>
      <tr className="border-b border-slate-100">
        <td className="py-1.5 pr-2 text-slate-800">
          {labelForType(tx.type)}
          {tx.reserve_status !== undefined && tx.reserve_status !== "" && (
            <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] uppercase text-slate-500">
              {tx.reserve_status}
            </span>
          )}
        </td>
        <td className="select-all py-1.5 pr-2 font-mono text-slate-600">
          {reference ?? tx.adjustment_id ?? "—"}
        </td>
        <td className="py-1.5 pr-2 text-slate-600">{formatEpochDateBR(tx.order_create_time)}</td>
        <td className="py-1.5 pr-2 text-right text-slate-800">
          {formatAmount(parseAmount(tx.revenue_amount), currency)}
        </td>
        <td className="py-1.5 pr-2 text-right text-slate-800">
          {formatAmount(parseAmount(tx.shipping_cost_amount), currency)}
        </td>
        <td className="py-1.5 pr-2 text-right text-slate-800">
          {formatAmount(parseAmount(tx.fee_tax_amount), currency)}
        </td>
        <td className="py-1.5 pr-2 text-right font-semibold text-slate-900">
          {formatAmount(parseAmount(tx.settlement_amount), currency)}
        </td>
        <td className="py-1.5 text-right">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
          >
            {open ? "Fechar" : "Detalhar"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={8} className="px-2 py-3">
            <TransactionDetail tx={tx} currency={currency} />
          </td>
        </tr>
      )}
    </>
  );
}

function TransactionDetail({
  tx,
  currency,
}: {
  tx: StatementTransaction;
  currency: string | undefined;
}) {
  const shipping = tx.shipping_cost_breakdown;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
        <Field label="ID da transação" value={tx.id} mono />
        <Field label="ID do pedido" value={tx.order_id} mono />
        <Field label="ID do ajuste" value={tx.adjustment_id} mono />
        <Field
          label="Ajuste"
          value={formatAmount(parseAmount(tx.adjustment_amount), currency)}
        />
        {tx.reserve_id !== undefined && (
          <>
            <Field label="ID da reserva" value={tx.reserve_id} mono />
            <Field
              label="Valor da reserva"
              value={formatAmount(parseAmount(tx.reserve_amount), currency)}
            />
            <Field
              label="Liberação prevista"
              value={formatEpochDateBR(Number(tx.estimated_release_time) || undefined)}
            />
          </>
        )}
      </dl>

      <BreakdownList
        title="Receita"
        total={parseAmount(tx.revenue_amount)}
        entries={nonZeroEntries(tx.revenue_breakdown, REVENUE_LABELS)}
        zeros={zeroFieldCount(tx.revenue_breakdown)}
        currency={currency}
      />
      <BreakdownList
        title="Custo de frete"
        total={parseAmount(tx.shipping_cost_amount)}
        entries={nonZeroEntries(shipping, SHIPPING_LABELS)}
        zeros={zeroFieldCount(shipping)}
        currency={currency}
      />
      <BreakdownList
        title="Frete — componentes de referência"
        note="Não somam no custo de frete; servem para entender como ele foi formado."
        entries={nonZeroEntries(shipping?.supplementary_component, SHIPPING_SUPPLEMENTARY_LABELS)}
        zeros={zeroFieldCount(shipping?.supplementary_component)}
        currency={currency}
      />
      <BreakdownList
        title="Tarifas"
        entries={nonZeroEntries(tx.fee_tax_breakdown?.fee, FEE_TAX_LABELS)}
        zeros={zeroFieldCount(tx.fee_tax_breakdown?.fee)}
        currency={currency}
      />
      <BreakdownList
        title="Impostos"
        entries={nonZeroEntries(tx.fee_tax_breakdown?.tax, FEE_TAX_LABELS)}
        zeros={zeroFieldCount(tx.fee_tax_breakdown?.tax)}
        currency={currency}
      />
      <BreakdownList
        title="Valores de referência da transação"
        note="Não entram no cálculo do repasse."
        entries={nonZeroEntries(tx.supplementary_component, TRANSACTION_SUPPLEMENTARY_LABELS)}
        zeros={zeroFieldCount(tx.supplementary_component)}
        currency={currency}
      />
    </div>
  );
}

/**
 * Lista de um detalhamento. Só mostra o que é diferente de zero e informa
 * quantos campos zerados foram omitidos — sem isso a tela viraria uma
 * parede de "0,00" e esconderia as linhas que importam.
 */
function BreakdownList({
  title,
  note,
  total,
  entries,
  zeros,
  currency,
}: {
  title: string;
  note?: string;
  total?: number | null;
  entries: AmountEntry[];
  zeros: number;
  currency: string | undefined;
}) {
  if (entries.length === 0 && zeros === 0) return null;

  return (
    <div>
      <h4 className="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>{title}</span>
        {total !== undefined && total !== null && (
          <span className="font-mono text-xs font-semibold normal-case tracking-normal text-slate-800">
            {formatAmount(total, currency)}
          </span>
        )}
      </h4>
      {note !== undefined && <p className="text-[11px] text-slate-400">{note}</p>}
      {entries.length === 0 ? (
        <p className="text-[11px] text-slate-400">Todos os {zeros} campos vieram zerados.</p>
      ) : (
        <dl className="mt-0.5 space-y-0.5 text-xs">
          {entries.map((entry) => (
            <div key={entry.field} className="flex justify-between gap-2">
              <dt className="text-slate-600" title={entry.field}>
                {entry.label}
              </dt>
              <dd
                className={`shrink-0 font-medium ${entry.value < 0 ? "text-red-700" : "text-slate-800"}`}
              >
                {formatAmount(entry.value, currency)}
              </dd>
            </div>
          ))}
          {zeros > 0 && (
            <p className="pt-0.5 text-[11px] text-slate-400">
              + {zeros} campo(s) zerado(s) omitido(s).
            </p>
          )}
        </dl>
      )}
    </div>
  );
}

function Highlight({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded border px-3 py-2 ${strong === true ? "border-slate-300 bg-slate-50" : "border-slate-200"}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`font-mono ${strong === true ? "text-base font-bold text-slate-900" : "text-sm text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | undefined; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`text-slate-800 ${mono === true ? "select-all font-mono" : ""}`}>
        {value !== undefined && value !== "" ? value : "—"}
      </dd>
    </div>
  );
}
