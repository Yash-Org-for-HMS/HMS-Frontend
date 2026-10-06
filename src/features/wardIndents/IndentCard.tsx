import type { ReactNode } from "react";
import dayjs from "dayjs";
import { Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";
import SoftChip from "@/components/SoftChip";
import { BRAND, SEMANTIC } from "@/styles/accents";

/**
 * One ward indent (backend /ward-indents), as both sides see it: the ward that
 * asked and the store that issues. The store's view adds what is in store.
 */

export interface IndentLine {
  indentItemId: string;
  stockItemId: string;
  name: string;
  unit: string | null;
  requested: number;
  issued: number;
  remaining: number;
  inStore: number;
}
export interface Indent {
  indentId: string;
  wardId: string;
  wardName: string;
  status: "OPEN" | "PART_ISSUED" | "ISSUED" | "CANCELLED" | "CLOSED";
  notes: string | null;
  createdAt: string;
  closedAt: string | null;
  closeReason: string | null;
  requestedBy: string | null;
  items: IndentLine[];
}

const STATUS: Record<Indent["status"], { label: string; bg: string; color: string }> = {
  OPEN: { label: "Waiting for the store", bg: `${SEMANTIC.warning}22`, color: SEMANTIC.warningDark },
  PART_ISSUED: { label: "Partly issued", bg: `${BRAND.action}1a`, color: BRAND.action },
  ISSUED: { label: "Issued", bg: `${SEMANTIC.success}1f`, color: SEMANTIC.success },
  CANCELLED: { label: "Cancelled", bg: "rgba(100,116,139,0.12)", color: "#475569" },
  CLOSED: { label: "Closed short", bg: `${SEMANTIC.danger}1a`, color: SEMANTIC.danger },
};

export default function IndentCard({ indent, store = false, actions }: { indent: Indent; store?: boolean; actions?: ReactNode }) {
  const s = STATUS[indent.status];
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{store ? indent.wardName : `Raised ${dayjs(indent.createdAt).format("DD MMM, h:mm A")}`}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {store ? `Raised ${dayjs(indent.createdAt).format("DD MMM, h:mm A")}` : ""}{store && indent.requestedBy ? " · " : ""}{indent.requestedBy ? `by ${indent.requestedBy}` : ""}
          </Typography>
        </Box>
        <SoftChip label={s.label} bg={s.bg} color={s.color} />
        {actions}
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">Asked</TableCell>
              <TableCell align="right">Issued</TableCell>
              {store && <TableCell align="right">Still to send</TableCell>}
              {store && <TableCell align="right">In store</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {indent.items.map((l) => (
              <TableRow key={l.indentItemId}>
                <TableCell>{l.name}{l.unit ? <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}> · {l.unit}</Typography> : null}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{l.requested}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: l.issued ? 700 : 400 }}>{l.issued}</TableCell>
                {store && <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>{l.remaining}</TableCell>}
                {store && (
                  <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", color: l.inStore < l.remaining ? SEMANTIC.danger : "text.secondary", fontWeight: l.inStore < l.remaining ? 700 : 400 }}>
                    {l.inStore}{l.inStore < l.remaining ? " — short" : ""}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {indent.notes && <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>Note: {indent.notes}</Typography>}
      {indent.closeReason && <Typography variant="body2" sx={{ mt: 1, color: SEMANTIC.danger }}>Closed by the store: {indent.closeReason}</Typography>}
    </Paper>
  );
}
