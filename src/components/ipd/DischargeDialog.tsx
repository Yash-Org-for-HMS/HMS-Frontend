import { useState } from "react";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatINR } from "../../utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Stack, Typography, Box, IconButton, Divider,
} from "@mui/material";
import { LogoutRounded, AddRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../providers/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  admissionId: string;
}


export default function DischargeDialog({ open, onClose, onDone, admissionId }: Props) {
  const toast = useToast();
  const [summary, setSummary] = useState("");
  const [extras, setExtras] = useState<{ description: string; amount: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Pull the admission detail for the bed-charge preview.
  const { data: detail } = useQuery({
    queryKey: ["ipd-admission", admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}`)).data.data,
    enabled: open,
  });

  // An open insurance/scheme claim for this admission (if any) — its approved
  // amount tells us how much of this bill the payer covers vs the patient.
  const { data: claims = [] } = useQuery({
    queryKey: ["ipd-admission-claim", admissionId],
    queryFn: async () => (await axiosInstance.get("/claims", { params: { admissionId } })).data.data as any[],
    enabled: open,
  });
  const claim = claims[0];
  const claimApproved = claim ? Number(claim.preAuthApprovedAmount || 0) : 0;

  const bedCharge = Number(detail?.estimatedBedCharge || 0);
  const bedSegments: any[] = detail?.bedSegments || [];
  // Clinical charges (doctor visits / lab / radiology) accrued during the stay
  // that will roll onto the final bill — previewed so the total is honest.
  const pendingCharges: any[] = detail?.pendingCharges || [];
  const pendingTotal = Number(detail?.pendingChargesTotal || 0);
  const extrasTotal = extras.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const total = bedCharge + pendingTotal + extrasTotal;
  const deposit = Number(detail?.depositBalance || 0);
  const depositApplied = Math.min(deposit, total);
  const payable = Math.max(0, total - depositApplied);
  const depositRefundable = Math.max(0, deposit - depositApplied);
  // What the patient must cover after insurance approval (shortfall).
  const patientShortfall = claim ? Math.max(0, total - claimApproved) : null;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await axiosInstance.post(`/ipd/admissions/${admissionId}/discharge`, {
        dischargeSummary: summary || undefined,
        extraCharges: extras.filter((e) => e.description.trim() && Number(e.amount) > 0).map((e) => ({ description: e.description.trim(), amount: Number(e.amount) })),
      });
      const inv = res.data?.data?.invoice;
      toast.success(inv ? `Discharged — invoice ${inv.invoiceNumber} (${formatINR(inv.netAmount)})` : "Patient discharged");
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to discharge"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LogoutRounded sx={{ color: "#ef4444" }} /> Discharge — {detail?.patientName || "Patient"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
            {bedSegments.length > 1 ? (
              // Patient was transferred mid-stay — bill (and show) each bed at its own rate,
              // instead of one line for the whole stay at just the current bed's rate.
              <Stack spacing={0.75}>
                {bedSegments.map((seg, i) => (
                  <Box key={i} sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {seg.label} — {seg.days} day{seg.days === 1 ? "" : "s"} @ {formatINR(Number(seg.dailyCharge))}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(Number(seg.amount))}</Typography>
                  </Box>
                ))}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Bed charges total ({detail?.days ?? "—"} days)</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(bedCharge)}</Typography>
                </Box>
              </Stack>
            ) : (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Bed charges ({detail?.days ?? "—"} day{detail?.days === 1 ? "" : "s"})</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(bedCharge)}</Typography>
              </Box>
            )}
          </Box>

          {pendingCharges.length > 0 && (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 0.75 }}>
                Charges during stay (auto-added to bill)
              </Typography>
              <Stack spacing={0.5}>
                {pendingCharges.map((c, i) => (
                  <Box key={i} sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>{c.description}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(Number(c.totalPrice))}</Typography>
                  </Box>
                ))}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Clinical charges total</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(pendingTotal)}</Typography>
                </Box>
              </Stack>
            </Box>
          )}

          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Additional charges</Typography>
              <Button size="small" startIcon={<AddRounded />} onClick={() => setExtras((x) => [...x, { description: "", amount: "" }])} sx={{ textTransform: "none", color: "#0891b2" }}>Add</Button>
            </Box>
            {extras.map((e, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1, mb: 1 }}>
                <TextField size="small" fullWidth placeholder="Description" value={e.description} onChange={(ev) => setExtras((x) => x.map((r, ri) => ri === i ? { ...r, description: ev.target.value } : r))} />
                <TextField size="small" type="number" sx={{ width: 130 }} placeholder="Amount" value={e.amount} onChange={(ev) => setExtras((x) => x.map((r, ri) => ri === i ? { ...r, amount: ev.target.value } : r))} />
                <IconButton size="small" onClick={() => setExtras((x) => x.filter((_, ri) => ri !== i))}><DeleteOutlineRounded fontSize="small" /></IconButton>
              </Box>
            ))}
          </Box>

          {claim && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(59,130,246,0.08)", border: "1px solid", borderColor: "rgba(59,130,246,0.25)" }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#3b82f6", display: "block", mb: 0.5 }}>
                Insurance claim {claim.claimNumber}
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Pre-auth approved</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "#3b82f6" }}>{formatINR(claimApproved)}</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Patient shortfall (bill − approved)</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: patientShortfall! > 0 ? "#ef4444" : "#10b981" }}>{formatINR(patientShortfall || 0)}</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                The bill is auto-linked to this claim on discharge; record the payer settlement from the claim page.
              </Typography>
            </Box>
          )}

          <Divider />
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>Bill total</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(total)}</Typography>
          </Box>
          {deposit > 0 && (
            <>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Deposit held</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "#0891b2" }}>{formatINR(deposit)}</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Deposit applied</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "#8b5cf6" }}>- {formatINR(depositApplied)}</Typography>
              </Box>
            </>
          )}
          <Box sx={{ display: "flex", justifyContent: "space-between", pt: 0.5, borderTop: deposit > 0 ? "1px dashed" : "none", borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{deposit > 0 ? "Payable now" : "Final bill total"}</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: payable > 0 ? "#ef4444" : "#10b981" }}>{formatINR(payable)}</Typography>
          </Box>
          {depositRefundable > 0 && (
            <Typography variant="caption" sx={{ color: "#8b5cf6" }}>
              {formatINR(depositRefundable)} deposit will remain after this bill — refund it from the admission's ⋮ menu.
            </Typography>
          )}

          <TextField fullWidth label="Discharge summary" value={summary} onChange={(e) => setSummary(e.target.value)} multiline rows={3} placeholder="Condition at discharge, instructions, follow-up…" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          startIcon={saving ? <HeartbeatLoader size={22} /> : <LogoutRounded />}
          sx={{ bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" } }}>
          Discharge & Bill
        </Button>
      </DialogActions>
    </Dialog>
  );
}
