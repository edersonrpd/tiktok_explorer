import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Landmark,
  Search,
} from "lucide-react";
import type { StatementTransaction, StatementTransactionsData } from "../types/tiktok";
import { buildStatementEndpoint, type StatementSortOrder } from "../lib/endpoint";
import { TIKTOK_API_HOST } from "../lib/signedUrl";
import {
  checkStatementFormulas,
  nonZeroEntries,
  statementFileName,
  totalsByType,
  transactionsCsv,
  transactionsTsv,
  transactionsXlsx,
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
import { addMoney, formatMoney, parseMoney } from "../lib/money";
import {
  Card,
  CopyButton,
  DownloadButton,
  FilterChips,
  HelpNote,
  Tabs,
  type ChipOption,
  type TabSpec,
} from "./ui";
import { BreakdownBlock, CompositionBar, FeeTaxBlock, Field, Highlight } from "./breakdown";

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
  const totals = useMemo(() => totalsByType(transactions), [transactions]);
  const checks = useMemo(() => checkStatementFormulas(data), [data]);
  const hasNextPage = data.next_page_token !== undefined && data.next_page_token !== "";

  const tabs: TabSpec[] = [
    {
      id: "transactions",
      label: "Transações",
      badge: transactions.length,
      content: (
        <TransactionsPanel
          transactions={transactions}
          currency={data.currency}
          statementId={data.id ?? query.statementId}
        />
      ),
    },
  ];
  if (totals.length > 0) {
    tabs.push({
      id: "types",
      label: "Totais por tipo",
      badge: totals.length,
      content: <TypeTotalsPanel totals={totals} currency={data.currency} />,
    });
  }
  if (checks.length > 0) {
    tabs.push({
      id: "checks",
      label: "Conferências",
      badge: checks.some((c) => !c.matches) ? "atenção" : undefined,
      badgeTone: "warn",
      content: <ChecksPanel checks={checks} currency={data.currency} />,
    });
  }
  tabs.push({
    id: "pagination",
    label: "Paginação",
    badge: hasNextPage ? "há mais" : "última",
    content: <NextPagePanel data={data} query={query} />,
  });

  return (
    <>
      <StatementSummary data={data} transactions={transactions} />
      <Tabs label="Seções do extrato" tabs={tabs} />
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
        <CompositionBar
          title="Composição do total repassado"
          note="extrato inteiro"
          currency={currency}
          segments={[
            {
              label: "Repasse",
              value: parseMoney(data.total_settlement_amount),
              tone: "ink",
            },
            {
              label: STATEMENT_TOTAL_LABELS.total_shipping_cost_amount ?? "Custo de frete",
              value: parseMoney(breakdown.total_shipping_cost_amount),
              tone: "accent",
            },
            {
              label: STATEMENT_TOTAL_LABELS.total_fee_tax_amount ?? "Taxas e impostos",
              value: parseMoney(breakdown.total_fee_tax_amount),
              tone: "amber",
            },
            {
              label: STATEMENT_TOTAL_LABELS.total_adjustment_amount ?? "Ajustes",
              value: parseMoney(breakdown.total_adjustment_amount),
              tone: "gray",
            },
          ]}
        />
      )}
      {breakdown !== undefined && (
        <p className="mt-1.5 text-[11px] t-4">
          Receita do extrato:{" "}
          <strong className="t-2">
            {formatMoney(parseMoney(breakdown.total_revenue_amount), currency)}
          </strong>
        </p>
      )}
    </Card>
  );
}

