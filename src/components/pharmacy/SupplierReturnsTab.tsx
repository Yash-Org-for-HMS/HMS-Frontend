import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Tooltip,
} from "@mui/material";
import { AssignmentReturnRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { formatINR, formatDate } from "@/utils/format";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import ErrorState from "@/components/ErrorState";
import { apiErrorText } from "@/utils/apiError";

interface ReturnRow {
  supplierReturnId: string;
  returnNumber: string;
  supplierName: string;
  status: string;
  totalValue: string | number;
  creditedAmount: string | number | null;
  creditNoteRef: string | null;
  itemCount: number;
  notes: string | null;
  createdAt: string;
  items: { medicineName: string | null; batchNumber: string | null; quantity: number; reason: string }[];
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  RAISED: { label: "Awaiting supplier", color: SEMANTIC.warning },
  CREDITED: { label: "Credited", color: SEMANTIC.success },
  REJECTED: { label: "Rejected", color: SEMANTIC.danger },
};

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 150, p: 1.5, borderRadius: 2, bgcolor: `${color}14`, border: "1px solid", borderColor: `${color}44` }}>
      <Typography variant="h6" sx={{ fontWeight: 800, color, lineHeight: 1.2 }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
    </Box>
  );
}

/**
 * Debit notes raised against suppliers, and what came back.
 *
 * Claimed and recovered are shown apart on purpose: a supplier can credit less
 * than was asked for, or refuse, and a single "returns" figure would hide the
 * difference — which is the money the hospital actually lost.
 */
export default function SupplierReturnsTab() {
  const toast = useToast();
  const [settling, setSettling] = useState<ReturnRow | null>(null);
  const [status, setStatus] = useState("CREDITED");
  const [creditNoteRef, setCreditNoteRef] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<{ totals: any; rows: ReturnRow[] }>({
    queryKey: ["supplier-returns"],
    queryFn: async () => (await axiosInstance.get("/pharmacy/supplier-returns")).data.data,
  });

  const open = (r: ReturnRow) => {
    setSettling(r);
    setStatus("CREDITED");
    setCreditNoteRef("");
    // Pre-filled with the full claim: crediting in full is the common case, and
    // the number is right there to edit down when it is not.
    setAmount(String(Number(r.totalValue)));
  };

  const submit = async () => {
    if (!settling) return;
    setBusy(true);
    try {
      await axiosInstance.put(`/pharmacy/supplier-returns/${settling.supplierReturnId}/settle`, {
        status,
        creditNoteRef: creditNoteRef.trim() || undefined,
        creditedAmount: status === "CREDITED" ? Number(amount) : undefined,
      });
      toast.success(status === "CREDITED" ? "Credit recorded" : "Marked rejected");
      setSettling(null);
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Could not update this return"));
    } finally {
      setBusy(false);
    }
  };

  if (isError) return <Box sx={{ p: 3 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></Box>;
  if (isLoading || !data) return <Box sx={{ p: 3 }}><ListSkeleton rows={4} /></Box>;

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
        <Stat label="Claimed from suppliers" value={formatINR(data.totals.claimed)} color={SEMANTIC.info} />
        <Stat label="Recovered" value={formatINR(data.totals.recovered)} color={SEMANTIC.success} />
        <Stat label="Awaiting an answer" value={formatINR(data.totals.awaiting)} color={SEMANTIC.warning} />
      </Box>

      {data.rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
          No returns raised yet. Send a batch back from Current Stock instead of writing it off,
          and the claim appears here.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["Debit note", "Supplier", "Contents", "Claimed", "Outcome", ""].map((h, i) => (
                  <TableCell key={h || i} sx={{ fontWeight: 700, color: "text.secondary" }} align={h === "Claimed" ? "right" : "left"}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.rows.map((r) => {
                const st = STATUS_STYLE[r.status] ?? { label: r.status, color: NEUTRAL.muted };
                const shortfall = r.status === "CREDITED" ? Number(r.totalValue) - Number(r.creditedAmount ?? 0) : 0;
                return (
                  <TableRow key={r.supplierReturnId} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                      {r.returnNumber}
                      <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontFamily: "inherit" }}>
                        {formatDate(r.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>{r.supplierName}</TableCell>
                    <TableCell>
                      <Tooltip title={r.items.map((i) => `${i.quantity} × ${i.medicineName ?? "Medicine"} (${i.batchNumber}) — ${i.reason}`).join("; ")}>
                        <span>{r.items[0]?.medicineName ?? "—"}{r.itemCount > 1 ? ` +${r.itemCount - 1}` : ""}</span>
                      </Tooltip>
                      <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>{r.items[0]?.reason}</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatINR(r.totalValue)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={st.label} sx={{ height: 20, fontWeight: 700, bgcolor: `${st.color}22`, color: st.color }} />
                      {r.status === "CREDITED" && (
                        <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
                          {formatINR(r.creditedAmount ?? 0)}
                          {/* The gap between asked and paid is the real loss. */}
                          {shortfall > 0.005 ? ` · ${formatINR(shortfall)} short` : ""}
                          {r.creditNoteRef ? ` · ${r.creditNoteRef}` : ""}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {r.status === "RAISED" && (
                        <Button size="small" variant="outlined" onClick={() => open(r)} sx={{ textTransform: "none", fontWeight: 700 }}>
                          Record outcome
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {settling && (
        <Dialog open onClose={busy ? undefined : () => setSettling(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <AssignmentReturnRounded sx={{ color: SEMANTIC.info }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>What did the supplier do?</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {settling.returnNumber} · {formatINR(settling.totalValue)} claimed
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            <TextField select fullWidth size="small" label="Outcome" value={status}
              onChange={(e) => setStatus(e.target.value)} sx={{ mb: 2 }}>
              <MenuItem value="CREDITED">Credited</MenuItem>
              <MenuItem value="REJECTED">Rejected the claim</MenuItem>
            </TextField>
            {status === "CREDITED" && (
              <TextField fullWidth size="small" type="number" label="Amount credited" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputProps={{ min: 0, step: "0.01" }}
                helperText="Can be less than claimed — the difference is what the hospital lost"
                sx={{ mb: 2 }} />
            )}
            <TextField fullWidth size="small" label="Their credit note ref (optional)" value={creditNoteRef}
              onChange={(e) => setCreditNoteRef(e.target.value)} />
            {/* Said plainly, because it is the one thing that looks reversible
                and is not: the goods went back when the return was raised. */}
            <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 2 }}>
              The stock does not come back either way — it left when the return was raised.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setSettling(null)} color="inherit" disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
            <Button variant="contained" onClick={submit} disabled={busy} sx={{ textTransform: "none" }}>Save</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
