/**
 * Bulk-import parser cho UI giống Quizlet: 2 separator riêng biệt
 *   - colSep: giữa term ↔ definition (Tab / Comma / Custom)
 *   - rowSep: giữa các thẻ (Newline / Semicolon / Custom)
 *
 * Trả về danh sách row đã parse + count để hiển thị preview.
 */

export type ColSepKind = "tab" | "comma" | "custom";
export type RowSepKind = "newline" | "semicolon" | "custom";

export interface ParsedRow {
  term: string;
  definition: string;
  warning?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  validCount: number;
  warningCount: number;
}

export function resolveColSep(kind: ColSepKind, custom: string): string {
  if (kind === "tab") return "\t";
  if (kind === "comma") return ",";
  return custom || "\t";
}

export function resolveRowSep(kind: RowSepKind, custom: string): RegExp {
  if (kind === "newline") return /\r?\n/;
  if (kind === "semicolon") return /;/;
  // Escape user-supplied separator for regex
  const escaped = (custom || "\n").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped);
}

export function parseImport(
  text: string,
  colSep: string,
  rowSep: RegExp,
): ParseResult {
  const chunks = text
    .split(rowSep)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const rows: ParsedRow[] = [];
  let valid = 0;
  let warn = 0;

  for (const chunk of chunks) {
    const idx = colSep === "\t" ? chunk.indexOf("\t") : chunk.indexOf(colSep);
    if (idx === -1) {
      rows.push({
        term: chunk,
        definition: "",
        warning: "Thiếu separator giữa term và nghĩa",
      });
      warn++;
      continue;
    }
    const term = chunk.slice(0, idx).trim();
    const definition = chunk.slice(idx + colSep.length).trim();
    if (!term || !definition) {
      rows.push({
        term,
        definition,
        warning: !term ? "Thiếu term" : "Thiếu nghĩa",
      });
      warn++;
      continue;
    }
    rows.push({ term, definition });
    valid++;
  }

  return { rows, validCount: valid, warningCount: warn };
}
