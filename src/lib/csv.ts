/** Minimal CSV helpers for admin bulk import (header row required). */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    // Ignore trailing empty line
    if (row.length === 1 && row[0] === "" && rows.length > 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushCell();
      continue;
    }
    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }
  return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

export function recordsFromCsv(text: string): { headers: string[]; rows: Record<string, string>[] } | { error: string } {
  const table = parseCsv(text);
  if (table.length === 0) return { error: "CSV is empty." };
  const headers = table[0].map((header) => header.trim().toLowerCase());
  if (headers.some((header) => !header)) return { error: "CSV header row has an empty column name." };
  if (new Set(headers).size !== headers.length) return { error: "CSV header row has duplicate column names." };

  const rows = table.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = (cells[i] ?? "").trim();
    }
    return record;
  });
  return { headers, rows };
}

export function requireColumns(headers: string[], required: string[]) {
  const missing = required.filter((column) => !headers.includes(column));
  if (missing.length === 0) return null;
  return `CSV must include column(s): ${missing.join(", ")}.`;
}

export const MAX_IMPORT_ROWS = 200;
