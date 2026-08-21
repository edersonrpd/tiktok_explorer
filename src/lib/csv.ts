/** Utilitários para exportar tabelas como CSV/TSV. */

function escapeCsvCell(value: string): string {
  if (/[",\n\r;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** CSV com BOM (Excel só reconhece acentuação em UTF-8 com BOM). */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return "\uFEFF" + lines.join("\r\n");
}

/** TSV — ao colar em Excel/Sheets, cada campo cai numa coluna própria. */
export function toTsv(headers: string[], rows: string[][]): string {
  const clean = (cell: string) => cell.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  return [headers, ...rows].map((row) => row.map(clean).join("\t")).join("\n");
}

/** Dispara o download de um CSV já montado. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
