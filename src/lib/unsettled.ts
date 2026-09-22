import type { UnsettledTransaction, UnsettledTransactionsData } from "../types/tiktok";
import {
  addMoney,
  moneyEquals,
  moneyOrZero,
  parseMoney,
  subtractMoney,
  toDecimalString,
  ZERO,
  type Money,
} from "./money";
import { readFeeTax } from "./statements";
import { labelForType } from "./statementLabels";
import { formatEpochBR } from "./format";
import { buildXlsx, type XlsxCell } from "./xlsx";

/**
 * Leitura de Get Unsettled Transactions (/finance/202507/orders/unsettled).
 *
 * O QUE MUDA EM RELAÇÃO AO EXTRATO, e por que este módulo existe separado
 * de `statements.ts`:
 *
 * 1. TUDO É ESTIMATIVA. Os campos têm prefixo `est_` porque o repasse
 *    ainda não foi fechado; o frete, em especial, só é conhecido depois da
 *    entrega. Um número daqui não pode ser lançado como realizado — daí a
 *    tela insistir nessa distinção.
 *
 * 2. OS SOMATÓRIOS DO CABEÇALHO SÃO DO CONJUNTO INTEIRO, não da página, e
 *    a resposta não traz somatório de frete. Comparar os quatro
 *    somatórios com a soma das transações exibidas só faz sentido quando a
 *    página é o conjunto inteiro — `canCompareSums` é quem decide isso, e
 *    sem ele a tela acusaria divergência em toda consulta paginada.
 *
 * 3. `estimated_settlement` NÃO É UM NÚMERO. Enquanto o pedido não é
 *    entregue, a API devolve o texto da política ("15 days after
 *    delivery"); depois passa a devolver um epoch. Tratar o campo como
 *    data quebraria a exibição justamente no caso mais comum desta
 *    consulta, que é o pedido ainda não entregue.
 *
 * A aritmética é a mesma do resto do app: inteiros em escala 4
 * (`money.ts`), nunca `Number` direto sobre os decimais em string.
 */

/* ------------------------------------------------------------------ */
/* estimated_settlement: data OU política                              */
/* ------------------------------------------------------------------ */

export type EstimatedSettlement =
  /** A API já calculou a data: o pedido foi entregue. */
  | { kind: "date"; epoch: number }
  /** Política textual ("x days after delivery"): ainda não entregue. */
  | { kind: "policy"; text: string };

/**
 * Interpreta `estimated_settlement`. Devolve `undefined` quando o campo
 * veio ausente ou vazio — o que é diferente de "vem como texto".
 *
 * Só dígitos vira data (epoch em SEGUNDOS, como no exemplo da
 * documentação); qualquer outra coisa é devolvida como política, sem
 * tentar adivinhar quantos dias são. Traduzir o texto seria chutar: a
 * documentação não fixa o formato dessa frase.
 */
export function parseEstimatedSettlement(
  raw: string | undefined,
): EstimatedSettlement | undefined {
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (value === "") return undefined;

  if (/^\d+$/.test(value)) {
    const epoch = Number(value);
    if (epoch > 0) return { kind: "date", epoch };
  }

  return { kind: "policy", text: value };
}

/**
 * Um pedido entregue é o que já tem frete real e data de liquidação
 * calculada; sem entrega, `est_shipping_cost_amount` é incompleto por
 * definição. A tela usa isso para marcar quais linhas ainda vão mudar.
 */
export function isDelivered(tx: UnsettledTransaction): boolean {
  return tx.order_delivery_time !== undefined && tx.order_delivery_time > 0;
}

/* ------------------------------------------------------------------ */
/* Conferência da fórmula, por transação                               */
/* ------------------------------------------------------------------ */

export interface FormulaCheck {
  expected: Money;
  returned: Money;
  matches: boolean;
}

/**
 * Confere, em UMA transação, a fórmula publicada para
 * `est_settlement_amount`:
 *
 *   est_settlement = est_revenue − est_shipping_cost − est_fee_tax − est_adjustment
 *
 * Os custos já chegam NEGATIVOS da API (frete "-70", taxas "-30"), então
 * a subtração soma — é assim que o exemplo da documentação fecha:
 * 200 − (−70) − (−30) − 170 = 130.
 *
 * Devolve `undefined` quando a transação não trouxe
 * `est_settlement_amount`: sem o valor retornado não há o que conferir, e
 * inventar zero acusaria divergência onde só há campo ausente.
 */
