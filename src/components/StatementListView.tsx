import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet, Landmark, Layers } from "lucide-react";
import type { Statement, StatementListData } from "../types/tiktok";
import {
  buildStatementEndpoint,
  buildStatementListEndpoint,
  type PaymentStatus,
  type StatementSortOrder,
} from "../lib/endpoint";
import { TIKTOK_API_HOST } from "../lib/signedUrl";
import {
  labelForPaymentStatus,
  paymentStatusTone,
  singleCurrency,
  statementListCsv,
  statementListFileName,
  statementListTotals,
  statementListTsv,
  statementListXlsx,
} from "../lib/statementList";
import { formatEpochBR, formatEpochDateBR } from "../lib/format";
import { formatMoney, parseMoney } from "../lib/money";
import { Card, CopyButton, DownloadButton } from "./ui";
import { Field, Highlight } from "./breakdown";

/** Parâmetros da consulta que gerou esta página, para montar a próxima. */
export interface StatementListPageQuery {
  pageSize: number | undefined;
  sortOrder: StatementSortOrder | undefined;
  statementTimeGe: number | undefined;
  statementTimeLt: number | undefined;
  paymentStatus: PaymentStatus | undefined;
}

/**
 * Exibição de GET /finance/202309/statements.
 *
 * Esta é a tela de ENTRADA das finanças. As outras duas de repasse partem
 * de um código que veio de algum lugar; é aqui que ele aparece. Por isso
 * cada linha não termina em si: ela entrega o caminho da consulta de
 * extrato daquele repasse, pronto para assinar — sem isso o usuário teria
 * que copiar o ID à mão e voltar ao passo 1.
 */
export function StatementListView({
  data,
  query,
}: {
  data: StatementListData;
  query: StatementListPageQuery;
}) {
  const statements = data.statements ?? [];
  const currency = useMemo(() => singleCurrency(statements), [statements]);

  return (
    <>
      <SummaryCard statements={statements} currency={currency} />
      <NextPageCard data={data} query={query} />
      <StatementsCard statements={statements} currency={currency} />
    </>
  );
}

function SummaryCard({
  statements,
  currency,
}: {
  statements: Statement[];
  currency: string | undefined;
}) {
  const totals = useMemo(() => statementListTotals(statements), [statements]);
  const mixedCurrency = currency === undefined && statements.length > 0;

  return (
    <Card title="Repasses" icon={<Landmark />} count={statements.length}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Highlight
          label="Total transferido (nesta página)"
          value={formatMoney(totals.settlement, currency)}
          strong
        />
        <Highlight label="Receita" value={formatMoney(totals.revenue, currency)} />
        <Highlight label="Tarifas" value={formatMoney(totals.fee, currency)} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
        <Field label="Repasses nesta página" value={String(statements.length)} />
        <Field label="Ainda não pagos" value={String(totals.pending)} />
        <Field label="Moeda" value={mixedCurrency ? "(mista)" : currency} />
        <Field label="Ajustes" value={formatMoney(totals.adjustment, currency)} />
      </dl>

      <p className="mt-2 text-[11px] t-4">
        A resposta não traz somatório nenhum: todos os totais acima são{" "}
        <strong className="t-2">somas desta página</strong>, calculadas a partir das linhas
        exibidas. Se houver próxima página, eles não são o total do período.
      </p>

      {mixedCurrency && (
        <p className="alert alert-error mt-2 px-3 py-2 text-xs t-2">
          Os repasses desta página estão em moedas diferentes — somar linhas de moedas distintas
          não produz um total válido.
        </p>
      )}
    </Card>
  );
}

