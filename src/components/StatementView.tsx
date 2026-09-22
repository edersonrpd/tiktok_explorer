import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Landmark,
  Layers,
} from "lucide-react";
import type { StatementTransaction, StatementTransactionsData } from "../types/tiktok";
import { buildStatementEndpoint, type StatementSortOrder } from "../lib/endpoint";
import { TIKTOK_API_HOST } from "../lib/signedUrl";
import {
  checkStatementFormulas,
  nonZeroEntries,
  totalsByType,
  transactionsTsv,
  hiddenFieldCount,
} from "../lib/statements";
import {
  FEE_TAX_LABELS,
  labelForType,
  labelFrom,
  REVENUE_LABELS,
  SHIPPING_LABELS,
  SHIPPING_SUPPLEMENTARY_LABELS,
  STATEMENT_TOTAL_LABELS,
  TRANSACTION_SUPPLEMENTARY_LABELS,
} from "../lib/statementLabels";
import { formatEpochBR, formatEpochDateBR } from "../lib/format";
import { formatMoney, parseMoney } from "../lib/money";
import { Card, CopyButton } from "./ui";
import { BreakdownBlock, FeeTaxBlock, Field, Highlight } from "./breakdown";

/** Parâmetros da consulta que gerou esta página, para montar a próxima. */
export interface StatementPageQuery {
  statementId: string;
  pageSize: number | undefined;
  sortOrder: StatementSortOrder | undefined;
}

const revenueLabel = labelFrom(REVENUE_LABELS);
const shippingLabel = labelFrom(SHIPPING_LABELS);
const shippingSupplementaryLabel = labelFrom(SHIPPING_SUPPLEMENTARY_LABELS);
const feeTaxLabel = labelFrom(FEE_TAX_LABELS);
const supplementaryLabel = labelFrom(TRANSACTION_SUPPLEMENTARY_LABELS);

/**
 * Exibição de GET /finance/202501/statements/{id}/statement_transactions.
 *
 * O extrato é o que o financeiro concilia: o topo mostra os totais do
 * repasse e o detalhamento por transação fica sob demanda, porque a API
 * devolve ~70 campos por transação e quase todos vêm zerados.
 *
 * Diferença para a tela de transações por PEDIDO (TransactionView): lá
 * cada linha é um SKU; aqui cada linha é um pedido, um ajuste ou uma
 * movimentação de reserva do repasse inteiro.
 */
