import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, Typography, Alert,
} from "@mui/material";
import { AssignmentReturnRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { formatINR, formatDate } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";
import HeartbeatLoader from "@/components/HeartbeatLoader";

interface Batch {
  inventoryId: string;
  batchNumber: string;
  expiryDate: string;
  availableQuantity: number;
  medicineName?: string | null;
}

/**
 * Sending a batch back to the supplier for credit.
 *
 * Writing stock off was the only way to clear an expired or damaged batch, and
 * it eats the whole cost. Most of it is claimable — short-dated deliveries,
 * breakage in transit, the wrong item sent — so this raises the claim instead.
 *
 * The stock leaves now, because that is when the goods are physically
 * collected: leaving them on the shelf until a credit note arrives would keep
 * damaged or short-dated stock dispensable. Whether the supplier pays is
 * recorded later, and can come back for less than was claimed, or not at all.
 */
export default function SupplierReturnDialog({
  batch, open, onClose, onDone,
}: {
  batch: Batch;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [quantity, setQuantity] = useState(String(batch.availableQuantity));
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: reasons = [] } = useQuery<string[]>({
    queryKey: ["supplier-return-reasons"],
    queryFn: async () => (await axiosInstance.get("/pharmacy/supplier-returns/reasons")).data.data,
    enabled: open,
    staleTime: Infinity,
  });

  const qty = Number(quantity);
  const cost = Number(unitCost);
  const qtyOk = Number.isInteger(qty) && qty > 0 && qty <= batch.availableQuantity;
  const costOk = Number.isFinite(cost) && cost >= 0 && unitCost.trim() !== "";
  const canSave = qtyOk && costOk && reason.length >= 3;
  const claim = qtyOk && costOk ? qty * cost : 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await axiosInstance.post("/pharmacy/supplier-returns", {
        lines: [{ inventoryId: batch.inventoryId, quantity: qty, unitCost: cost, reason }],
        notes: notes.trim() || undefined,
      });
      toast.success(`${res.data?.data?.returnNumber ?? "Return"} raised — ${formatINR(claim)} claimed`);
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Could not raise this return"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <AssignmentReturnRounded sx={{ color: SEMANTIC.info }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Return to supplier</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {batch.medicineName ? `${batch.medicineName} · ` : ""}Batch {batch.batchNumber} · expires {formatDate(batch.expiryDate)} · {batch.availableQuantity} on hand
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          The stock leaves the shelf now, since this is when the goods go back.
          Whether the supplier credits it — and for how much — is recorded when
          they answer.
        </Alert>

        <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
          <TextField
            size="small" type="number" label="Units returning" value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputProps={{ min: 1, max: batch.availableQuantity, step: 1 }}
            error={quantity !== "" && !qtyOk}
            helperText={quantity !== "" && !qtyOk ? `1 to ${batch.availableQuantity}` : " "}
            sx={{ width: 170 }}
          />
          <TextField
            size="small" type="number" label="Cost you paid / unit" value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            inputProps={{ min: 0, step: "0.01" }}
            error={unitCost !== "" && !costOk}
            // Only the person with the supplier's invoice knows this; it is the
            // basis of the claim, so it is asked for rather than assumed.
            helperText="From the supplier's invoice"
            sx={{ width: 190 }}
          />
          {claim > 0 && (
            <Box sx={{ alignSelf: "center", px: 1.5, py: 0.75, borderRadius: 2, bgcolor: `${SEMANTIC.info}18` }}>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1 }}>Claiming</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: SEMANTIC.info }}>{formatINR(claim)}</Typography>
            </Box>
          )}
        </Box>

        <TextField
          select fullWidth size="small" label="Reason" value={reason}
          onChange={(e) => setReason(e.target.value)} sx={{ mb: 1.5 }}
          helperText="A supplier will not credit a claim with no reason on it"
        >
          {reasons.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
        </TextField>
        <TextField
          fullWidth size="small" multiline rows={2} label="Note (optional)"
          value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. collected by the rep, or the courier docket number"
        />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!canSave || saving}
          startIcon={saving ? <HeartbeatLoader size={18} /> : <AssignmentReturnRounded />}
          sx={{ textTransform: "none", bgcolor: SEMANTIC.info }}>
          Raise return
        </Button>
      </DialogActions>
    </Dialog>
  );
}