export function checkTransactionFormula(tx: UnsettledTransaction): FormulaCheck | undefined {
  const returned = parseMoney(tx.est_settlement_amount);
  if (returned === undefined) return undefined;

  const expected = subtractMoney(
    moneyOrZero(tx.est_revenue_amount),
    moneyOrZero(tx.est_shipping_cost_amount),
    moneyOrZero(tx.est_fee_tax_amount),
    moneyOrZero(tx.est_adjustment_amount),
  );

  return { expected, returned, matches: moneyEquals(expected, returned) };
}

export interface FormulaSummary {
  /** Transações em que a fórmula pôde ser conferida. */
  checked: number;
  /** Quantas fecharam. */
  matching: number;
  /** As que não fecharam, para a tela apontar quais são. */
  diverging: Array<{ tx: UnsettledTransaction; check: FormulaCheck }>;
}

export function summarizeFormulas(transactions: UnsettledTransaction[]): FormulaSummary {
  const summary: FormulaSummary = { checked: 0, matching: 0, diverging: [] };

  for (const tx of transactions) {
    const check = checkTransactionFormula(tx);
    if (check === undefined) continue;
    summary.checked += 1;
    if (check.matches) summary.matching += 1;
    else summary.diverging.push({ tx, check });
  }

  return summary;
}

/**
 * Quanto de `est_fee_tax_amount` a API não detalhou nesta transação.
 *
 * Vai para a exportação como coluna própria: é o valor que o financeiro
 * procuraria na mão ao tentar reconstruir a taxa a partir das linhas e
 * não chegar ao total. A leitura em si é a mesma do extrato — ver
 * `readFeeTax` em statements.ts.
 */
export function undetailedFeeTax(tx: UnsettledTransaction): Money | undefined {
  // O rótulo não importa para somar; só os valores entram na conta.
  return readFeeTax(tx.fee_tax_breakdown, parseMoney(tx.est_fee_tax_amount), (field) => field)
    .reconciliation?.undetailed;
}

/* ------------------------------------------------------------------ */
/* Somas da página × somatórios do cabeçalho                           */
/* ------------------------------------------------------------------ */

export interface PageSums {
  revenue: Money;
  shipping: Money;
  feeTax: Money;
  adjustment: Money;
  settlement: Money;
}

/** Soma, nesta página, cada um dos cinco valores estimados. */
export function pageSums(transactions: UnsettledTransaction[]): PageSums {
  const sums: PageSums = {
    revenue: ZERO,
    shipping: ZERO,
    feeTax: ZERO,
    adjustment: ZERO,
    settlement: ZERO,
  };

  for (const tx of transactions) {
    sums.revenue = addMoney(sums.revenue, parseMoney(tx.est_revenue_amount));
    sums.shipping = addMoney(sums.shipping, parseMoney(tx.est_shipping_cost_amount));
    sums.feeTax = addMoney(sums.feeTax, parseMoney(tx.est_fee_tax_amount));
    sums.adjustment = addMoney(sums.adjustment, parseMoney(tx.est_adjustment_amount));
    sums.settlement = addMoney(sums.settlement, parseMoney(tx.est_settlement_amount));
  }

  return sums;
}

/**
 * Os somatórios do cabeçalho valem para o conjunto filtrado INTEIRO,
 * enquanto `transactions` é só a página. Compará-los sem esta checagem
 * acusaria divergência em toda consulta que tenha mais de uma página —
 * um alarme falso pior do que não conferir.
 *
 * Só há o que comparar quando esta página é o conjunto inteiro: sem
 * `next_page_token` e com `total_count` batendo com o que veio.
 */
export function canCompareSums(
  data: UnsettledTransactionsData,
  transactions: UnsettledTransaction[],
): boolean {
  const token = data.next_page_token ?? "";
  if (token !== "") return false;
  if (data.total_count === undefined) return false;
  return data.total_count === transactions.length;
}

export interface SumCheck {
  field: keyof UnsettledTransactionsData;
  label: string;
  /** Somatório declarado no cabeçalho. */
  returned: Money | undefined;
  /** Soma das transações desta página. */
  fromPage: Money;
  matches: boolean;
}

