/**
 * Gerador de arquivos .xlsx (Excel), sem dependência externa.
 *
 * POR QUE ESCREVER EM VEZ DE INSTALAR: as bibliotecas de planilha do
 * ecossistema (SheetJS, ExcelJS) pesam entre 800 KB e 1 MB — mais do que o
 * bundle inteiro desta aplicação — para resolver leitura de arquivos,
 * fórmulas, gráficos e formatos legados que aqui nunca serão usados. O que
 * esta tela precisa é escrever UMA aba de texto, número e data. Isso cabe
 * no que está abaixo.
 *
 * O QUE É UM .xlsx: um arquivo ZIP com alguns XMLs dentro (padrão OOXML).
 * As partes obrigatórias mínimas são o mapa de tipos, dois arquivos de
 * relacionamento, a pasta de trabalho e a planilha; `styles.xml` entra
 * porque sem ele não há como marcar uma célula como data ou moeda — o
 * número apareceria cru, tipo 46280.
 *
 * O ZIP é gravado com método STORE (sem compressão). Compactar exigiria
 * um DEFLATE, e o ganho não compensa: são alguns KB de XML que o Excel lê
 * igual.
 */

/* ------------------------------------------------------------------ */
/* Modelo de células                                                   */
/* ------------------------------------------------------------------ */

export type XlsxCell =
  | { kind: "text"; value: string }
  | { kind: "number"; value: number }
  /** Número com duas casas — a formatação de exibição é do Excel/locale. */
  | { kind: "money"; value: number }
  /** Instante; gravado como data de verdade, para ordenar e filtrar. */
  | { kind: "date"; value: Date }
  | { kind: "empty" };

export interface XlsxColumn {
  header: string;
  /** Largura em caracteres; sem ela o Excel corta o cabeçalho. */
  width?: number;
}

/* ------------------------------------------------------------------ */
/* Índices de estilo definidos em styles.xml (ordem do <cellXfs>)      */
/* ------------------------------------------------------------------ */

// O índice 0 é o estilo neutro do Excel e por isso nunca é escrito: uma
// célula sem `s` já cai nele.
const STYLE_HEADER = 1;
const STYLE_DATE = 2;
const STYLE_MONEY = 3;

/* ------------------------------------------------------------------ */
/* XML                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Escapa para XML e remove caracteres de controle.
 *
 * Os campos de texto livre da API (como `unsettled_reason`) podem trazer
 * qualquer byte; um caractere de controle não é representável em XML 1.0 e
 * faria o Excel recusar o arquivo inteiro como corrompido.
 */
function escapeXml(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 0 → A, 25 → Z, 26 → AA. O Excel endereça coluna por letra. */
export function columnLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/**
 * Data → número de série do Excel.
 *
 * A contagem começa em 30/12/1899 (o 25569 é o deslocamento até a época
 * Unix) e o fuso é descontado de propósito: o Excel não guarda fuso
 * nenhum, então gravar o instante em UTC faria um pedido das 22h aparecer
 * no dia seguinte. O que vai para a célula é a hora local, a mesma que a
 * tela mostra.
 */
export function excelSerial(date: Date): number {
  const localMs = date.getTime() - date.getTimezoneOffset() * 60_000;
  return localMs / 86_400_000 + 25569;
}

function cellXml(reference: string, cell: XlsxCell): string {
  switch (cell.kind) {
    case "empty":
      return "";
    case "text":
      // inlineStr evita a tabela de strings compartilhadas, que só
      // compensaria com muita repetição.
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
    case "number":
      return `<c r="${reference}"><v>${cell.value}</v></c>`;
    case "money":
      return `<c r="${reference}" s="${STYLE_MONEY}"><v>${cell.value}</v></c>`;
    case "date":
      return `<c r="${reference}" s="${STYLE_DATE}"><v>${excelSerial(cell.value)}</v></c>`;
  }
}

function sheetXml(columns: XlsxColumn[], rows: XlsxCell[][]): string {
  const lastColumn = columnLetter(Math.max(columns.length - 1, 0));
  const lastRow = rows.length + 1;

  const cols = columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 18}" customWidth="1"/>`,
    )
    .join("");

  const header = columns
    .map(
      (column, index) =>
        `<c r="${columnLetter(index)}1" s="${STYLE_HEADER}" t="inlineStr"><is><t>${escapeXml(column.header)}</t></is></c>`,
    )
    .join("");

  const body = rows
    .map((cells, rowIndex) => {
      const number = rowIndex + 2;
      const content = cells
        .map((cell, index) => cellXml(`${columnLetter(index)}${number}`, cell))
        .join("");
      return `<row r="${number}">${content}</row>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="A1:${lastColumn}${lastRow}"/>` +
    // Congela a primeira linha: sem isso o cabeçalho some ao rolar e a
    // conferência vira adivinhação de qual coluna é qual.
    `<sheetViews><sheetView workbookViewId="0">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData><row r="1">${header}</row>${body}</sheetData>` +
    `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` +
    `</worksheet>`
  );
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

/**
 * `numFmtId` acima de 163 é faixa livre para formatos próprios; abaixo
 * disso são os que o Excel já define. A data sai no formato brasileiro
 * porque é o que o resto da aplicação usa.
 */
const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="2">` +
  `<numFmt numFmtId="164" formatCode="dd/mm/yyyy\\ hh:mm"/>` +
  `<numFmt numFmtId="165" formatCode="#,##0.00"/>` +
  `</numFmts>` +
  `<fonts count="2">` +
  `<font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
  `</fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="4">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  // O Excel tolera a ausência, mas a especificação pede o estilo "Normal"
  // declarado; sem ele um leitor rigoroso avisa que falta o estilo padrão.
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** O nome da aba é limitado a 31 caracteres e proíbe : \\ / ? * [ ] */
function safeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\\\/?*[\]]/g, " ").trim();
  return (cleaned === "" ? "Planilha1" : cleaned).slice(0, 31);
}

function workbookXml(sheetName: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escapeXml(safeSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`
  );
}

