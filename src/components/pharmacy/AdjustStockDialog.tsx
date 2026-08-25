import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, Typography, Divider, Chip, Alert,
} from "@mui/material";
import { TuneRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { formatDateTime } from "@/utils/format";
import { SEMANTIC, NEUTRAL, BRAND } from "@/styles/accents";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";

interface BatchRow {
  inventoryId: string;
  batchNumber: string;
  expiryDate: string;
  availableQuantity: number;
  medicineName?: string | null;
}

interface Movement {
  inventoryTransactionId: string;
  transactionType: string;
  quantity: number;
  balanceAfter: number | null;
  referenceType: string | null;
  reason: string | null;
  performedByName: string | null;
  createdAt: string;
}

const TYPE_COLOR: Record<string, string> = {
  STOCK_IN: SEMANTIC.success,
  DISPENSE: BRAND.action,
  RETURN: SEMANTIC.info,
  ADJUSTMENT: SEMANTIC.warning,
};

/**
 * Correcting what a batch holds, and the history behind the number.
 *
 * Quantity used to be unchangeable except by selling or receiving, so expired
 * stock sat on the shelf for ever and breakage, loss and recounts had nowhere
 * to go. The count is stated, not adjusted by a delta: "there are 37" is how a
 * physical count is actually taken, and it cannot be applied twice by accident.
 */
export default function AdjustStockDialog({
  batch, open, onClose, onDone,
}: {
  batch: BatchRow;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [counted, setCounted] = useState<string>(String(batch.availableQuantity));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: reasons = [] } = useQuery<string[]>({
    queryKey: ["adjustment-reasons"],
    queryFn: async () => (await axiosInstance.get("/pharmacy/inventory/adjustment-reasons")).data.data,
    enabled: open,
    staleTime: Infinity,
  });

  const { data: history, isLoading, refetch } = useQuery<{ movements: Movement[] }>({
    queryKey: ["batch-movements", batch.inventoryId],
    queryFn: async () => (await axiosInstance.get(`/pharmacy/inventory/${batch.inventoryId}/movements`)).data.data,
    enabled: open,
  });

  const typed = Number(counted);
  const valid = Number.isInteger(typed) && typed >= 0;
  const delta = valid ? typed - batch.availableQuantity : 0;
  // "Other" on its own says nothing a month later, so it has to be written out.
  const finalReason = reason === "Other" ? note.trim() : [reason, note.trim()].filter(Boolean).join(" — ");
  const canSave = valid && delta !== 0 && finalReason.length >= 3;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await axiosInstance.post(`/pharmacy/inventory/${batch.inventoryId}/adjust`, {
        newQuantity: typed,
        reason: finalReason,
      });
      toast.success(delta < 0 ? `${Math.abs(delta)} written off` : `${delta} added back`);
      refetch();
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Could not adjust this batch"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <TuneRounded sx={{ color: SEMANTIC.warning }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Adjust stock</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {batch.medicineName ? `${batch.medicineName} · ` : ""}Batch {batch.batchNumber} · records {batch.availableQuantity}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Enter what is actually on the shelf. Everything else — sales, deliveries,
          returns — moves this number on its own; this is for what they cannot see.
        </Alert>

        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", mb: 2, flexWrap: "wrap" }}>
          <TextField
            size="small" type="number" label="Counted on the shelf" value={counted}
            onChange={(e) => setCounted(e.target.value)}
            inputProps={{ min: 0, step: 1 }}
            error={!valid}
            helperText={!valid ? "Whole units, zero or more" : " "}
            sx={{ width: 190 }}
          />
          {valid && delta !== 0 && (
            <Chip
              label={delta < 0 ? `${delta} written off` : `+${delta} added`}
              sx={{
                mt: 0.5, fontWeight: 700,
                bgcolor: delta < 0 ? `${SEMANTIC.danger}22` : `${SEMANTIC.success}22`,
                color: delta < 0 ? SEMANTIC.danger : SEMANTIC.success,
              }}
            />
          )}
        </Box>

        <TextField
          select fullWidth size="small" label="Reason" value={reason}
          onChange={(e) => setReason(e.target.value)} sx={{ mb: 1.5 }}
        >
          {reasons.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField
          fullWidth size="small" multiline rows={2}
          label={reason === "Other" ? "What happened (required)" : "Note (optional)"}
          value={note} onChange={(e) => setNote(e.target.value)}
        />

        <Divider sx={{ my: 2.5 }} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 1 }}>
          MOVEMENT HISTORY
        </Typography>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : !history?.movements?.length ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 2, textAlign: "center" }}>
            No movements recorded on this batch yet.
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 220, overflowY: "auto" }}>
            {history.movements.map((m) => (
              <Box key={m.inventoryTransactionId}
                sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.85, borderBottom: "1px solid", borderColor: "divider" }}>
                <Chip label={m.transactionType} size="small"
                  sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, minWidth: 96,
                    bgcolor: `${TYPE_COLOR[m.transactionType] ?? NEUTRAL.muted}22`,
                    color: TYPE_COLOR[m.transactionType] ?? NEUTRAL.muted }} />
                <Typography variant="body2" sx={{ width: 52, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                  color: m.quantity < 0 ? SEMANTIC.danger : SEMANTIC.success }}>
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }} noWrap>
                    {formatDateTime(m.createdAt)}
                    {m.performedByName ? ` · ${m.performedByName}` : ""}
                    {m.reason ? ` · ${m.reason}` : ""}
                  </Typography>
                </Box>
                {/* Blank on rows written before the ledger recorded a balance —
                    shown as a dash rather than a misleading zero. */}
                <Typography variant="caption" sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                  {m.balanceAfter == null ? "—" : `bal ${m.balanceAfter}`}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving} sx={{ textTransform: "none" }}>Close</Button>
        <Button variant="contained" onClick={save} disabled={!canSave || saving}
          startIcon={saving ? <HeartbeatLoader size={18} /> : <TuneRounded />}
          sx={{ textTransform: "none", bgcolor: SEMANTIC.warning }}>
          Record adjustment
        </Button>
      </DialogActions>
    </Dialog>
  );
}
