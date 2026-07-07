/**
 * Zero-dependency "export to Excel" for report tables.
 *
 * Produces a UTF-8 CSV (with BOM so Excel renders ₹ / unicode correctly) and
 * triggers a download. CSV opens directly in Excel on double-click with no
 * format prompt. Currency/number cells (e.g. "₹1,600", "1,234.50") are emitted
 * as bare numbers so Excel treats them as numbers (sortable / summable) rather
 * than text; dates, percentages and everything else are kept as-is text.
 */

function toCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  const s = String(v).trim();
  // Currency or plain number (optionally ₹-prefixed, with thousands commas) → numeric.
  const m = s.match(/^₹?\s*(-?[\d,]+(?:\.\d+)?)$/);
  if (m) return m[1].replace(/,/g, "");
  // Quote anything containing a comma, quote or newline.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function safeName(name: string): string {
  const base = name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 120) || "report";
  return base.endsWith(".csv") ? base : `${base}.csv`;
}

/** Download `head` + `rows` as a CSV that opens in Excel. */
export function exportTableToExcel(filename: string, head: string[], rows: (string | number)[][]): void {
  const lines = [head, ...rows].map((r) => r.map(toCell).join(","));
  const csv = "﻿" + lines.join("\r\n"); // BOM + CRLF for Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName(filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
