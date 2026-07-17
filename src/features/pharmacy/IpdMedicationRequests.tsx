import { useState } from "react";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip,
} from "@mui/material";
import { CheckCircleRounded, CancelRounded, LocalPharmacyRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { formatINR } from "@/utils/format";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import PharmacyPage from "./components/PharmacyPage";
import { ListSkeleton } from "@/components/TableRowsSkeleton";

export default function IpdMedicationRequests() {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<any>(null);
  const [reason, setReason] = useState("");

  const { data: requests = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["ipd-medication-requests"],
    queryFn: async () => (await axiosInstance.get("/pharmacy/ipd-medication-requests", { params: { status: "REQUESTED" } })).data.data,
  });

  const confirm = async (r: any) => {
    setBusyId(r.ipMedOrderId);
    try {
      await axiosInstance.post(`/pharmacy/ipd-medication-requests/${r.ipMedOrderId}/confirm`);
      toast.success(`${r.medicineName} dispensed for ${r.patientName || "patient"}`);
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to confirm this request"));
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async () => {
    if (!rejecting || !reason.trim()) return;
    setBusyId(rejecting.ipMedOrderId);
    try {
      await axiosInstance.post(`/pharmacy/ipd-medication-requests/${rejecting.ipMedOrderId}/cancel`, { reason: reason.trim() });
      toast.success("Request rejected");
      setRejecting(null);
      setReason("");
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to reject this request"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PharmacyPage
      title="IPD Medication Requests"
      subtitle="Medicines the ward has requested for admitted patients — confirm to dispense (deducts stock), or reject with a reason."
      icon={<LocalPharmacyRounded fontSize="large" sx={{ color: "#4F46E5" }} />}
    >
      <Paper sx={{ borderRadius: 4, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
        <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Bed</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Medicine</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Dosage / Frequency</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Qty</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Requested</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} sx={{ border: 0 }}><ListSkeleton rows={5} /></TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={8}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={8} sx={{ border: 0 }}>
                  <Mascot pose="all-caught-up" title="No pending requests" subtitle="Nothing waiting from the wards right now." size={110} />
                </TableCell></TableRow>
              ) : requests.map((r) => (
                <TableRow key={r.ipMedOrderId} hover>
                  <TableCell>
                    <Box sx={{ fontWeight: 600 }}>{r.patientName || "—"}</Box>
                    <Box sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{r.uhid}{r.admissionNumber ? ` · ${r.admissionNumber}` : ""}</Box>
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{r.bedLabel || "—"}</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: "#4F46E5" }}>{r.medicineName || "—"}</TableCell>
                  <TableCell>
                    {[r.dosage, r.frequency].filter(Boolean).join(" · ") || "—"}
                    {r.route ? <Chip label={r.route} size="small" sx={{ ml: 1, height: 18, fontSize: "0.7rem" }} /> : null}
                  </TableCell>
                  <TableCell align="center">{r.quantity}</TableCell>
                  <TableCell align="right">{formatINR(r.totalPrice)}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{r.orderedAt ? dayjs(r.orderedAt).format("DD MMM, HH:mm") : "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="contained" color="success" startIcon={busyId === r.ipMedOrderId ? <HeartbeatLoader size={18} /> : <CheckCircleRounded />}
                      disabled={busyId === r.ipMedOrderId} onClick={() => confirm(r)} sx={{ mr: 1, textTransform: "none" }}>
                      Confirm
                    </Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<CancelRounded />}
                      disabled={busyId === r.ipMedOrderId} onClick={() => { setRejecting(r); setReason(""); }} sx={{ textTransform: "none" }}>
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reject Request — {rejecting?.medicineName}</DialogTitle>
        <DialogContent dividers sx={{ pt: 3 }}>
          <TextField
            label="Reason" placeholder="e.g. Out of stock, wrong medicine…"
            value={reason} onChange={(e) => setReason(e.target.value)}
            fullWidth multiline rows={3} required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(null)}>Cancel</Button>
          <Button onClick={submitReject} variant="contained" color="error" disabled={!reason.trim() || busyId === rejecting?.ipMedOrderId}>
            Reject Request
          </Button>
        </DialogActions>
      </Dialog>
    </PharmacyPage>
  );
}
