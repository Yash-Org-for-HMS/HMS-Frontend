import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Button, Chip, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { AddRounded, ArrowForwardRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { apiErrorText } from "@/utils/apiError";
import { formatDate } from "@/utils/format";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import ErrorState from "@/components/ErrorState";
import TransferDialog from "./TransferDialog";
import NewTransferDialog from "./NewTransferDialog";
import { TRANSFER_STATUS, type TransferRow, type TransferBranch, type TransferStatus } from "./transfers.types";

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 150, p: 1.5, borderRadius: 2, bgcolor: `${color}14`, border: "1px solid", borderColor: `${color}44` }}>
      <Typography variant="h6" sx={{ fontWeight: 800, color, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
    </Box>
  );
}

/**
 * Stock moving between this hospital's branches. Incoming and outgoing sit on
 * one list, because the question is always the same: what is waiting on me —
 * a request to pick and send, or a box to count in.
 */
export default function StockTransfersTab({ branches, shortReasons, here, medicines, onStockChanged }: {
  branches: TransferBranch[];
  shortReasons: string[];
  here: string | null;
  medicines: { medicineId: string; medicineName: string; genericName?: string }[];
  /** Dispatching and receiving change the shelf; the page refreshes its stock. */
  onStockChanged: () => void;
}) {
  const [status, setStatus] = useState<TransferStatus | "">("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery<{ totals: { awaitingDispatch: number; inTransit: number; unitsInTransit: number }; rows: TransferRow[] }>({
    queryKey: ["stock-transfers", status],
    queryFn: async () => (await axiosInstance.get("/pharmacy/stock-transfers", { params: status ? { status } : {} })).data.data,
  });

  const changed = () => { refetch(); onStockChanged(); };

  if (isError) return <Box sx={{ p: 3 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></Box>;
  if (isLoading || !data) return <Box sx={{ p: 3 }}><ListSkeleton rows={4} /></Box>;

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <Stat label="Waiting to be sent" value={String(data.totals.awaitingDispatch)} color={SEMANTIC.warning} />
        <Stat label="On the road" value={String(data.totals.inTransit)} color={SEMANTIC.info} />
        {/* Off the sending shelf and not yet on the receiving one — on neither
            branch's stock count until someone signs for it. */}
        <Stat label="Units in transit" value={String(data.totals.unitsInTransit)} color={NEUTRAL.muted} />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, mb: 1.5, flexWrap: "wrap" }}>
        <TextField id="transfer-status-filter" select size="small" label="Show" value={status} onChange={(e) => setStatus(e.target.value as TransferStatus | "")} sx={{ minWidth: 200 }} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
          <MenuItem value="">Every transfer</MenuItem>
          {(Object.keys(TRANSFER_STATUS) as TransferStatus[]).map((s) => <MenuItem key={s} value={s}>{TRANSFER_STATUS[s].label}</MenuItem>)}
        </TextField>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreating(true)} sx={{ textTransform: "none", fontWeight: 600 }}>
          New transfer
        </Button>
      </Box>

      {data.rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
          {status ? "No transfers in this state." : "No transfers yet. Ask another branch for stock you are short of, or send it stock it is short of."}
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["Transfer", "Between", "Contents", "Status", ""].map((h, i) => (
                  <TableCell key={h || i} sx={{ fontWeight: 700, color: "text.secondary" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.map((r) => {
                const st = TRANSFER_STATUS[r.status];
                return (
                  <TableRow key={r.stockTransferId} hover sx={{ cursor: "pointer" }} onClick={() => setOpenId(r.stockTransferId)}>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                      {r.transferNumber}
                      <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontFamily: "inherit" }}>{formatDate(r.createdAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                        {r.fromBranchName} <ArrowForwardRounded sx={{ fontSize: 16, color: "text.secondary" }} /> {r.toBranchName}
                      </Box>
                      {r.direction && (
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                          {r.direction === "IN" ? "Coming to you" : "Going from you"}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {r.medicines} medicine{r.medicines === 1 ? "" : "s"} · {r.requested} asked
                      {r.status !== "REQUESTED" && r.status !== "CANCELLED" && (
                        <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
                          {r.sent} sent{r.received !== null ? ` · ${r.received} arrived` : ""}
                          {r.short ? <Box component="span" sx={{ color: SEMANTIC.danger, fontWeight: 700 }}>{` · ${r.short} short`}</Box> : null}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={st.label} sx={{ height: 20, fontWeight: 700, bgcolor: `${st.color}22`, color: st.color }} />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Button size="small" variant={r.canDispatch || r.canReceive ? "contained" : "text"} onClick={() => setOpenId(r.stockTransferId)} sx={{ textTransform: "none", fontWeight: 600 }}>
                        {r.canDispatch ? "Pick & send" : r.canReceive ? "Receive" : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {openId && (
        <TransferDialog stockTransferId={openId} shortReasons={shortReasons} onClose={() => setOpenId(null)} onChanged={changed} />
      )}
      {creating && <NewTransferDialog
        open
        onClose={() => setCreating(false)}
        branches={branches}
        here={here}
        medicines={medicines}
        onCreated={(t) => {
          setCreating(false);
          refetch();
          // Sending it yourself: straight on to picking the batches.
          if (t.canDispatch) setOpenId(t.stockTransferId);
        }}
      />}
    </Box>
  );
}
