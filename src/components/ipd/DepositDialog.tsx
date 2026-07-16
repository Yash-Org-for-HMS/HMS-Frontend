import { useState } from "react";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatINR } from "../../utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Stack, Typography, Box,
} from "@mui/material";
import { SavingsRounded, UndoRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";


interface Props {
  open: boolean;
  mode: "collect" | "refund";
  admission: any; // { admissionId, patientName, depositBalance }
  onClose: () => void;
  onDone: () => void;
}

export default function DepositDialog({ open, mode, admission, onClose, onDone }: Props) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const isRefund = mode === "refund";
  const held = Number(admission?.depositBalance || 0);

  const { data: lookups } = useQuery({
    queryKey: ["billing-lookups"],
    queryFn: async () => (await axiosInstance.get("/reception/billing/lookups")).data.data,
    enabled: open && !isRefund,
  });

  const canSubmit = Number(amount) > 0 && (isRefund ? Number(amount) <= held + 0.005 : true);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const path = isRefund ? `/ipd/admissions/${admission.admissionId}/deposit/refund` : `/ipd/admissions/${admission.admissionId}/deposit`;
      await axiosInstance.post(path, {
        amount: Number(amount),
        ...(isRefund ? {} : { paymentMethodId: methodId || undefined }),
        reason: reason || undefined,
      });
      toast.success(isRefund ? "Deposit refunded" : "Deposit collected");
      onDone();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {isRefund ? <UndoRounded sx={{ color: "#8b5cf6" }} /> : <SavingsRounded sx={{ color: "#0891b2" }} />}
        {isRefund ? "Refund Deposit" : "Collect Deposit"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>{admission?.patientName}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Held: {formatINR(held)}</Typography>
          </Box>
          <TextField fullWidth required type="number" label={`Amount (₹)`} value={amount} onChange={(e) => setAmount(e.target.value)}
            helperText={isRefund ? `Max refundable: ${formatINR(held)}` : undefined}
            error={isRefund && Number(amount) > held + 0.005} />
          {!isRefund && (
            <TextField select fullWidth label="Payment method" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {(lookups?.methods || []).map((m: any) => <MenuItem key={m.paymentMethodId} value={m.paymentMethodId}>{m.methodName}</MenuItem>)}
            </TextField>
          )}
          <TextField fullWidth label="Note (optional)" value={reason} onChange={(e) => setReason(e.target.value)} multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !canSubmit}
          startIcon={saving ? <HeartbeatLoader size={22} /> : (isRefund ? <UndoRounded /> : <SavingsRounded />)}
          sx={{ bgcolor: isRefund ? "#8b5cf6" : "#0891b2", "&:hover": { bgcolor: isRefund ? "#7c3aed" : "#0e7490" } }}>
          {isRefund ? "Refund" : "Collect"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
