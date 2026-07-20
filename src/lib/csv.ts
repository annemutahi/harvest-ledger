// Small CSV helper used across export buttons.

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type CsvRow = ReadonlyArray<unknown>;

/**
 * Serialize headers + rows to a CSV string. Extra trailer rows (totals, notes)
 * are appended verbatim so callers can align them against the header layout.
 */
export function toCsv(headers: CsvRow, rows: CsvRow[], trailer: CsvRow[] = []): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const r of rows) lines.push(r.map(escapeCell).join(","));
  if (trailer.length) {
    lines.push("");
    for (const r of trailer) lines.push(r.map(escapeCell).join(","));
  }
  return lines.join("\n");
}

/** Trigger a browser download for the given CSV payload. */
export function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** One-shot helper: build the CSV and immediately download it. */
export function exportCsv(
  filename: string,
  headers: CsvRow,
  rows: CsvRow[],
  trailer: CsvRow[] = [],
) {
  downloadCsv(filename, toCsv(headers, rows, trailer));
}

/** Timestamp suffix suitable for download filenames (YYYY-MM-DD). */
export function stampToday(): string {
  return new Date().toISOString().slice(0, 10);
}