/**
 * Confere os somatórios do cabeçalho contra a soma das transações.
 * Chame apenas quando `canCompareSums` for verdadeiro.
 *
 * `sum_est_fee_amount` é o somatório de taxas/impostos: a resposta NÃO
 * traz somatório de frete, então o custo de frete não tem contraparte no
 * cabeçalho para ser conferido — ele aparece na tela somado da página e
 * marcado como tal.
 */
export function checkSums(
  data: UnsettledTransactionsData,
  transactions: UnsettledTransaction[],
): SumCheck[] {
  const sums = pageSums(transactions);

  const pairs: Array<[keyof UnsettledTransactionsData, string, Money]> = [
    ["sum_est_revenue_amount", "Receita estimada", sums.revenue],
    ["sum_est_fee_amount", "Taxas e impostos estimados", sums.feeTax],
    ["sum_est_adjustment_amount", "Ajustes estimados", sums.adjustment],
    ["sum_est_settlement_amount", "Repasse estimado", sums.settlement],
  ];

  return pairs.map(([field, label, fromPage]) => {
    const returned = parseMoney(data[field] as string | undefined);
    return {
      field,
      label,
      returned,
      fromPage,
      matches: returned !== undefined && moneyEquals(returned, fromPage),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Totais por tipo                                                     */
/* ------------------------------------------------------------------ */

export interface UnsettledTypeTotal {
  type: string;
  count: number;
  settlement: Money;
  revenue: Money;
  adjustment: Money;
}

/** Agrupa a página por `type` — separa pedidos dos ajustes da plataforma. */
export function unsettledTotalsByType(
  transactions: UnsettledTransaction[],
): UnsettledTypeTotal[] {
  const totals = new Map<string, UnsettledTypeTotal>();

  for (const tx of transactions) {
    const type = tx.type ?? "(sem tipo)";
    const current = totals.get(type) ?? {
      type,
      count: 0,
      settlement: ZERO,
      revenue: ZERO,
      adjustment: ZERO,
    };
    current.count += 1;
    current.settlement = addMoney(current.settlement, parseMoney(tx.est_settlement_amount));
    current.revenue = addMoney(current.revenue, parseMoney(tx.est_revenue_amount));
    current.adjustment = addMoney(current.adjustment, parseMoney(tx.est_adjustment_amount));
    totals.set(type, current);
  }

  return [...totals.values()].sort((a, b) => b.count - a.count);
}

/**
 * Moeda da resposta. Aqui ela vem POR TRANSAÇÃO, não no cabeçalho como no
 * extrato — a tela precisa de uma para formatar os somatórios. Devolve a
 * moeda quando todas as transações concordam; `undefined` se a página
 * misturar moedas (aí somar já não faria sentido) ou se nenhuma informar.
 */
export function singleCurrency(transactions: UnsettledTransaction[]): string | undefined {
  let found: string | undefined;

  for (const tx of transactions) {
    const currency = tx.currency;
    if (currency === undefined || currency === "") continue;
    if (found === undefined) found = currency;
    else if (found !== currency) return undefined;
  }

  return found;
}

/* ------------------------------------------------------------------ */
/* Busca por pedido                                                    */
/* ------------------------------------------------------------------ */

/**
 * Filtra as transações JÁ CARREGADAS por ID.
 *
 * POR QUE A BUSCA É LOCAL: o endpoint não aceita filtro por pedido. Os
 * únicos recortes que ele oferece são `search_time_ge`/`search_time_lt`
 * sobre `order_create_time` — não existe parâmetro de `order_id` nem de
 * `adjustment_id` na documentação. Então procurar um pedido específico é
 * necessariamente: trazer a janela onde ele foi criado e achar a linha
 * aqui dentro.
 *
 * Aceita vários termos separados por vírgula, espaço ou quebra de linha,
 * para colar uma coluna inteira de planilha e ver quais daqueles pedidos
 * ainda estão pendentes. Casa por trecho (não exige o ID inteiro) e
 * procura em todos os identificadores da transação, além do `type` — o
 * pedido pode aparecer como `order_id` numa linha e como
 * `adjustment_order_id` em outra.
 */
export function filterTransactions(
  transactions: UnsettledTransaction[],
  query: string,
): UnsettledTransaction[] {
  const terms = query
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter((term) => term !== "");

  if (terms.length === 0) return transactions;

  return transactions.filter((tx) => {
    const haystack = [tx.id, tx.order_id, tx.adjustment_id, tx.adjustment_order_id, tx.type]
      .filter((value): value is string => value !== undefined && value !== "")
      .join(" ")
      .toLowerCase();

    return terms.some((term) => haystack.includes(term));
  });
}

/* ------------------------------------------------------------------ */
/* Exportação para planilha                                            */
/* ------------------------------------------------------------------ */

/**
 * Colunas da exportação, na ordem, com CABEÇALHO EM PORTUGUÊS — quem abre
 * o arquivo é o financeiro, não quem lê a documentação da API.
 *
 * Uma definição só alimenta os três formatos (copiar, CSV e Excel), para
 * que o que se cola, o que se baixa e o que se abre nunca divirjam. Cada
 * célula declara o seu TIPO em vez de já vir como texto: é o que permite
 * ao .xlsx gravar número como número e data como data, em vez de mandar
 * tudo como string e deixar o Excel adivinhar.
 */
export type ExportCell =
  | { kind: "text"; value: string }
  | { kind: "money"; value: Money | undefined }
  /** Epoch em segundos. */
  | { kind: "date"; value: number | undefined };

export interface ExportColumn {
  header: string;
  /** Largura da coluna no Excel, em caracteres. */
  width: number;
  cell: (tx: UnsettledTransaction) => ExportCell;
}

const text = (value: string | undefined): ExportCell => ({ kind: "text", value: value ?? "" });

export const EXPORT_COLUMNS: ExportColumn[] = [
  { header: "ID da transação", width: 22, cell: (tx) => text(tx.id) },
  // Tipo traduzido para leitura e código cru ao lado: o rótulo é o que a
  // pessoa entende, o código é o que filtra e agrupa numa tabela dinâmica.
  { header: "Tipo", width: 26, cell: (tx) => text(labelForType(tx.type)) },
  { header: "Tipo (código)", width: 26, cell: (tx) => text(tx.type) },
  { header: "Status", width: 12, cell: (tx) => text(tx.status) },
  { header: "Moeda", width: 8, cell: (tx) => text(tx.currency) },
  {
    header: "Pedido",
    width: 22,
    cell: (tx) => text(tx.order_id ?? tx.adjustment_order_id),
  },
  { header: "Ajuste", width: 22, cell: (tx) => text(tx.adjustment_id) },
  { header: "Criado em", width: 18, cell: (tx) => ({ kind: "date", value: tx.order_create_time }) },
  {
    header: "Entregue em",
    width: 18,
    cell: (tx) => ({ kind: "date", value: tx.order_delivery_time }),
  },
  {
    header: "Liquidação prevista",
    width: 24,
    // O campo é data OU a frase da política, conforme o pedido já tenha
    // sido entregue. A coluna acompanha: quando há data, vai como data de
    // verdade (ordena e filtra); quando é política, vai o texto original.
    // Exportar o epoch cru daria uma coluna com "1685548800" dentro.
    cell: (tx) => {
      const parsed = parseEstimatedSettlement(tx.estimated_settlement);
      if (parsed === undefined) return text("");
      return parsed.kind === "date"
        ? { kind: "date", value: parsed.epoch }
        : text(parsed.text);
    },
  },
  { header: "Motivo da pendência", width: 32, cell: (tx) => text(tx.unsettled_reason) },
  {
    header: "Receita estimada",
    width: 18,
    cell: (tx) => ({ kind: "money", value: parseMoney(tx.est_revenue_amount) }),
  },
  {
    header: "Frete estimado",
    width: 16,
    cell: (tx) => ({ kind: "money", value: parseMoney(tx.est_shipping_cost_amount) }),
  },
  {
    header: "Tarifas e impostos estimados",
    width: 26,
    cell: (tx) => ({ kind: "money", value: parseMoney(tx.est_fee_tax_amount) }),
  },
  {
    // A parte de est_fee_tax que nenhum campo de fee/tax reporta. Sem esta
    // coluna, reconstruir a taxa na planilha a partir do detalhamento não
    // fecha e não há pista de quanto falta.
    header: "Tarifas sem detalhamento",
    width: 24,
    cell: (tx) => ({ kind: "money", value: undetailedFeeTax(tx) }),
  },
  {
    header: "Ajuste estimado",
    width: 18,
    cell: (tx) => ({ kind: "money", value: parseMoney(tx.est_adjustment_amount) }),
  },
  {
    header: "Repasse estimado",
    width: 18,
    cell: (tx) => ({ kind: "money", value: parseMoney(tx.est_settlement_amount) }),
  },
];

/** Texto livre da API pode ter TAB ou quebra de linha, que quebram a linha. */
function flatten(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Data/hora local no formato brasileiro, como o resto da aplicação mostra. */
function dateForText(epochSeconds: number | undefined): string {
  if (epochSeconds === undefined || epochSeconds <= 0) return "";
  return formatEpochBR(epochSeconds);
}

/**
 * Renderiza uma célula como texto. `decimal` decide o separador: ponto no
 * formato de colar (como a API devolveu) e vírgula no CSV em português.
 */
function cellText(cell: ExportCell, decimal: "." | ","): string {
  switch (cell.kind) {
    case "text":
      return flatten(cell.value);
    case "date":
      return dateForText(cell.value);
    case "money": {
      if (cell.value === undefined) return "";
      const value = toDecimalString(cell.value);
      return decimal === "," ? value.replace(".", ",") : value;
    }
  }
}

/**
 * Uma linha por transação, separada por TAB — o formato de COLAR: o Excel
 * divide por TAB sozinho, sem passar pelo assistente de importação.
 */
export function unsettledTsv(transactions: UnsettledTransaction[]): string {
  const header = EXPORT_COLUMNS.map((column) => column.header).join("\t");
  const rows = transactions.map((tx) =>
    EXPORT_COLUMNS.map((column) => cellText(column.cell(tx), ".")).join("\t"),
  );
  return [header, ...rows].join("\n");
}

/** Escapa conforme o RFC 4180, que é o que o Excel espera. */
function csvCell(value: string): string {
  if (!/[;"\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * CSV para BAIXAR, no dialeto que o Excel em português abre com um duplo
 * clique: separador `;` e vírgula decimal.
 *
 * O Excel pt-BR usa `;` como separador de lista (a vírgula é o decimal),
 * então um CSV separado por vírgula cairia todo na primeira coluna. Pelo
 * mesmo motivo os valores monetários trocam `.` por `,` — senão "189.2"
 * entra como texto e não soma.
 */
export function unsettledCsv(transactions: UnsettledTransaction[]): string {
  const header = EXPORT_COLUMNS.map((column) => csvCell(column.header)).join(";");
  const rows = transactions.map((tx) =>
    EXPORT_COLUMNS.map((column) => csvCell(cellText(column.cell(tx), ","))).join(";"),
  );
  return [header, ...rows].join("\r\n");
}

/**
 * Arquivo .xlsx de verdade.
 *
 * A vantagem sobre o CSV não é o formato em si: é que aqui o número vai
 * como NÚMERO e a data como DATA. Não existe a questão de ponto ou
 * vírgula decimal — quem decide a exibição é o Excel, pelo idioma da
 * máquina —, e datas ordenam e filtram de verdade em vez de ordenarem
 * como texto.
 */
export function unsettledXlsx(
  transactions: UnsettledTransaction[],
  modified?: Date,
): Uint8Array {
  const rows: XlsxCell[][] = transactions.map((tx) =>
    EXPORT_COLUMNS.map((column): XlsxCell => {
      const cell = column.cell(tx);

      switch (cell.kind) {
        case "text": {
          const value = flatten(cell.value);
          return value === "" ? { kind: "empty" } : { kind: "text", value };
        }
        case "date":
          return cell.value === undefined || cell.value <= 0
            ? { kind: "empty" }
            : { kind: "date", value: new Date(cell.value * 1000) };
        case "money":
          return cell.value === undefined
            ? { kind: "empty" }
            : { kind: "money", value: Number(toDecimalString(cell.value)) };
      }
    }),
  );

  return buildXlsx({
    sheetName: "A liquidar",
    columns: EXPORT_COLUMNS.map((column) => ({ header: column.header, width: column.width })),
    rows,
    modified,
  });
}

/** Nome do arquivo baixado, com a data para não sobrescrever o anterior. */
export function unsettledFileName(extension: "csv" | "xlsx", now: Date = new Date()): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return `transacoes-a-liquidar-${stamp}.${extension}`;
}
