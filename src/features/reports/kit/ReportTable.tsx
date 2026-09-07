import { useMemo, useState, type ReactNode } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  TableSortLabel, Button, TableContainer, TablePagination,
} from "@mui/material";
import { FileDownloadRounded, PictureAsPdfRounded } from "@mui/icons-material";
import Mascot from "@/components/Mascot";
import { exportTableToExcel } from "@/utils/exportExcel";

/**
 * Pull the PDF writer in only when someone asks for a PDF.
 *
 * Imported statically it is reachable from the eager graph, and Vite adds a
 * modulepreload for its ~116 kB jspdf chunk — downloaded by every visitor,
 * including the many who never export anything.
 */
const loadPdfExport = async (...args: Parameters<typeof import("@/utils/exportPdf")["exportTableToPdf"]>) => {
  const { exportTableToPdf } = await import("@/utils/exportPdf");
  return exportTableToPdf(...args);
};
import ReportTruncationNote from "./ReportTruncationNote";

export interface ReportColumn<T = any> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  /** Display renderer. */
  format?: (value: any, row: T) => ReactNode;
  /** Raw value for sorting/CSV (defaults to row[key]). */
  value?: (row: T) => string | number;
  sortable?: boolean;
  /**
   * Override the default clamp for a free-text column (a list of test names, a
   * remark). Cells are clamped to CELL_MAX_WIDTH by default so one verbose
   * value can't stretch the table; raise or lower it per column. The CSV export
   * is unaffected — it always carries the full value.
   */
  maxWidth?: number;
  /**
   * Pin this column to the right edge while the rest scrolls under it.
   *
   * A register wide enough to scroll puts its last column off-screen, which is
   * fatal for a row ACTION: measured on the advances report, the button sat
   * 67-707px past the edge at every width from 1920 down to 1280, so the one
   * control the report exists for could only be found by scrolling sideways.
   * Opt-in, so no existing table's layout changes.
   */
  sticky?: "right";
  /**
   * Leave this column out of the CSV. For a column that holds a control rather
   * than a value — exporting it adds a blank column to every row of the file.
   */
  exportable?: false;
}

/**
 * The shared report table: sortable columns + one-click CSV export, so every
 * report's tabular view looks and behaves the same. Replaces the ~7 copy-pasted
 * SimpleTable/DataTable implementations.
 */
/**
 * Default cell clamp. Cells don't wrap (see the Table sx below), so without a
 * ceiling a single long remark would drag its column — and the whole table —
 * to an absurd width. Anything shorter than this is unaffected.
 */
const CELL_MAX_WIDTH = 320;

