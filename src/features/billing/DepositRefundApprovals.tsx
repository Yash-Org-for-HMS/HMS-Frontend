import { useState } from "react";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack,
} from "@mui/material";
import { CheckCircleRounded, CancelRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import ErrorState from "@/components/ErrorState";
import { SEMANTIC } from "@/styles/accents";

/**
 * IPD advance (deposit) refunds waiting on an administrator. The ward desk
 * raises them; nothing leaves the deposit until one is approved here.
 */
interface PendingDepositRefund {
  requestId: string;
  amount: string;
  reason?: string | null;
  requestedAt: string;
  requestedByName?: string | null;
  patientName?: string | null;
  uhidNumber?: string | null;
  admissionNumber?: string | null;
  admissionStatus?: string | null;
}

const inr = (v: unknown) => `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DepositRefundApprovals() {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingDepositRefund | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: rows = [], isLoading, isError, error, refetch } = useQuery<PendingDepositRefund[]>({
    queryKey: ["ipd-deposit-refunds-pending"],
    queryFn: async () => (await axiosInstance.get("/ipd/deposit-refunds/pending")).data.data ?? [],
  });

  const approve = async (r: PendingDepositRefund) => {
    try {
      setBusyId(r.requestId);
      const res = await axiosInstance.post(`/ipd/deposit-refunds/${r.requestId}/approve`);
      toast.success(res.data?.message || "Deposit refund approved");
      await refetch();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not approve this refund"));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejecting || rejectReason.trim().length < 3) return;
    try {
      setBusyId(rejecting.requestId);
      const res = await axiosInstance.post(`/ipd/deposit-refunds/${rejecting.requestId}/reject`, { reason: rejectReason.trim() });
      toast.success(res.data?.message || "Deposit refund rejected");
      setRejecting(null);
      setRejectReason("");
      await refetch();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not reject this refund"));
    } finally {
      setBusyId(null);
    }
  };

  // A hospital without the IPD module has no deposits: say nothing rather than show an error.
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (isError && (status === 403 || status === 404)) return null;

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>IPD deposit refunds</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Advance refunds raised at the ward desk. The patient is paid only after you approve.
      </Typography>
      {isError ? (
        <ErrorState message={getApiErrorMessage(error, "Failed to load deposit refunds")} onRetry={() => void refetch()} />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Admission</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Raised by</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Decision</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={3} columns={6} />
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>No deposit refunds waiting.</TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.requestId} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.patientName || "-"}</Typography>
                      {r.uhidNumber && <Typography variant="caption" sx={{ color: "text.secondary" }}>{r.uhidNumber}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.admissionNumber || "-"}</Typography>
                      {r.admissionStatus && <Typography variant="caption" sx={{ color: "text.secondary" }}>{r.admissionStatus.toLowerCase()}</Typography>}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{inr(r.amount)}</TableCell>
                    <TableCell sx={{ maxWidth: 260 }}>{r.reason || "-"}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.requestedByName || "-"}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{new Date(r.requestedAt).toLocaleString("en-IN")}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" variant="contained" startIcon={<CheckCircleRounded />} disabled={busyId === r.requestId}
                          onClick={() => void approve(r)} sx={{ textTransform: "none", fontWeight: 700, bgcolor: SEMANTIC.success }}>
                          Approve
                        </Button>
                        <Button size="small" variant="outlined" color="error" startIcon={<CancelRounded />} disabled={busyId === r.requestId}
                          onClick={() => { setRejectReason(""); setRejecting(r); }} sx={{ textTransform: "none", fontWeight: 700 }}>
                          Reject
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Reject this deposit refund</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {rejecting ? `${inr(rejecting.amount)} for ${rejecting.patientName || "this patient"}. No money has been returned; the deposit stays held.` : ""}
          </Typography>
          <TextField autoFocus fullWidth multiline rows={3} label="Reason (required)"
            value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRejecting(null)} color="inherit">Cancel</Button>
          <Button variant="contained" color="error" disabled={rejectReason.trim().length < 3 || busyId === rejecting?.requestId}
            onClick={() => void reject()} sx={{ textTransform: "none", fontWeight: 700 }}>
            Reject refund
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
