import { useState } from "react";
import type { BillingLookups } from "@/types";
import type { AdmissionRow } from "@/features/ipd/ipd.types";
import { BRAND } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatINR } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Stack, Typography, Box, InputAdornment,
} from "@mui/material";
import { SavingsRounded, UndoRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";


/** Only what the dialog reads - see DepositTarget below. */
export type DepositTarget = Pick<AdmissionRow, "admissionId" | "patientName" | "depositBalance" | "refundPending">;

interface Props {
  open: boolean;
  mode: "collect" | "refund";
  admission: DepositTarget;
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
  // Refunds already asked for are promised: only the rest can be asked for again.
  const pending = Number(admission?.refundPending || 0);
  const refundable = Math.max(0, held - pending);
  const negative = amount.trim() !== "" && !(Number(amount) > 0);

  const { data: lookups } = useQuery<BillingLookups>({
    queryKey: ["billing-lookups"],
    queryFn: async () => (await axiosInstance.get("/reception/billing/lookups")).data.data,
    enabled: open && !isRefund,
  });

  // A refund is a request an admin approves, and it needs a reason.
  const canSubmit = Number(amount) > 0 && (isRefund ? Number(amount) <= refundable + 0.005 && reason.trim().length >= 3 : true);

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
      toast.success(isRefund ? "Refund request sent for admin approval" : "Deposit collected");
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {isRefund ? <UndoRounded sx={{ color: "#8b5cf6" }} /> : <SavingsRounded sx={{ color: BRAND.action }} />}
        {isRefund ? "Request Deposit Refund" : "Collect Deposit"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>{admission?.patientName}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Held: {formatINR(held)}</Typography>
          </Box>
          <TextField fullWidth required type="number" label={`Amount (₹)`} value={amount} onChange={(e) => setAmount(e.target.value)}
            helperText={negative ? "Enter an amount above 0"
              : isRefund ? `Max refundable: ${formatINR(refundable)}${pending > 0 ? ` (${formatINR(pending)} already waiting for approval)` : ""}. An admin approves before the money is paid out.` : undefined}
            error={negative || (isRefund && Number(amount) > refundable + 0.005)}
            InputProps={isRefund && refundable > 0 ? {
              endAdornment: (
                <InputAdornment position="end">
                  <Button size="small" onClick={() => setAmount(String(refundable))}
                    sx={{ textTransform: "none", minWidth: 0, px: 1, fontWeight: 700, color: "#8b5cf6" }}>
                    Full
                  </Button>
                </InputAdornment>
              ),
            } : undefined} />
          {!isRefund && (
            <TextField select fullWidth label="Payment method" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
              <MenuItem value="">-</MenuItem>
              {/* An advance is the patient's money - an insurer pays the claim, never a deposit. */}
              {(lookups?.methods || []).filter((m) => !/insurance/i.test(m.methodName)).map((m) => <MenuItem key={m.paymentMethodId} value={m.paymentMethodId}>{m.methodName}</MenuItem>)}
            </TextField>
          )}
          <TextField fullWidth required={isRefund} label={isRefund ? "Reason for refund" : "Note (optional)"} value={reason} onChange={(e) => setReason(e.target.value)} multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !canSubmit}
          startIcon={saving ? <HeartbeatLoader size={22} /> : (isRefund ? <UndoRounded /> : <SavingsRounded />)}
          sx={{ bgcolor: isRefund ? "#8b5cf6" : BRAND.action, "&:hover": { bgcolor: isRefund ? BRAND.action : BRAND.actionDark } }}>
          {isRefund ? "Request refund" : "Collect"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
