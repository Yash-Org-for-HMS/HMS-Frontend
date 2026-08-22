import type { ReactNode } from "react";
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  TableContainer, Button,
} from "@mui/material";
import { FileDownloadRounded } from "@mui/icons-material";
import { exportTableToExcel } from "@/utils/exportExcel";
import { BRAND } from "@/styles/accents";

/**
 * A pre-formatted report table: the caller has already turned its data into
 * header strings and rows of cells, and just wants them rendered with an Excel
 * button on top.
 *
 * This existed as five byte-for-byte copies — one each in the claim, doctor,
 * nurse, reception and platform report screens — which had already drifted:
 * the claims copy set its header type at 0.72rem against 0.75rem everywhere
 * else. One copy, so the next tweak lands on all five.
 *
 * Distinct from the sibling {@link ReportTable}, which takes raw row objects
 * plus column definitions and adds sorting, per-column formatting and cell
 * clamping. Prefer ReportTable for new report sections; this is for the many
 * existing call sites that hand over ready-made strings.
 */
export default function SimpleTable({
  title,
  head,
  rows,
  dense,
  note,
  accent = BRAND.action,
}: {
  title: string;
  head: string[];
  rows: (string | number)[][];
  dense?: boolean;
  note?: ReactNode;
  /** Excel-button colour. Defaults to the one action colour. */
  accent?: string;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {rows.length > 0 && (
          <Button size="small" startIcon={<FileDownloadRounded fontSize="small" />} onClick={() => exportTableToExcel(title, head, rows)}
            sx={{ textTransform: "none", color: accent }}>Excel</Button>
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
              {rows.map((r, ri) => (
                <TableRow key={ri} hover>
                  {r.map((c, ci) => (
                    <TableCell key={ci} align={ci === 0 ? "left" : "right"} sx={{ borderColor: "divider", color: ci === 0 ? "text.primary" : "text.secondary", fontWeight: ci === 0 ? 600 : 500 }}>{c}</TableCell>
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
