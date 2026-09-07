/**
 * "Export to PDF" for report tables — the printable counterpart to
 * {@link exportTableToExcel}.
 *
 * Excel is for working with the numbers; PDF is for the copy that gets filed,
 * signed or handed to somebody. So this produces a DOCUMENT, not a screenshot
 * of a grid: the hospital and branch it belongs to, the report's name, when it
 * was generated and by whom, and a page count — the things that make a printed
 * page defensible weeks later when nobody remembers which filter was set.
 *
 * jsPDF is loaded on demand. It is far larger than everything else in this
 * util folder, and most sessions never export a PDF, so importing it eagerly
 * would make every report screen slower to open in order to serve a minority
 * of clicks.
 */

/** Hospital identity for the header, read from the session rather than passed
 *  down through several dozen report components. */
function letterhead(): { hospital: string; branch: string | null; user: string | null } {
  const read = (k: string) => {
    try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
  };
  const h = read("hospitalInfo");
  const b = read("branchInfo");
  const u = read("hospitalUser") ?? read("user");
  const name = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();
  return { hospital: h?.name || "Hospital", branch: b?.name || null, user: name || u?.email || null };
}

/**
 * jsPDF's built-in Helvetica is WinAnsi-encoded and has no glyph for ₹, so it
 * renders as "¹" — every money column on every financial report would print
 * corrupted. Embedding a Unicode font would cost a few hundred kB on a chunk
 * that is already the largest thing we load, to gain one character.
 *
 * "Rs." is the ordinary way that character is written on Indian invoices when
 * a font cannot carry it, so the substitution is the conventional spelling
 * rather than a degradation. Other non-WinAnsi characters are transliterated
 * where there is an obvious equivalent and dropped otherwise, which is still
 * better than a wrong glyph — a wrong character reads as data.
 */
function pdfSafe(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    // Rupee sign; the optional space collapses both spellings to one.
    .replace(/\u20B9\s?/g, "Rs. ")
    .replace(/[\u2018\u2019]/g, "'")   // curly single quotes
    .replace(/[\u201C\u201D]/g, '"')   // curly double quotes
    .replace(/[\u2013\u2014]/g, "-")   // en / em dash
    .replace(/\u2022/g, "-")            // bullet
    .replace(/\u00A0/g, " ");           // non-breaking space
}

function safeName(name: string): string {
  const base = name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 120) || "report";
  return base.endsWith(".pdf") ? base : `${base}.pdf`;
}

/**
 * Render `head` + `rows` as a downloaded PDF.
 *
 * `subtitle` should carry the period the figures cover. A report page with no
 * date range on it is the classic way a correct number becomes a wrong one:
 * it gets filed, and six weeks later nobody can say what it covered.
 */
export async function exportTableToPdf(
  title: string,
  head: string[],
  rows: (string | number)[][],
  subtitle?: string,
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  // Wide tables get landscape; anything past ~6 columns is unreadable portrait.
  const landscape = head.length > 6;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const { hospital, branch, user } = letterhead();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(pdfSafe(hospital), 40, 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  if (branch) doc.text(pdfSafe(branch), 40, 58);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(pdfSafe(title), 40, branch ? 80 : 66);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(pdfSafe(subtitle), 40, branch ? 95 : 81);
  }

  const generated = `Generated ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`;
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text(user ? `${generated} · ${user}` : generated, pageWidth - 40, 42, { align: "right" });

  autoTable(doc, {
    head: [head.map(pdfSafe)],
    body: rows.map((r) => r.map(pdfSafe)),
    startY: (subtitle ? (branch ? 108 : 94) : (branch ? 92 : 78)),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 248, 252] },
    margin: { left: 40, right: 40, bottom: 40 },
    // Right-align money and plain numbers so columns of figures line up, which
    // is the whole reason anyone prints one of these.
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const raw = String(data.cell.raw ?? "").trim();
      if (/^₹?\s*-?[\d,]+(\.\d+)?%?$/.test(raw) && raw !== "") data.cell.styles.halign = "right";
    },
  });

  // Page numbers, added after the fact because the count is only known now.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Page ${i} of ${pages}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }

  doc.save(safeName(title));
}
