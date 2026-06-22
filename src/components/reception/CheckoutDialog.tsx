import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  TextField, Chip, CircularProgress, Alert,
} from "@mui/material";
import { LogoutRounded, PaymentRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import BillingModal from "../../pages/reception/BillingModal";

interface CheckoutToken {
  queueTokenId: string;
  appointmentId?: string | null;
  patientName?: string;
}

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  token: CheckoutToken | null;
  /** Called after a successful check-out so the caller can refresh the queue. */
  onDone: () => void;
}

/**
 * OPD check-out: finalize a visit. Shows the visit's billing status, lets staff
 * collect any outstanding payment (BillingModal) or check out with dues
 * acknowledged, plus an optional visit note. Calls POST /reception/queue/:id/checkout.
 */
export default function CheckoutDialog({ open, onClose, token, onDone }: CheckoutDialogProps) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  const apptId = token?.appointmentId;
  const { data: invoice, refetch, isFetching } = useQuery({
    queryKey: ["checkout-invoice", apptId],
    queryFn: async () => (await axiosInstance.get(`/reception/billing/appointments/${apptId}/invoice`)).data.data,
    enabled: open && !!apptId,
  });

  const totalPaid = invoice?.Payment?.reduce((s: number, p: any) => s + Number(p.paidAmount), 0) || 0;
  const balance = invoice ? Math.max(0, Number(invoice.netAmount) - totalPaid) : 0;
  const hasDues = balance > 0;

  const handleClose = () => {
    if (submitting) return;
    setNote("");
    onClose();
  };

  const handleCheckout = async () => {
    if (!token) return;
    try {
      setSubmitting(true);
      await axiosInstance.post(`/reception/queue/${token.queueTokenId}/checkout`, { confirmDues: true, note });
      toast.success("Patient checked out");
      setNote("");
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to check out");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !token) return null;

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Check out — {token.patientName || "Patient"}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Billing:</Typography>
              {isFetching && !invoice ? (
                <CircularProgress size={16} sx={{ color: "#06b6d4" }} />
              ) : !apptId ? (
                <Chip label="No invoice (walk-in)" size="small" sx={{ bgcolor: "action.hover", color: "text.secondary", fontWeight: 600 }} />
              ) : hasDues ? (
                <Chip label={`Dues ₹${balance.toFixed(2)}`} size="small" sx={{ bgcolor: "rgba(239,68,68,0.12)", color: "#ef4444", fontWeight: 700 }} />
              ) : (
                <Chip label="Settled" size="small" sx={{ bgcolor: "rgba(16,185,129,0.12)", color: "#10b981", fontWeight: 700 }} />
              )}
            </Box>

            {hasDues && (
              <Alert
                severity="warning"
                action={<Button color="inherit" size="small" startIcon={<PaymentRounded />} onClick={() => setShowBilling(true)}>Collect</Button>}
              >
                Outstanding balance of ₹{balance.toFixed(2)}. Collect payment, or check out with dues.
              </Alert>
            )}

            <TextField
              label="Visit note (optional)"
              placeholder="Anything to record about this visit…"
              multiline
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose} color="inherit" disabled={submitting}>Cancel</Button>
          <Button
            onClick={handleCheckout}
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <LogoutRounded />}
            sx={{ bgcolor: hasDues ? "#f59e0b" : "#10b981", "&:hover": { bgcolor: hasDues ? "#d97706" : "#059669" } }}
          >
            {hasDues ? "Check out with dues" : "Complete check-out"}
          </Button>
        </DialogActions>
      </Dialog>

      {showBilling && apptId && (
        <BillingModal
          open={showBilling}
          onClose={() => { setShowBilling(false); refetch(); }}
          appointmentId={apptId}
          patientName={token.patientName || "Patient"}
          appointmentDate={new Date().toISOString()}
        />
      )}
    </>
  );
}
