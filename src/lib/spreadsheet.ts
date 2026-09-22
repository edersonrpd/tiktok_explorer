import { toDecimalString, type Money } from "./money";
import { formatEpochBR } from "./format";
import { buildXlsx, type XlsxCell } from "./xlsx";

/**
 * Exportação de uma tabela para planilha, nos três formatos que as telas
 * de finanças oferecem.
 *
 * A IDEIA CENTRAL: uma tela declara suas colunas UMA vez, e cada célula
 * diz o seu TIPO em vez de já vir como texto. É isso que permite ao
 * `.xlsx` gravar número como número e data como data — enquanto os
 * formatos de texto renderizam a partir da mesma definição e, por
 * construção, não divergem do arquivo binário.
 *
 * Os três existem porque resolvem coisas diferentes:
 * - `.xlsx`  — o formato a preferir: tipos de verdade, sem a questão do
 *   separador decimal, com datas que ordenam e filtram.
 * - `.csv`   — quando é preciso texto: importar em outro sistema,
 *   versionar, abrir no Sheets.
 * - TAB      — colar numa planilha já aberta, sem assistente de importação.
 */

export type ExportCell =
  | { kind: "text"; value: string }
  | { kind: "money"; value: Money | undefined }
  /** Epoch em SEGUNDOS. */
  | { kind: "date"; value: number | undefined };

export interface ExportColumn<T> {
  header: string;
  /** Largura da coluna no Excel, em caracteres. */
  width: number;
  cell: (row: T) => ExportCell;
}

/** Atalho para a célula de texto, que é a maioria. */
export function textCell(value: string | undefined): ExportCell {
  return { kind: "text", value: value ?? "" };
}

/** Texto livre da API pode ter TAB ou quebra de linha, que quebram a linha. */
function flatten(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Renderiza uma célula como texto. `decimal` decide o separador: ponto no
 * formato de colar (como a API devolveu) e vírgula no CSV em português.
 */
function cellToText(cell: ExportCell, decimal: "." | ","): string {
  switch (cell.kind) {
    case "text":
      return flatten(cell.value);
    case "date":
      // Data/hora local no formato brasileiro, como o resto do app mostra.
      return cell.value === undefined || cell.value <= 0 ? "" : formatEpochBR(cell.value);
    case "money": {
      if (cell.value === undefined) return "";
      const value = toDecimalString(cell.value);
      return decimal === "," ? value.replace(".", ",") : value;
    }
  }
}

/**
 * Uma linha por registro, separada por TAB — o formato de COLAR: o Excel
 * divide por TAB sozinho, sem passar pelo assistente de importação.
 */
export function toTsv<T>(columns: Array<ExportColumn<T>>, rows: T[]): string {
  const header = columns.map((column) => column.header).join("\t");
  const body = rows.map((row) =>
    columns.map((column) => cellToText(column.cell(row), ".")).join("\t"),
  );
  return [header, ...body].join("\n");
}

/** Escapa conforme o RFC 4180, que é o que o Excel espera. */
function csvCell(value: string): string {
  if (!/[;"\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * CSV no dialeto que o Excel em português abre com um duplo clique:
 * separador `;` e vírgula decimal.
 *
 * O Excel pt-BR usa `;` como separador de lista (a vírgula é o decimal),
 * então um CSV separado por vírgula cairia todo na primeira coluna. Pelo
 * mesmo motivo os valores monetários trocam `.` por `,` — senão "189.2"
 * entra como texto e não soma.
 */
export function toCsv<T>(columns: Array<ExportColumn<T>>, rows: T[]): string {
  const header = columns.map((column) => csvCell(column.header)).join(";");
  const body = rows.map((row) =>
    columns.map((column) => csvCell(cellToText(column.cell(row), ","))).join(";"),
  );
  return [header, ...body].join("\r\n");
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
export function toXlsx<T>(
  columns: Array<ExportColumn<T>>,
  rows: T[],
  sheetName: string,
  modified?: Date,
): Uint8Array {
  const cells: XlsxCell[][] = rows.map((row) =>
    columns.map((column): XlsxCell => {
      const cell = column.cell(row);

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
    sheetName,
    columns: columns.map((column) => ({ header: column.header, width: column.width })),
    rows: cells,
    modified,
  });
}

/** Nome do arquivo baixado, com a data para não sobrescrever o anterior. */
export function exportFileName(
  base: string,
  extension: "csv" | "xlsx",
  now: Date = new Date(),
): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return `${base}-${stamp}.${extension}`;
}
