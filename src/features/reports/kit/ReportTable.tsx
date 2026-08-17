import { useMemo, useState, type ReactNode } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  TableSortLabel, Button, TableContainer,
} from "@mui/material";
import { FileDownloadRounded } from "@mui/icons-material";
import Mascot from "@/components/Mascot";
import { exportTableToExcel } from "@/utils/exportExcel";
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

export default function ReportTable<T = any>({ columns, rows, filename, title, maxHeight = 460, emptyText = "No data for this period.", truncated, totalRows, shownRows }: {
  columns: ReportColumn<T>[];
  rows: T[];
  filename: string;
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

  const doExport = () => {
    const head = columns.map((c) => c.label);
    const matrix = sorted.map((row) => columns.map((c) => {
      const v = raw(c, row);
      return typeof v === "number" ? v : String(v ?? "");
    }));
    exportTableToExcel(filename, head, matrix);
  };

  return (
    <Paper elevation={0} sx={{ borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.5, gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Button size="small" startIcon={<FileDownloadRounded />} onClick={doExport} disabled={!rows.length}>
          Export CSV
        </Button>
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
                  <TableCell key={c.key} align={c.align || "left"} sortDirection={sortKey === c.key ? dir : false}>
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
    </Paper>
  );
}
