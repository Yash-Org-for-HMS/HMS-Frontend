import { useState, type ReactNode } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  TableContainer, Button, TablePagination,
} from "@mui/material";
import { FileDownloadRounded, ChevronRightRounded, PictureAsPdfRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
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
import { BRAND } from "@/styles/accents";

/**
 * A pre-formatted report table: the caller has already turned its data into
 * header strings and rows of cells, and just wants them rendered with an Excel
 * button on top.
 *
 * Was five copies across the report screens, already drifting (the claims one
 * set 0.72rem headers against 0.75rem elsewhere).
 *
 * Distinct from {@link ReportTable}, which takes row objects plus column
 * definitions and adds sorting and formatting. Prefer that for new sections;
 * this serves the many call sites that hand over ready-made strings.
 */
export default function SimpleTable({
  title,
  head,
  rows,
  dense,
  note,
  accent = BRAND.action,
  rowHref,
  period,
  exportRows,
  pagination,
}: {
  title: string;
  head: string[];
  rows: (string | number)[][];
  dense?: boolean;
  note?: ReactNode;
  /** Excel-button colour. Defaults to the one action colour. */
  accent?: string;
  /**
   * Where a row leads. Given the row and its index, return a path to the
   * register that explains it — or null for a row with nothing behind it.
   *
   * A summary row states a count and stops there, leaving the reader to go and
   * work out which records it counted. When this is set the row becomes the
   * way through to them.
   */
  rowHref?: (row: (string | number)[], index: number) => string | null;
  /**
   * The period the figures cover, printed under the title in the PDF. A
   * filed report page with no date range on it is how a correct number turns
   * into a wrong one — on screen the filter bar says it, on paper nothing does.
   */
  period?: string;
  /**
   * Where the EXPORT's rows come from, when the table on screen is only one
   * page of them. Without this an export silently contains whatever page the
   * reader happened to be on, which is the worst kind of wrong: a file that
   * looks complete and is not.
   */
  exportRows?: () => Promise<(string | number)[][]>;
  /**
   * Page state, when the caller is showing one page of a larger report.
   * Omit it and the table behaves exactly as before. Matches
   * {@link ReportTable}'s prop so the two page identically.
   */
  pagination?: {
    page: number;            // zero-based, as MUI counts
    pageSize: number;
    totalRows: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    busy?: boolean;
  };
}) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState<"" | "excel" | "pdf">("");

  // Paged tables fetch the full set first; unpaged ones already hold it.
  const run = async (kind: "excel" | "pdf") => {
    if (exporting) return;
    setExporting(kind);
    try {
      const all = exportRows ? await exportRows() : rows;
      if (kind === "excel") exportTableToExcel(title, head, all);
      else await loadPdfExport(title, head, all, period);
    } finally {
      setExporting("");
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {rows.length > 0 && (
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Button size="small" disabled={!!exporting} startIcon={<FileDownloadRounded fontSize="small" />} onClick={() => void run("excel")}
              sx={{ textTransform: "none", color: accent }}>{exporting === "excel" ? "Preparing…" : "Excel"}</Button>
            <Button size="small" disabled={!!exporting} startIcon={<PictureAsPdfRounded fontSize="small" />} onClick={() => void run("pdf")}
              sx={{ textTransform: "none", color: accent }}>{exporting === "pdf" ? "Preparing…" : "PDF"}</Button>
          </Box>
        )}
      </Box>
      {note && <Box sx={{ mb: 1.5 }}>{note}</Box>}
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 2, textAlign: "center" }}>No data in this range</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: dense ? 340 : 560 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {head.map((h, i) => (
                  <TableCell key={h} align={i === 0 ? "left" : "right"} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", borderColor: "divider", bgcolor: "background.paper" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, ri) => {
                const href = rowHref?.(r, ri) ?? null;
                return (
                  <TableRow
                    key={ri}
                    hover
                    onClick={href ? () => navigate(href) : undefined}
                    // Reachable by keyboard, and announced as a link — which is
                    // what activating it does.
                    tabIndex={href ? 0 : undefined}
                    role={href ? "link" : undefined}
                    onKeyDown={href ? (e) => {
                      if (e.key === "Enter") { e.preventDefault(); navigate(href); }
                    } : undefined}
                    sx={href ? { cursor: "pointer", "&:focus-visible": { outline: `2px solid ${accent}`, outlineOffset: -2 } } : undefined}
                  >
                    {r.map((c, ci) => (
                      <TableCell key={ci} align={ci === 0 ? "left" : "right"} sx={{ borderColor: "divider", color: ci === 0 ? "text.primary" : "text.secondary", fontWeight: ci === 0 ? 600 : 500 }}>
                        {ci === r.length - 1 && href ? (
                          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                            {c}
                            <ChevronRightRounded sx={{ fontSize: 16, color: accent }} />
                          </Box>
                        ) : c}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
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