/* ------------------------------------------------------------------ */
/* ZIP (método STORE)                                                  */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Empacota as partes num ZIP. A estrutura é: cada arquivo precedido do seu
 * cabeçalho local, depois o diretório central repetindo os mesmos dados, e
 * no fim o registro que diz onde o diretório começa — é por ele que o
 * leitor entra no arquivo.
 *
 * `modified` é injetável para que dois builds do mesmo conteúdo gerem
 * bytes idênticos nos testes.
 */
export function zipStore(entries: ZipEntry[], modified: Date = new Date()): Uint8Array {
  const encoder = new TextEncoder();

  // Data/hora no formato do MS-DOS, que é o que o ZIP guarda.
  const dosTime =
    (modified.getHours() << 11) | (modified.getMinutes() << 5) | (modified.getSeconds() >> 1);
  const dosDate =
    ((modified.getFullYear() - 1980) << 9) | ((modified.getMonth() + 1) << 5) | modified.getDate();

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); // assinatura
    localView.setUint16(4, 20, true); // versão necessária
    localView.setUint16(6, 0x0800, true); // nome em UTF-8
    localView.setUint16(8, 0, true); // método: STORE
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, size, true); // tamanho comprimido
    localView.setUint32(22, size, true); // tamanho original
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true); // sem campo extra
    local.set(name, 30);

    locals.push(local, entry.data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true); // versão que criou
    centralView.setUint16(6, 20, true); // versão necessária
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, size, true);
    centralView.setUint32(24, size, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true); // onde está o cabeçalho local
    central.set(name, 46);

    centrals.push(central);
    offset += local.length + size;
  }

  const centralSize = centrals.reduce((total, part) => total + part.length, 0);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const total = parts.reduce((sum, part) => sum + part.length, 0);

  const output = new Uint8Array(total);
  let position = 0;
  for (const part of parts) {
    output.set(part, position);
    position += part.length;
  }

  return output;
}

/* ------------------------------------------------------------------ */
/* Montagem final                                                      */
/* ------------------------------------------------------------------ */

export function buildXlsx({
  sheetName,
  columns,
  rows,
  modified,
}: {
  sheetName: string;
  columns: XlsxColumn[];
  rows: XlsxCell[][];
  modified?: Date;
}): Uint8Array {
  const encoder = new TextEncoder();
  const text = (value: string) => encoder.encode(value);

  return zipStore(
    [
      { name: "[Content_Types].xml", data: text(CONTENT_TYPES) },
      { name: "_rels/.rels", data: text(ROOT_RELS) },
      { name: "xl/workbook.xml", data: text(workbookXml(sheetName)) },
      { name: "xl/_rels/workbook.xml.rels", data: text(WORKBOOK_RELS) },
      { name: "xl/styles.xml", data: text(STYLES) },
      { name: "xl/worksheets/sheet1.xml", data: text(sheetXml(columns, rows)) },
    ],
    modified,
  );
}