export function StatementView({
  data,
  query,
}: {
  data: StatementTransactionsData;
  query: StatementPageQuery;
}) {
  const transactions = data.transactions ?? [];

  return (
    <>
      <StatementSummary data={data} transactions={transactions} />
      <NextPageCard data={data} query={query} />
      <TypeTotalsCard transactions={transactions} currency={data.currency} />
      <TransactionsCard transactions={transactions} currency={data.currency} />
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
      icon={<Landmark />}
      count={data.total_count}
      actions={<span className="badge green">{data.status ?? "—"}</span>}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Highlight
          label="Valor a pagar"
          value={formatMoney(parseMoney(data.payable_amount), currency)}
          strong
        />
        <Highlight
          label="Total repassado"
          value={formatMoney(parseMoney(data.total_settlement_amount), currency)}
        />
        <Highlight
          label="Reserva (retida/liberada)"
          value={formatMoney(parseMoney(data.total_reserve_amount), currency)}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
        <Field label="Gerado em" value={formatEpochBR(data.create_time)} />
        <Field label="Moeda" value={currency} />
        <Field
          label="Transações no extrato"
          value={data.total_count !== undefined ? String(data.total_count) : undefined}
        />
        <Field label="Nesta página" value={String(transactions.length)} />
      </dl>

      {breakdown !== undefined && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-xs font-bold t-2">Composição do total repassado</h3>
          <dl className="space-y-0.5 text-xs">
            {Object.entries(STATEMENT_TOTAL_LABELS).map(([field, label]) => (
              <div key={field} className="flex justify-between gap-2">
                <dt className="t-4">{label}</dt>
                <dd className="font-medium t-1">
                  {formatMoney(parseMoney(breakdown[field as keyof typeof breakdown]), currency)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {checks.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-xs font-bold t-2">Conferência das fórmulas da documentação</h3>
          <ul className="space-y-1 text-xs">
            {checks.map((check) => (
              <li key={check.label} className="flex items-start gap-1.5">
                {check.matches ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                )}
                <span className={check.matches ? "t-3" : "t-2"}>
                  {check.label}
                  {!check.matches && (
                    <span className="text-amber-700">
                      {" "}
                      — calculado {formatMoney(check.expected, currency)}, retornado{" "}
                      {formatMoney(check.returned, currency)}. Confira o JSON bruto antes de lançar
                      o valor.
                    </span>
                  )}
                </span>
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

  // URL completa, como no passo 1: é o formato que o sistema interno de
  // assinatura recebe.
  const nextUrl = useMemo(() => {
    if (token === undefined || token === "" || statementId === "") return null;
    const result = buildStatementEndpoint(statementId, {
      pageSize: query.pageSize,
      sortOrder: query.sortOrder,
      pageToken: token,
    });
    return result.ok ? `${TIKTOK_API_HOST}${result.path}` : null;
  }, [token, statementId, query.pageSize, query.sortOrder]);

  if (token === undefined || token === "") {
    return (
      <Card title="Paginação" icon={<Layers />}>
        <p className="text-xs t-3">
          A resposta não trouxe <code>next_page_token</code> — esta é a última página do extrato.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Próxima página" icon={<Layers />}>
      <p className="text-xs t-3">
        Ainda há transações. O <code>page_token</code> faz parte da query e é assinado junto, então
        a próxima página exige uma <strong className="t-1">nova assinatura</strong> — não é possível
        avançar direto daqui.
      </p>
      {nextUrl !== null ? (
        <>
          <div className="mt-2 flex items-center gap-2 panel-success px-3 py-2">
            <code className="flex-1 select-all break-all font-mono text-[11px] t-1">{nextUrl}</code>
            <CopyButton text={nextUrl} label="Copiar" />
          </div>
          <p className="mt-1.5 text-[11px] t-4">
            Envie esta URL ao sistema interno de assinatura e cole a URL assinada no passo 2. O
            page_token vai literal, como veio na resposta — reescrevê-lo (ou codificar o{" "}
            <code>+</code> e a <code>/</code>) muda a string assinada e devolve 106001.
          </p>
        </>
      ) : (
        <div className="mt-2 flex items-center gap-2 panel px-3 py-2">
          <code className="flex-1 select-all break-all font-mono text-[11px] t-1">{token}</code>
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
    <Card title="Totais por tipo de transação" icon={<Layers />} count={totals.length}>
      <div className="overflow-x-auto">
        <table className="tbl text-xs">
          <thead>
            <tr>
              <th>Tipo</th>
              <th className="text-right">Qtd</th>
              <th className="text-right">Repasse</th>
              <th className="text-right">Ajustes</th>
              <th className="text-right">Reserva</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((total) => (
              <tr key={total.type}>
                <td className="t-1">
                  {labelForType(total.type)}
                  <span className="ml-1.5 font-mono text-[10px] t-4">{total.type}</span>
                </td>
                <td className="text-right t-1">{total.count}</td>
                <td className="text-right font-semibold t-1">
                  {formatMoney(total.settlement, currency)}
                </td>
                <td className="text-right t-3">{formatMoney(total.adjustment, currency)}</td>
                <td className="text-right t-3">{formatMoney(total.reserve, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] t-4">Somas desta página, não do extrato inteiro.</p>
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
      <Card title="Transações" icon={<FileSpreadsheet />}>
        <p className="text-xs t-4">A resposta não trouxe nenhuma transação.</p>
      </Card>
    );
  }

  return (
    <Card
      title="Transações"
      icon={<FileSpreadsheet />}
      count={transactions.length}
      actions={<CopyButton text={transactionsTsv(transactions)} label="Copiar para planilha" />}
    >
      <div className="overflow-x-auto">
        <table className="tbl text-xs">
          <thead>
            <tr>
              <th />
              <th>Tipo</th>
              <th>Pedido / ajuste</th>
              <th>Data do pedido</th>
              <th className="text-right">Receita</th>
              <th className="text-right">Frete</th>
              <th className="text-right">Taxas/impostos</th>
              <th className="text-right">Repasse</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} currency={currency} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] t-4">
        Valores negativos são custos descontados do repasse. Abra uma linha para ver o detalhamento
        — só os campos diferentes de zero aparecem.
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
    <Fragment>
      <tr>
        <td className="w-6">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Fechar detalhamento" : "Detalhar transação"}
            className="copy-btn"
          >
            {open ? <ChevronDown /> : <ChevronRight />}
          </button>
        </td>
        <td className="t-1">
          {labelForType(tx.type)}
          {tx.reserve_status !== undefined && tx.reserve_status !== "" && (
            <span className="badge gray ml-1.5">{tx.reserve_status}</span>
          )}
        </td>
        <td className="select-all font-mono t-3">{reference ?? tx.adjustment_id ?? "—"}</td>
        <td className="t-3">{formatEpochDateBR(tx.order_create_time)}</td>
        <td className="text-right t-1">{formatMoney(parseMoney(tx.revenue_amount), currency)}</td>
        <td className="text-right t-1">
          {formatMoney(parseMoney(tx.shipping_cost_amount), currency)}
        </td>
        <td className="text-right t-1">{formatMoney(parseMoney(tx.fee_tax_amount), currency)}</td>
        <td className="text-right font-semibold t-1">
          {formatMoney(parseMoney(tx.settlement_amount), currency)}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="bg-[var(--surface2)] p-0">
            <TransactionDetail tx={tx} currency={currency} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function TransactionDetail({
  tx,
  currency,
}: {
  tx: StatementTransaction;
  currency: string | undefined;
}) {
  const { supplementary_component: shippingSupplement, ...shipping } =
    tx.shipping_cost_breakdown ?? {};

  return (
    <div className="space-y-4 px-4 py-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
        <Field label="ID da transação" value={tx.id} mono />
        <Field label="ID do pedido" value={tx.order_id} mono />
        <Field label="ID do ajuste" value={tx.adjustment_id} mono />
        <Field label="Ajuste" value={formatMoney(parseMoney(tx.adjustment_amount), currency)} />
        {tx.reserve_id !== undefined && (
          <>
            <Field label="ID da reserva" value={tx.reserve_id} mono />
            <Field
              label="Valor da reserva"
              value={formatMoney(parseMoney(tx.reserve_amount), currency)}
            />
            <Field
              label="Liberação prevista"
              value={formatEpochDateBR(Number(tx.estimated_release_time) || undefined)}
            />
          </>
        )}
      </dl>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BreakdownBlock
          title="Receita"
          total={parseMoney(tx.revenue_amount)}
          entries={nonZeroEntries(tx.revenue_breakdown, revenueLabel)}
          zeros={hiddenFieldCount(tx.revenue_breakdown)}
          currency={currency}
        />
        <BreakdownBlock
          title="Custo de frete"
          total={parseMoney(tx.shipping_cost_amount)}
          entries={nonZeroEntries(shipping, shippingLabel)}
          zeros={hiddenFieldCount(shipping)}
          currency={currency}
          extra={
            <BreakdownBlock
              title="Frete — componentes de referência"
              note="Não somam no custo de frete."
              entries={nonZeroEntries(shippingSupplement, shippingSupplementaryLabel)}
              zeros={hiddenFieldCount(shippingSupplement)}
              currency={currency}
            />
          }
        />
        <div className="space-y-4">
          <FeeTaxBlock
            title="Tarifas e impostos"
            breakdown={tx.fee_tax_breakdown}
            total={parseMoney(tx.fee_tax_amount)}
            totalField="fee_tax_amount"
            currency={currency}
            labelFor={feeTaxLabel}
          />
          <BreakdownBlock
            title="Valores de referência"
            note="Não entram no cálculo do repasse."
            entries={nonZeroEntries(tx.supplementary_component, supplementaryLabel)}
            zeros={hiddenFieldCount(tx.supplementary_component)}
            currency={currency}
          />
        </div>
      </div>
    </div>
  );
}
