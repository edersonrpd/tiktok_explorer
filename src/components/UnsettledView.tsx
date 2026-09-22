import { Fragment, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Hourglass,
  Layers,
  Search,
} from "lucide-react";
import type { UnsettledTransaction, UnsettledTransactionsData } from "../types/tiktok";
import { buildUnsettledEndpoint, type StatementSortOrder } from "../lib/endpoint";
import { TIKTOK_API_HOST } from "../lib/signedUrl";
import { hiddenFieldCount, nonZeroEntries } from "../lib/statements";
import {
  canCompareSums,
  checkSums,
  filterTransactions,
  isDelivered,
  pageSums,
  parseEstimatedSettlement,
  singleCurrency,
  summarizeFormulas,
  unsettledCsv,
  unsettledFileName,
  unsettledTotalsByType,
  unsettledTsv,
} from "../lib/unsettled";
import {
  FEE_TAX_LABELS,
  labelForType,
  labelFrom,
  REVENUE_LABELS,
  SHIPPING_LABELS,
  SHIPPING_SUPPLEMENTARY_LABELS,
} from "../lib/statementLabels";
import { formatEpochBR, formatEpochDateBR } from "../lib/format";
import { formatMoney, parseMoney } from "../lib/money";
import { Card, CopyButton, DownloadButton } from "./ui";
import { BreakdownBlock, FeeTaxBlock, Field, Highlight } from "./breakdown";

/**
 * Parâmetros da consulta que gerou esta página, para montar a próxima.
 *
 * A janela de datas entra junto de propósito: paginar com um filtro
 * diferente do da primeira página devolveria um recorte incoerente, e o
 * `page_token` foi emitido para ESTA janela.
 */
export interface UnsettledPageQuery {
  pageSize: number | undefined;
  sortOrder: StatementSortOrder | undefined;
  searchTimeGe: number | undefined;
  searchTimeLt: number | undefined;
}

const revenueLabel = labelFrom(REVENUE_LABELS);
const shippingLabel = labelFrom(SHIPPING_LABELS);
const shippingSupplementaryLabel = labelFrom(SHIPPING_SUPPLEMENTARY_LABELS);
const feeTaxLabel = labelFrom(FEE_TAX_LABELS);

/**
 * Exibição de GET /finance/202507/orders/unsettled.
 *
 * Esta tela responde a pergunta que o extrato não responde: quanto ainda
 * está para entrar. Todo valor é ESTIMATIVA — o repasse não foi fechado —
 * e a tela repete isso onde o número aparece, porque a diferença entre
 * "estimado" e "realizado" é exatamente o que não pode ser lançado errado
 * na contabilidade.
 *
 * Diferença para a tela de extrato (StatementView): lá cada linha já
 * entrou num repasse fechado, com data e valor definitivos; aqui cada
 * linha é um pedido ou ajuste que ainda vai ser liquidado, e o frete
 * pode mudar até a entrega.
 */
export function UnsettledView({
  data,
  query,
}: {
  data: UnsettledTransactionsData;
  query: UnsettledPageQuery;
}) {
  const transactions = data.transactions ?? [];
  // A moeda vem por transação neste endpoint; os somatórios do cabeçalho
  // não têm moeda nenhuma para se apoiar.
  const currency = useMemo(() => singleCurrency(transactions), [transactions]);

  return (
    <>
      <UnsettledSummary data={data} transactions={transactions} currency={currency} />
      <NextPageCard data={data} query={query} />
      <TypeTotalsCard transactions={transactions} currency={currency} />
      <TransactionsCard transactions={transactions} currency={currency} />
    </>
  );
}

