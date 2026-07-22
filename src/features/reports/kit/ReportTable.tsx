import { useMemo, useState, type ReactNode } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  TableSortLabel, Button, TableContainer,
} from "@mui/material";
import { FileDownloadRounded } from "@mui/icons-material";
import Mascot from "@/components/Mascot";
import { exportTableToExcel } from "@/utils/exportExcel";

export interface ReportColumn<T = any> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  /** Display renderer. */
  format?: (value: any, row: T) => ReactNode;
  /** Raw value for sorting/CSV (defaults to row[key]). */
  value?: (row: T) => string | number;
  sortable?: boolean;
}

/**
 * The shared report table: sortable columns + one-click CSV export, so every
 * report's tabular view looks and behaves the same. Replaces the ~7 copy-pasted
 * SimpleTable/DataTable implementations.
 */
export default function ReportTable<T = any>({ columns, rows, filename, title, maxHeight = 460, emptyText = "No data for this period." }: {
  columns: ReportColumn<T>[];
  rows: T[];
  filename: string;
  title?: string;
  maxHeight?: number;
  emptyText?: string;
}) {
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
      {rows.length === 0 ? (
        <Box sx={{ py: 4 }}><Mascot pose="nothing-here-yet" subtitle={emptyText} size={110} /></Box>
      ) : (
        <TableContainer sx={{ maxHeight }}>
          <Table stickyHeader size="small">
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
                    <TableCell key={c.key} align={c.align || "left"} sx={{ fontVariantNumeric: c.align === "right" ? "tabular-nums" : undefined }}>
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