function ChecksPanel({
  checks,
  currency,
}: {
  checks: ReturnType<typeof checkStatementFormulas>;
  currency: string | undefined;
}) {
  return (
    <div>
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
                  {formatMoney(check.returned, currency)}. Confira o JSON bruto antes de lançar o
                  valor.
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
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
function NextPagePanel({
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
      <p className="text-xs t-3">
        A resposta não trouxe <code>next_page_token</code> — esta é a última página do extrato.
      </p>
    );
  }

  return (
    <div>
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
    </div>
  );
}

function TypeTotalsPanel({
  totals,
  currency,
}: {
  totals: ReturnType<typeof totalsByType>;
  currency: string | undefined;
}) {
  return (
    <div>
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
    </div>
  );
}

function TransactionsPanel({
  transactions,
  currency,
  statementId,
}: {
  transactions: StatementTransaction[];
  currency: string | undefined;
  statementId: string;
}) {
  const [filter, setFilter] = useState("");
  const [chip, setChip] = useState("all");

  const chips = useMemo((): ChipOption[] => {
    const byType = new Map<string, number>();
    for (const tx of transactions) {
      const type = tx.type ?? "";
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }
    const options: ChipOption[] = [{ id: "all", label: "Todas", count: transactions.length }];
    if (byType.size > 1) {
      for (const [type, count] of byType) options.push({ id: type, label: labelForType(type), count });
    }
    return options;
  }, [transactions]);

  const visible = useMemo(() => {
    // Mesma regra da busca das transações a liquidar: vários termos
    // separados por espaço/vírgula, basta um casar.
    const terms = filter
      .toLowerCase()
      .split(/[\s,;]+/)
      .filter((term) => term !== "");
    return transactions.filter((tx) => {
      if (chip !== "all" && (tx.type ?? "") !== chip) return false;
      if (terms.length === 0) return true;
      const haystack = [
        tx.id,
        tx.order_id,
        tx.adjustment_id,
        tx.adjustment_order_id,
        tx.associated_order_id,
        tx.type,
      ]
        .filter((value): value is string => value !== undefined && value !== "")
        .join(" ")
        .toLowerCase();
      return terms.some((term) => haystack.includes(term));
    });
  }, [transactions, filter, chip]);

  const sums = useMemo(() => {
    const sum = (pick: (tx: StatementTransaction) => string | undefined) =>
      addMoney(...visible.map((tx) => parseMoney(pick(tx))));
    return {
      revenue: sum((tx) => tx.revenue_amount),
      shipping: sum((tx) => tx.shipping_cost_amount),
      feeTax: sum((tx) => tx.fee_tax_amount),
      settlement: sum((tx) => tx.settlement_amount),
    };
  }, [visible]);
  const filtering = filter.trim() !== "" || chip !== "all";

  if (transactions.length === 0) {
    return <p className="text-xs t-4">A resposta não trouxe nenhuma transação.</p>;
  }

  return (
    <div>
      <div className="panel-toolbar">
        <div className="search-field">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <input
            aria-label="Procurar pedido nesta página do extrato"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            spellCheck={false}
            placeholder="Procurar pedido — um ou vários, separados por vírgula"
            className="inp font-mono"
          />
        </div>
        {/* Exporta o que está na tela, como nas transações a liquidar. */}
        <div className="flex items-center gap-2">
          <DownloadButton
            build={() => transactionsXlsx(visible)}
            filename={statementFileName(statementId, "xlsx")}
            mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            label="Excel"
          />
          <DownloadButton
            build={() => transactionsCsv(visible)}
            filename={statementFileName(statementId, "csv")}
            label="CSV"
          />
          <CopyButton text={transactionsTsv(visible)} label="Copiar" />
        </div>
      </div>

      {chips.length > 1 && (
        <div className="mb-3">
          <FilterChips label="Filtrar transações" options={chips} value={chip} onChange={setChip} />
        </div>
      )}

      {filtering && (
        <p className="mb-2 text-[11px] t-3">
          {visible.length} de {transactions.length} transação(ões) desta página — a exportação leva
          só estas.
        </p>
      )}

      {visible.length === 0 ? (
        <p className="alert mt-1 px-3 py-2 text-xs t-2">
          Nenhuma transação desta página casa com a busca.
        </p>
      ) : (
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
              {visible.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} currency={currency} />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>{filtering ? "Total do filtro" : "Total desta página"}</td>
                <td className="text-right">{formatMoney(sums.revenue, currency)}</td>
                <td className="text-right">{formatMoney(sums.shipping, currency)}</td>
                <td className="text-right">{formatMoney(sums.feeTax, currency)}</td>
                <td className="text-right">{formatMoney(sums.settlement, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <HelpNote>
        <p>
          Valores negativos são custos descontados do repasse. Abra uma linha para ver o
          detalhamento — só os campos diferentes de zero aparecem.
        </p>
      </HelpNote>
    </div>
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