function UnsettledSummary({
  data,
  transactions,
  currency,
}: {
  data: UnsettledTransactionsData;
  transactions: UnsettledTransaction[];
  currency: string | undefined;
}) {
  const sums = useMemo(() => pageSums(transactions), [transactions]);
  const formulas = useMemo(() => summarizeFormulas(transactions), [transactions]);
  const comparable = canCompareSums(data, transactions);
  const sumChecks = useMemo(
    () => (comparable ? checkSums(data, transactions) : []),
    [comparable, data, transactions],
  );
  const mixedCurrency = currency === undefined && transactions.length > 0;

  return (
    <Card
      title="Transações a liquidar"
      icon={<Hourglass />}
      count={data.total_count}
      actions={<span className="badge gray">UNSETTLED</span>}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Highlight
          label="Repasse estimado"
          value={formatMoney(parseMoney(data.sum_est_settlement_amount), currency)}
          strong
        />
        <Highlight
          label="Receita estimada"
          value={formatMoney(parseMoney(data.sum_est_revenue_amount), currency)}
        />
        <Highlight
          label="Taxas e impostos estimados"
          value={formatMoney(parseMoney(data.sum_est_fee_amount), currency)}
        />
        <Highlight
          label="Ajustes estimados"
          value={formatMoney(parseMoney(data.sum_est_adjustment_amount), currency)}
        />
      </div>

      <p className="mt-2 text-[11px] t-4">
        Os quatro somatórios acima são do <strong className="t-2">conjunto filtrado inteiro</strong>,
        não desta página. A resposta não traz somatório de frete — o valor estimado de frete só
        pode ser somado das transações exibidas:{" "}
        <strong className="t-2">{formatMoney(sums.shipping, currency)}</strong> nesta página.
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
        <Field
          label="Transações pendentes"
          value={data.total_count !== undefined ? String(data.total_count) : undefined}
        />
        <Field label="Nesta página" value={String(transactions.length)} />
        <Field label="Moeda" value={mixedCurrency ? "(mista)" : currency} />
        <Field
          label="Já entregues"
          value={`${transactions.filter(isDelivered).length} de ${transactions.length}`}
        />
      </dl>

      {mixedCurrency && (
        <p className="alert alert-error mt-2 px-3 py-2 text-xs t-2">
          As transações desta página estão em moedas diferentes. Os valores aparecem sem símbolo, e
          somar linhas de moedas distintas não produz um total válido.
        </p>
      )}

      <div className="mt-4">
        <h3 className="mb-1.5 text-xs font-bold t-2">Conferência da fórmula da documentação</h3>
        <CheckLine
          ok={formulas.checked > 0 && formulas.diverging.length === 0}
          neutral={formulas.checked === 0}
        >
          receita − frete − taxas/impostos − ajustes = repasse estimado
          {formulas.checked === 0 ? (
            <span className="t-4">
              {" "}
              — nenhuma transação desta página trouxe <code>est_settlement_amount</code> para
              conferir.
            </span>
          ) : (
            <span className="t-4">
              {" "}
              — fecha em {formulas.matching} de {formulas.checked} transação(ões) conferida(s).
            </span>
          )}
        </CheckLine>
        {formulas.diverging.length > 0 && (
          <ul className="mt-1 space-y-0.5 pl-5 text-[11px] text-amber-700">
            {formulas.diverging.map(({ tx, check }) => (
              <li key={tx.id}>
                <span className="font-mono">{tx.order_id ?? tx.adjustment_id ?? tx.id}</span>:
                calculado {formatMoney(check.expected, currency)}, retornado{" "}
                {formatMoney(check.returned, currency)}.
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <h3 className="mb-1.5 text-xs font-bold t-2">
          Somatórios do cabeçalho × soma das transações
        </h3>
        {comparable ? (
          <ul className="space-y-1 text-xs">
            {sumChecks.map((check) => (
              <li key={check.field}>
                <CheckLine ok={check.matches}>
                  {check.label}
                  {!check.matches && (
                    <span className="text-amber-700">
                      {" "}
                      — cabeçalho {formatMoney(check.returned, currency)}, soma das transações{" "}
                      {formatMoney(check.fromPage, currency)}. Confira o JSON bruto antes de lançar
                      o valor.
                    </span>
                  )}
                </CheckLine>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs t-3">
            Não conferido: esta página não é o conjunto inteiro (há{" "}
            <code>next_page_token</code> ou <code>total_count</code> maior que o que veio). Somar as
            transações exibidas e comparar com o cabeçalho acusaria uma divergência que não existe.
          </p>
        )}
      </div>
    </Card>
  );
}

/** Uma linha de conferência com o ícone certo para o veredito. */
function CheckLine({
  ok,
  neutral,
  children,
}: {
  ok: boolean;
  neutral?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-start gap-1.5 text-xs">
      {neutral === true ? (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      ) : ok ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
      )}
      <span className={ok ? "t-3" : "t-2"}>{children}</span>
    </p>
  );
}

/**
 * Paginação — igual ao extrato: o `page_token` vai na query e é assinado
 * junto, então a próxima página é uma URL nova a assinar, não um botão.
 *
 * A janela de datas é repetida na URL da próxima página. Sem isso, a
 * segunda página traria um recorte diferente do da primeira e os totais
 * deixariam de fazer sentido entre si.
 */
function NextPageCard({
  data,
  query,
}: {
  data: UnsettledTransactionsData;
  query: UnsettledPageQuery;
}) {
  const token = data.next_page_token;

  const nextUrl = useMemo(() => {
    if (token === undefined || token === "") return null;
    const result = buildUnsettledEndpoint({
      pageSize: query.pageSize,
      sortOrder: query.sortOrder,
      searchTimeGe: query.searchTimeGe,
      searchTimeLt: query.searchTimeLt,
      pageToken: token,
    });
    return result.ok ? `${TIKTOK_API_HOST}${result.path}` : null;
  }, [token, query.pageSize, query.sortOrder, query.searchTimeGe, query.searchTimeLt]);

  if (token === undefined || token === "") {
    return (
      <Card title="Paginação" icon={<Layers />}>
        <p className="text-xs t-3">
          A resposta não trouxe <code>next_page_token</code> — esta é a última página do resultado.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Próxima página" icon={<Layers />}>
      <p className="text-xs t-3">
        Ainda há transações pendentes. O <code>page_token</code> faz parte da query e é assinado
        junto, então a próxima página exige uma <strong className="t-1">nova assinatura</strong> —
        não é possível avançar direto daqui.
      </p>
      {nextUrl !== null ? (
        <>
          <div className="panel-success mt-2 flex items-center gap-2 px-3 py-2">
            <code className="flex-1 select-all break-all font-mono text-[11px] t-1">{nextUrl}</code>
            <CopyButton text={nextUrl} label="Copiar" />
          </div>
          <p className="mt-1.5 text-[11px] t-4">
            A janela de datas desta consulta vai repetida na URL acima, de propósito: mudar o filtro
            no meio da paginação traria um recorte diferente do que gerou este token.
          </p>
        </>
      ) : (
        <div className="panel mt-2 flex items-center gap-2 px-3 py-2">
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
  transactions: UnsettledTransaction[];
  currency: string | undefined;
}) {
  const totals = useMemo(() => unsettledTotalsByType(transactions), [transactions]);
  if (totals.length === 0) return null;

  return (
    <Card title="Totais por tipo de transação" icon={<Layers />} count={totals.length}>
      <div className="overflow-x-auto">
        <table className="tbl text-xs">
          <thead>
            <tr>
              <th>Tipo</th>
              <th className="text-right">Qtd</th>
              <th className="text-right">Receita estimada</th>
              <th className="text-right">Ajustes estimados</th>
              <th className="text-right">Repasse estimado</th>
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
                <td className="text-right t-3">{formatMoney(total.revenue, currency)}</td>
                <td className="text-right t-3">{formatMoney(total.adjustment, currency)}</td>
                <td className="text-right font-semibold t-1">
                  {formatMoney(total.settlement, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] t-4">Somas desta página, não do conjunto inteiro.</p>
    </Card>
  );
}

function TransactionsCard({
  transactions,
  currency,
}: {
  transactions: UnsettledTransaction[];
  currency: string | undefined;
}) {
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => filterTransactions(transactions, filter), [transactions, filter]);
  const filtering = filter.trim() !== "";

  if (transactions.length === 0) {
    return (
      <Card title="Transações a liquidar" icon={<FileSpreadsheet />}>
        <p className="text-xs t-4">
          A resposta não trouxe nenhuma transação — nada pendente de liquidação na janela
          consultada.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Transações a liquidar"
      icon={<FileSpreadsheet />}
      count={visible.length}
      // Exporta o que está na tela: filtrou para conferir 3 pedidos, são
      // esses 3 que vão para a planilha.
      actions={
        <div className="flex items-center gap-2">
          <DownloadButton
            text={unsettledCsv(visible)}
            filename={unsettledFileName()}
            label="Baixar planilha"
          />
          <CopyButton text={unsettledTsv(visible)} label="Copiar" />
        </div>
      }
    >
      <label htmlFor="unsettled-filter" className="mb-1 block text-xs font-bold t-3">
        Procurar pedido nesta página
      </label>
      <div className="mb-1 flex items-center gap-2">
        <Search className="h-3.5 w-3.5 shrink-0 t-4" />
        <input
          id="unsettled-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          spellCheck={false}
          placeholder="576463220456522968 — ou vários, separados por vírgula/espaço"
          className="inp font-mono"
        />
      </div>
      <p className="mb-3 text-[11px] t-4">
        A busca é <strong className="t-3">local</strong>, nas transações já carregadas: o endpoint
        não aceita filtro por pedido, só a janela de datas. Se o pedido não aparecer, ou ele está
        fora da janela consultada (ajuste as datas no passo 1 para a data de criação dele) ou já
        foi liquidado — e aí ele sai desta consulta e passa a estar na aba{" "}
        <strong className="t-3">Transações</strong>.
      </p>

      {filtering && (
        <p className="mb-2 text-[11px] t-3">
          {visible.length} de {transactions.length} transação(ões) desta página.
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
              <th>Criado em</th>
              <th>Liquidação prevista</th>
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
        </table>
      </div>
      )}
      <p className="mt-2 text-[11px] t-4">
        Valores negativos são custos que serão descontados do repasse. Enquanto o pedido não é
        entregue, o frete estimado está incompleto e a liquidação aparece como política
        (&ldquo;x days after delivery&rdquo;) em vez de data. Abra uma linha para ver o
        detalhamento — só os campos diferentes de zero aparecem.
      </p>
    </Card>
  );
}

function TransactionRow({
  tx,
  currency,
}: {
  tx: UnsettledTransaction;
  currency: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const reference = tx.order_id ?? tx.adjustment_order_id ?? tx.adjustment_id;
  const delivered = isDelivered(tx);

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
          {!delivered && <span className="badge gray ml-1.5">não entregue</span>}
        </td>
        <td className="select-all font-mono t-3">{reference ?? "—"}</td>
        <td className="t-3">{formatEpochDateBR(tx.order_create_time)}</td>
        <td className="t-3">
          <EstimatedSettlementCell value={tx.estimated_settlement} reason={tx.unsettled_reason} />
        </td>
        <td className="text-right t-1">{formatMoney(parseMoney(tx.est_revenue_amount), currency)}</td>
        <td className="text-right t-1">
          {formatMoney(parseMoney(tx.est_shipping_cost_amount), currency)}
        </td>
        <td className="text-right t-1">
          {formatMoney(parseMoney(tx.est_fee_tax_amount), currency)}
        </td>
        <td className="text-right font-semibold t-1">
          {formatMoney(parseMoney(tx.est_settlement_amount), currency)}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={9} className="bg-[var(--surface2)] p-0">
            <TransactionDetail tx={tx} currency={currency} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/**
 * `estimated_settlement` vem como data OU como a política textual, a
 * depender de o pedido ter sido entregue. Mostrar a frase original quando
 * não há data é mais honesto do que exibir "—": ela diz o que falta
 * acontecer para o valor virar definitivo.
 *
 * `unsettled_reason` aparece junto, na linha fechada, porque é A pergunta
 * que se faz olhando esta consulta ("por que ainda não caiu?"). Escondê-la
 * atrás do expansor obrigaria a abrir transação por transação para
 * responder.
 */
function EstimatedSettlementCell({
  value,
  reason,
}: {
  value: string | undefined;
  reason: string | undefined;
}) {
  const parsed = parseEstimatedSettlement(value);

  return (
    <>
      {parsed === undefined ? (
        <span className="t-4">—</span>
      ) : parsed.kind === "date" ? (
        <span className="inline-flex items-center gap-1 t-1">
          <CalendarClock className="h-3 w-3 shrink-0 t-4" />
          {formatEpochDateBR(parsed.epoch)}
        </span>
      ) : (
        <span className="t-3" title="A API ainda não calculou a data — este é o texto da política.">
          {parsed.text}
        </span>
      )}
      {reason !== undefined && reason !== "" && (
        <span className="block text-[10px] t-4">{reason}</span>
      )}
    </>
  );
}

function TransactionDetail({
  tx,
  currency,
}: {
  tx: UnsettledTransaction;
  currency: string | undefined;
}) {
  const { supplementary_component: shippingSupplement, ...shipping } =
    tx.shipping_cost_breakdown ?? {};
  const estimated = parseEstimatedSettlement(tx.estimated_settlement);

  return (
    <div className="space-y-4 px-4 py-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
        <Field label="ID da transação" value={tx.id} mono />
        <Field label="ID do pedido" value={tx.order_id} mono />
        <Field label="ID do ajuste" value={tx.adjustment_id} mono />
        <Field label="Pedido do ajuste" value={tx.adjustment_order_id} mono />
        <Field label="Status" value={tx.status} />
        <Field label="Moeda" value={tx.currency} />
        <Field label="Criado em" value={formatEpochBR(tx.order_create_time)} />
        <Field
          label="Entregue em"
          value={tx.order_delivery_time !== undefined ? formatEpochBR(tx.order_delivery_time) : undefined}
        />
        <Field
          label="Liquidação prevista"
          value={
            estimated === undefined
              ? undefined
              : estimated.kind === "date"
                ? formatEpochBR(estimated.epoch)
                : estimated.text
          }
        />
        <Field
          label="Ajuste estimado"
          value={formatMoney(parseMoney(tx.est_adjustment_amount), currency)}
        />
      </dl>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BreakdownBlock
          title="Receita estimada"
          total={parseMoney(tx.est_revenue_amount)}
          entries={nonZeroEntries(tx.revenue_breakdown, revenueLabel)}
          zeros={hiddenFieldCount(tx.revenue_breakdown)}
          currency={currency}
        />
        <BreakdownBlock
          title="Custo de frete estimado"
          note={
            isDelivered(tx)
              ? undefined
              : "Pedido não entregue: o frete real ainda não é conhecido e este valor vai mudar."
          }
          total={parseMoney(tx.est_shipping_cost_amount)}
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
        <FeeTaxBlock
          title="Tarifas e impostos estimados"
          breakdown={tx.fee_tax_breakdown}
          total={parseMoney(tx.est_fee_tax_amount)}
          totalField="est_fee_tax_amount"
          currency={currency}
          labelFor={feeTaxLabel}
        />
      </div>
    </div>
  );
}
