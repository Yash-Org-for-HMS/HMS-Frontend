import { useState } from "react";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, Tooltip,
} from "@mui/material";
import { CheckCircleRounded, CancelRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import ErrorState from "@/components/ErrorState";
import { SEMANTIC } from "@/styles/accents";

/**
 * Bill voids waiting on an administrator: a bill with nothing collected on it,
 * voided with a medicine that did not come back to the pharmacy. Approving
 * cancels the bill and writes the medicine off in the stock ledger (with the
 * reason and the bill number); rejecting leaves the bill standing. The person
 * who raised it cannot approve it.
 */
export interface WriteOffLine {
  medicineId: string;
  medicineName: string;
  quantity: number;
  reason: string;
}

interface PendingVoid {
  requestId: string;
  invoiceId: string;
  invoiceNumber: string;
  netAmount: string;
  reason: string;
  writeOffs: WriteOffLine[];
  raisedBy?: string | null;
  raisedById?: string | null;
  raisedAt: string;
  patientName?: string | null;
  uhidNumber?: string | null;
}

/** The medicines a void writes off, one line each - shared with the refund rows. */
export function WriteOffList({ lines }: { lines: WriteOffLine[] }) {
  if (!lines.length) return null;
  return (
    <Box sx={{ mt: 0.5 }}>
      <Typography variant="caption" sx={{ display: "block", fontWeight: 700, color: SEMANTIC.danger }}>
        Writes off (not returned):
      </Typography>
      {lines.map((l) => (
        <Typography key={l.medicineId} variant="caption" sx={{ display: "block", color: "text.secondary" }}>
          {l.medicineName} x {l.quantity} - {l.reason}
        </Typography>
      ))}
    </Box>
  );
}

export default function VoidApprovals() {
  const toast = useToast();
  const { user } = useHospitalAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingVoid | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: rows = [], isLoading, isError, error, refetch } = useQuery<PendingVoid[]>({
    queryKey: ["void-approvals"],
    queryFn: async () => (await axiosInstance.get("/reception/billing/void-requests/pending")).data.data ?? [],
  });
  const isMine = (r: PendingVoid) => !!user?.id && r.raisedById === user.id;

  const approve = async (r: PendingVoid) => {
    try {
      setBusyId(r.requestId);
      const res = await axiosInstance.post(`/reception/billing/void-requests/${r.requestId}/approve`);
      toast.success(res.data?.message || "Void approved");
      await refetch();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not approve this void"));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejecting || rejectReason.trim().length < 3) return;
    try {
      setBusyId(rejecting.requestId);
      const res = await axiosInstance.post(`/reception/billing/void-requests/${rejecting.requestId}/reject`, { reason: rejectReason.trim() });
      toast.success(res.data?.message || "Void rejected");
      setRejecting(null);
      setRejectReason("");
      await refetch();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not reject this void"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Bill voids with medicines not returned</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        The bill stays open until you approve. Approving cancels it and writes the medicines off.
      </Typography>
      {isError ? (
        <ErrorState message={getApiErrorMessage(error, "Failed to load void requests")} onRetry={() => void refetch()} />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Invoice</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reason and medicines</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Raised by</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Decision</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={2} columns={5} />
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 3, textAlign: "center", color: "text.secondary" }}>No voids waiting.</TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.requestId} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.patientName || "-"}</Typography>
                      {r.uhidNumber && <Typography variant="caption" sx={{ color: "text.secondary" }}>{r.uhidNumber}</Typography>}
                    </TableCell>
                    <TableCell><Typography variant="body2">{r.invoiceNumber}</Typography></TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>{r.reason}</Typography>
                      <WriteOffList lines={r.writeOffs} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.raisedBy || "-"}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{new Date(r.raisedAt).toLocaleString("en-IN")}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title={isMine(r) ? "You raised this void - another administrator approves it" : ""}>
                          <span>
                            <Button size="small" variant="contained" startIcon={<CheckCircleRounded />}
                              disabled={busyId === r.requestId || isMine(r)} onClick={() => void approve(r)}
                              sx={{ textTransform: "none", fontWeight: 700 }}>
                              Approve
                            </Button>
                          </span>
                        </Tooltip>
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
        <DialogTitle sx={{ fontWeight: 800 }}>Reject this void</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {rejecting ? `${rejecting.invoiceNumber} stays as it is and nothing is written off.` : ""}
          </Typography>
          <TextField autoFocus fullWidth multiline rows={3} label="Reason (required)"
            value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRejecting(null)} color="inherit">Cancel</Button>
          <Button variant="contained" color="error" disabled={rejectReason.trim().length < 3 || busyId === rejecting?.requestId}
            onClick={() => void reject()} sx={{ textTransform: "none", fontWeight: 700 }}>
            Reject void
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