export default function ReportTable<T = any>({ columns, rows, filename, title, maxHeight = 460, emptyText = "No data for this period.", truncated, totalRows, shownRows, pagination, exportRows }: {
  columns: ReportColumn<T>[];
  rows: T[];
  filename: string;
  /**
   * Page state, when the caller is showing one page of a larger report.
   * Omit it and the table behaves exactly as before.
   */
  pagination?: {
    page: number;            // zero-based, as MUI counts
    pageSize: number;
    totalRows: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    busy?: boolean;
  };
  /**
   * Where the EXPORT's rows come from when the table holds only a page.
   * Without it a download silently contains the page on screen — a file that
   * looks complete and is not.
   */
  exportRows?: () => Promise<Record<string, unknown>[]>;
  title?: string;
  maxHeight?: number;
  emptyText?: string;
  /** Detail-row cap signal from the report response — renders a notice when set. */
  truncated?: boolean;
  totalRows?: number;
  shownRows?: number;
}) {
  // Only long values get a hover tooltip; a tooltip on every short cell is noise.
  const cellTitle = (v: unknown) => {
    const t = v == null ? "" : String(v);
    return t.length > 28 ? t : undefined;
  };
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const raw = (col: ReportColumn<T>, row: T) => (col.value ? col.value(row) : (row as any)[col.key]);

  const stickySx = (c: ReportColumn<T>, header: boolean) =>
    c.sticky !== "right" ? undefined : {
      position: "sticky" as const,
      right: 0,
      // Above the scrolling cells; the sticky header already sits at 2.
      zIndex: header ? 3 : 1,
      bgcolor: "background.paper",
      borderLeft: "1px solid",
      borderLeftColor: "divider",
    };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = raw(col, a), bv = raw(col, b);
      const an = typeof av === "number", bn = typeof bv === "number";
      let cmp: number;
      if (an && bn) cmp = (av as number) - (bv as number);
      else cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
      return dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, columns, sortKey, dir]);

  const onSort = (key: string) => {
    if (sortKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setDir("desc"); }
  };

  // One shaping of the rows, two destinations — so the spreadsheet and the
  // printed page can never disagree about what the report contained.
  const exportMatrix = (source: T[] = sorted) => {
    const cols = columns.filter((c) => c.exportable !== false);
    return {
      head: cols.map((c) => c.label),
      matrix: source.map((row) => cols.map((c) => {
        const v = raw(c, row);
        return typeof v === "number" ? v : String(v ?? "");
      })),
    };
  };

  const [exporting, setExporting] = useState<"" | "excel" | "pdf">("");

  // A paged table holds one page, so the export fetches the whole report
  // first. Unpaged tables already have everything and skip the round trip.
  const runExport = async (kind: "excel" | "pdf") => {
    if (exporting) return;
    setExporting(kind);
    try {
      const all = exportRows ? await exportRows() : sorted;
      const { head, matrix } = exportMatrix(all as T[]);
      const period = truncated
        ? `Showing ${(shownRows ?? 0).toLocaleString()} of ${(totalRows ?? 0).toLocaleString()} rows`
        : undefined;
      if (kind === "excel") exportTableToExcel(filename, head, matrix);
      else await loadPdfExport(title || filename, head, matrix, period);
    } finally {
      setExporting("");
    }
  };

  return (
    <Paper elevation={0} sx={{ borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.5, gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Button size="small" startIcon={<FileDownloadRounded />} onClick={() => void runExport("excel")} disabled={!rows.length || !!exporting}>
            {exporting === "excel" ? "Preparing…" : "Export CSV"}
          </Button>
          <Button size="small" startIcon={<PictureAsPdfRounded />} onClick={() => void runExport("pdf")} disabled={!rows.length || !!exporting}>
            {exporting === "pdf" ? "Preparing…" : "PDF"}
          </Button>
        </Box>
      </Box>
      {truncated && (
        <Box sx={{ px: 2.5, pb: 1.5 }}>
          <ReportTruncationNote truncated={truncated} totalRows={totalRows} shownRows={shownRows} />
        </Box>
      )}
      {rows.length === 0 ? (
        <Box sx={{ py: 4 }}><Mascot pose="nothing-here-yet" subtitle={emptyText} size={110} /></Box>
      ) : (
        <TableContainer sx={{ maxHeight }}>
          {/* Cells don't wrap by default. Squeezed into the container, a wide
              register compressed every column to a similar width, so dates,
              UHIDs and even the header "No. of tests" broke across lines while
              one long cell stretched its row to twice the height of its
              neighbours. Letting the table take its natural width and scroll
              inside the card keeps rows uniform and scannable. */}
          <Table stickyHeader size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
            <TableHead>
              <TableRow>
                {columns.map((c) => (
                  <TableCell key={c.key} align={c.align || "left"} sortDirection={sortKey === c.key ? dir : false} sx={stickySx(c, true)}>
                    {c.sortable === false ? c.label : (
                      <TableSortLabel active={sortKey === c.key} direction={sortKey === c.key ? dir : "desc"} onClick={() => onSort(c.key)}>
                        {c.label}
                      </TableSortLabel>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((row, i) => (
                <TableRow key={i} hover>
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      align={c.align || "left"}
                      title={cellTitle((row as any)[c.key])}
                      sx={{
                        fontVariantNumeric: c.align === "right" ? "tabular-nums" : undefined,
                        maxWidth: c.maxWidth ?? CELL_MAX_WIDTH,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        ...stickySx(c, false),
                      }}
                    >
                      {c.format ? c.format((row as any)[c.key], row) : (row as any)[c.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {pagination && pagination.totalRows > 0 && (
        <TablePagination
          component="div"
          count={pagination.totalRows}
          page={pagination.page}
          onPageChange={(_, p) => pagination.onPageChange(p)}
          rowsPerPage={pagination.pageSize}
          rowsPerPageOptions={[50, 100, 250]}
          onRowsPerPageChange={(e) => pagination.onPageSizeChange(Number(e.target.value))}
          sx={{ opacity: pagination.busy ? 0.6 : 1, borderTop: "1px solid", borderColor: "divider" }}
        />
      )}
    </Paper>
  );
}