function NextPageCard({
  data,
  query,
}: {
  data: StatementListData;
  query: StatementListPageQuery;
}) {
  const token = data.next_page_token;

  const nextUrl = useMemo(() => {
    if (token === undefined || token === "") return null;
    const result = buildStatementListEndpoint({
      pageSize: query.pageSize,
      sortOrder: query.sortOrder,
      statementTimeGe: query.statementTimeGe,
      statementTimeLt: query.statementTimeLt,
      paymentStatus: query.paymentStatus,
      pageToken: token,
    });
    return result.ok ? `${TIKTOK_API_HOST}${result.path}` : null;
  }, [token, query]);

  if (token === undefined || token === "") {
    return (
      <Card title="Paginação" icon={<Layers />}>
        <p className="text-xs t-3">
          A resposta não trouxe <code>next_page_token</code> — esta é a última página.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Próxima página" icon={<Layers />}>
      <p className="text-xs t-3">
        Ainda há repasses. O <code>page_token</code> faz parte da query e é assinado junto, então a
        próxima página exige uma <strong className="t-1">nova assinatura</strong>.
      </p>
      {nextUrl !== null && (
        <div className="panel-success mt-2 flex items-center gap-2 px-3 py-2">
          <code className="flex-1 select-all break-all font-mono text-[11px] t-1">{nextUrl}</code>
          <CopyButton text={nextUrl} label="Copiar" />
        </div>
      )}
    </Card>
  );
}

function StatementsCard({
  statements,
  currency,
}: {
  statements: Statement[];
  currency: string | undefined;
}) {
  if (statements.length === 0) {
    return (
      <Card title="Repasses" icon={<FileSpreadsheet />}>
        <p className="text-xs t-4">
          Nenhum repasse na janela consultada. Amplie as datas no passo 1 — e lembre que esta API
          só devolve dados a partir de 01/07/2023.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Repasses"
      icon={<FileSpreadsheet />}
      count={statements.length}
      actions={
        <div className="flex items-center gap-2">
          <DownloadButton
            build={() => statementListXlsx(statements)}
            filename={statementListFileName("xlsx")}
            mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            label="Excel"
          />
          <DownloadButton
            build={() => statementListCsv(statements)}
            filename={statementListFileName("csv")}
            label="CSV"
          />
          <CopyButton text={statementListTsv(statements)} label="Copiar" />
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="tbl text-xs">
          <thead>
            <tr>
              <th />
              <th>Repasse</th>
              <th>Gerado em</th>
              <th>Pagamento</th>
              <th className="text-right">Receita</th>
              <th className="text-right">Frete</th>
              <th className="text-right">Tarifas</th>
              <th className="text-right">Transferido</th>
            </tr>
          </thead>
          <tbody>
            {statements.map((statement) => (
              <StatementRow key={statement.id} statement={statement} currency={currency} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] t-4">
        Abra uma linha para pegar a URL da consulta de extrato daquele repasse — é ela que traz as
        transações, pedido a pedido.
      </p>
    </Card>
  );
}

function StatementRow({
  statement,
  currency,
}: {
  statement: Statement;
  currency: string | undefined;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr>
        <td className="w-6">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Fechar detalhes" : "Detalhar repasse"}
            className="copy-btn"
          >
            {open ? <ChevronDown /> : <ChevronRight />}
          </button>
        </td>
        <td className="select-all font-mono t-3">{statement.id}</td>
        <td className="t-3">{formatEpochDateBR(statement.statement_time)}</td>
        <td className="t-1">
          <span className={`badge ${paymentStatusTone(statement.payment_status)}`}>
            {labelForPaymentStatus(statement.payment_status)}
          </span>
        </td>
        <td className="text-right t-1">
          {formatMoney(parseMoney(statement.revenue_amount), currency)}
        </td>
        <td className="text-right t-1">
          {formatMoney(parseMoney(statement.shipping_cost_amount), currency)}
        </td>
        <td className="text-right t-1">
          {formatMoney(parseMoney(statement.fee_amount), currency)}
        </td>
        <td className="text-right font-semibold t-1">
          {formatMoney(parseMoney(statement.settlement_amount), currency)}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="bg-[var(--surface2)] p-0">
            <StatementDetail statement={statement} currency={currency} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * O detalhe existe sobretudo por uma coisa: entregar o caminho da consulta
 * de extrato deste repasse. Sem ele, o usuário copiaria o ID, voltaria ao
 * passo 1, escolheria a outra aba e colaria — quatro passos para algo que
 * a tela já sabe montar.
 */
function StatementDetail({
  statement,
  currency,
}: {
  statement: Statement;
  currency: string | undefined;
}) {
  const transactionsUrl = useMemo(() => {
    const result = buildStatementEndpoint(statement.id);
    return result.ok ? `${TIKTOK_API_HOST}${result.path}` : null;
  }, [statement.id]);

  return (
    <div className="space-y-3 px-4 py-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
        <Field label="ID do repasse" value={statement.id} mono />
        <Field label="ID do pagamento" value={statement.payment_id} mono />
        <Field label="Gerado em" value={formatEpochBR(statement.statement_time)} />
        <Field label="Pago em" value={formatEpochBR(statement.payment_time)} />
        <Field
          label="Vendas líquidas"
          value={formatMoney(parseMoney(statement.net_sales_amount), currency)}
        />
        <Field
          label="Ajustes"
          value={formatMoney(parseMoney(statement.adjustment_amount), currency)}
        />
        <Field label="Moeda" value={statement.currency} />
        <Field label="Status" value={statement.payment_status} />
      </dl>

      {transactionsUrl !== null && (
        <div>
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide t-3">
            Transações deste repasse
          </h4>
          <div className="panel-success flex items-center gap-2 px-3 py-2">
            <code className="flex-1 select-all break-all font-mono text-[11px] t-1">
              {transactionsUrl}
            </code>
            <CopyButton text={transactionsUrl} label="Copiar" />
          </div>
          <p className="mt-1 text-[11px] t-4">
            Envie ao sistema interno de assinatura e cole a URL assinada no passo 2. É a consulta da
            aba <strong className="t-3">Extrato</strong>, já com o ID deste repasse no caminho.
          </p>
        </div>
      )}
    </div>
  );
}
