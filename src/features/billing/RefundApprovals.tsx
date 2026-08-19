import { useState } from "react";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack,
} from "@mui/material";
import { CheckCircleRounded, CancelRounded } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { SEMANTIC, BRAND } from "@/styles/accents";
import RefundReceiptDialog from "@/components/billing/RefundReceiptDialog";

/**
 * Refunds waiting on an administrator.
 *
 * A refund at or above the hospital's approval threshold returns no money when
 * the desk raises it — it lands here first. Until someone acts on this page the
 * patient has not been paid, so an empty queue is the healthy state and a
 * growing one is a backlog of people owed money.
 *
 * Raising and approving are deliberately different roles: a threshold the same
 * person can approve is not a control.
 */
interface PendingRefund {
  refundId: string;
  refundAmount: string;
  refundReason?: string | null;
  referenceNumber?: string | null;
  refundMethod?: string | null;
  raisedBy?: string | null;
  raisedAt?: string | null;
  invoiceId: string;
  invoiceNumber: string;
  patientName?: string | null;
  uhidNumber?: string | null;
}

const inr = (v: unknown) =>
  `₹${Number(v ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const when = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function RefundApprovals() {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingRefund | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  // Set the moment an approval succeeds: the money has gone back, so the
  // receipt is the next thing the desk needs.
  const [receiptFor, setReceiptFor] = useState<string | null>(null);

  const { data: rows = [], isLoading: loading, isError, error, refetch } = useQuery<PendingRefund[]>({
    queryKey: ["refund-approvals"],
    queryFn: async () => (await axiosInstance.get("/reception/billing/refunds/pending")).data?.data ?? [],
  });
  const load = () => refetch();

  const approve = async (r: PendingRefund) => {
    try {
      setBusyId(r.refundId);
      const res = await axiosInstance.post(`/reception/billing/refunds/${r.refundId}/approve`);
      toast.success(res.data?.message || "Refund approved");
      setReceiptFor(r.refundId);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not approve this refund"));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejecting || rejectReason.trim().length < 3) return;
    try {
      setBusyId(rejecting.refundId);
      const res = await axiosInstance.post(`/reception/billing/refunds/${rejecting.refundId}/reject`, {
        reason: rejectReason.trim(),
      });
      toast.success(res.data?.message || "Refund rejected");
      setRejecting(null);
      setRejectReason("");
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not reject this refund"));
    } finally {
      setBusyId(null);
    }
  };

  const total = rows.reduce((s, r) => s + Number(r.refundAmount ?? 0), 0);

  return (
    <Box>
      <PageHeader
        title="Refund Approvals"
        subtitle="Refunds raised at or above the approval threshold. No money goes back until you approve them."
      />

      {isError ? (
        <ErrorState message={getApiErrorMessage(error, "Failed to load pending refunds")} onRetry={() => void load()} />
      ) : (
        <>
          {!loading && rows.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, display: "flex", gap: 3, alignItems: "center" }}>
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.4 }}>AWAITING YOU</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>{rows.length}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.4 }}>TOTAL HELD</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: SEMANTIC.warning }}>{inr(total)}</Typography>
              </Box>
            </Paper>
          )}

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Patient</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Invoice</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Going back as</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Raised by</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Decision</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRowsSkeleton rows={4} columns={7} />
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ border: 0, py: 5 }}>
                      <Mascot
                        pose="nothing-here-yet"
                        title="Nothing waiting"
                        subtitle="No refunds need approval right now."
                        size={120}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.refundId} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.patientName || "—"}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{r.uhidNumber || ""}</Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2">{r.invoiceNumber}</Typography></TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{inr(r.refundAmount)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={r.refundMethod || "Original method"}
                          sx={{ bgcolor: `${BRAND.action}14`, color: BRAND.actionDark, fontWeight: 600 }}
                        />
                        {r.referenceNumber && (
                          <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>{r.referenceNumber}</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 240 }}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>{r.refundReason || "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{r.raisedBy || "—"}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{when(r.raisedAt)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small" variant="contained" startIcon={<CheckCircleRounded />}
                            disabled={busyId === r.refundId}
                            onClick={() => void approve(r)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small" variant="outlined" startIcon={<CancelRounded />}
                            disabled={busyId === r.refundId}
                            onClick={() => { setRejecting(r); setRejectReason(""); }}
                            sx={{ textTransform: "none", fontWeight: 700, color: SEMANTIC.danger, borderColor: `${SEMANTIC.danger}55` }}
                          >
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
        </>
      )}

      <RefundReceiptDialog refundId={receiptFor} open={!!receiptFor} onClose={() => setReceiptFor(null)} />

      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Reject this refund</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {rejecting ? `${inr(rejecting.refundAmount)} against ${rejecting.invoiceNumber}. No money has been returned, and rejecting frees it to be raised again.` : ""}
          </Typography>
          <TextField
            autoFocus fullWidth multiline rows={3}
            label="Reason (required)"
            placeholder="Why is this refund not being paid out?"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRejecting(null)} color="inherit">Cancel</Button>
          <Button
            variant="contained" color="error"
            disabled={rejectReason.trim().length < 3 || busyId === rejecting?.refundId}
            onClick={() => void reject()}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Reject refund
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
