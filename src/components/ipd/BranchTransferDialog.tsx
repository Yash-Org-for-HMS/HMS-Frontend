import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import { LocalShippingRounded } from "@mui/icons-material";
import type { AdmissionDetail, AdmissionRow } from "@/features/ipd/ipd.types";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatINR } from "@/utils/format";
import { useToast } from "@/providers/ToastContext";
import { BRAND, SEMANTIC } from "@/styles/accents";
import HeartbeatLoader from "../HeartbeatLoader";

interface Options {
  branches: { branchId: string; branchName: string; worksHere: boolean }[];
  doctors: { doctorId: string; name: string }[];
}
interface FreeBed { bedId: string; label: string; bedTypeName?: string }

/**
 * Move an in-patient to another branch of the hospital.
 *
 * The stay here closes exactly as a discharge would — its bill to date, at
 * this branch's prices and GSTIN, with the advance applied — and a linked stay
 * opens at the other branch, which bills its own days. What is left of the
 * advance goes across with the patient.
 */
export default function BranchTransferDialog({ admission, onClose, onDone }: {
  admission: AdmissionRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [toBranchId, setToBranchId] = useState("");
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [toBedId, setToBedId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: options, isLoading } = useQuery<Options>({
    queryKey: ["ipd-transfer-options", toBranchId],
    queryFn: async () => (await axiosInstance.get("/ipd/transfer-options", { params: toBranchId ? { toBranchId } : {} })).data.data,
    placeholderData: (prev) => prev,
  });
  const { data: detail } = useQuery<AdmissionDetail>({
    queryKey: ["ipd-admission", admission.admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admission.admissionId}`)).data.data,
  });
  const destination = options?.branches.find((b) => b.branchId === toBranchId);
  const here = options?.branches.find((b) => b.branchId === admission.branchId);
  // The receiving branch's free beds — asked of that branch, which only
  // someone who works there may do.
  const { data: beds = [], isLoading: bedsLoading } = useQuery<FreeBed[]>({
    queryKey: ["ipd-transfer-beds", toBranchId],
    queryFn: async () => (await axiosInstance.get("/ipd/beds/available", { headers: { "X-Branch-Id": toBranchId } })).data.data,
    enabled: !!destination?.worksHere,
  });

  // The doctor taking over: the current one if they see patients there.
  const doctors = options?.doctors ?? [];
  const chosenDoctor = doctorId ?? (doctors.some((d) => d.doctorId === admission.doctorId) ? admission.doctorId ?? "" : "");

  // The bill here to date, as the discharge screen estimates it.
  const pendingTax = (detail?.pendingCharges ?? []).reduce((s, c) => s + (Number(c.taxAmount) || 0), 0);
  const billHere = Number(detail?.estimatedBedCharge || 0) + Number(detail?.estimatedNursingCharge || 0) + Number(detail?.pendingChargesTotal || 0) + pendingTax;
  const deposit = Number(detail?.depositBalance ?? admission.depositBalance ?? 0);
  const carried = Math.max(deposit - billHere, 0);

  const submit = async () => {
    if (!toBranchId) { toast.error("Choose the branch the patient is going to."); return; }
    if (!chosenDoctor) { toast.error(`Choose the doctor who takes over at ${destination?.branchName ?? "the other branch"}.`); return; }
    setSaving(true);
    try {
      const r = await axiosInstance.post(`/ipd/admissions/${admission.admissionId}/transfer-branch`, {
        toBranchId, doctorId: chosenDoctor, toBedId: toBedId || undefined, reason: reason.trim() || undefined,
      });
      const d = r.data.data;
      toast.success(`Transferred to ${destination?.branchName}${d.invoice ? ` — bill ${d.invoice.invoiceNumber} raised here` : ""}`);
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Couldn't transfer the patient"));
    } finally {
      setSaving(false);
    }
  };

  const others = (options?.branches ?? []).filter((b) => b.branchId !== admission.branchId);

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LocalShippingRounded sx={{ color: BRAND.action }} /> Transfer to another branch
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && !options ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 5 }}><HeartbeatLoader size={44} /></Box>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {admission.patientName ?? "The patient"} leaves {here?.branchName ?? "this branch"}. The stay here closes with its bill to date and a new stay opens there, linked to this one.
            </Typography>

            <TextField id="transfer-to-branch" select label="Transfer to" value={toBranchId} onChange={(e) => { setToBranchId(e.target.value); setToBedId(""); setDoctorId(null); }}>
              {others.map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
            </TextField>

            {toBranchId && (
              <>
                <TextField id="transfer-doctor" select label={`Doctor taking over at ${destination?.branchName ?? ""}`} value={chosenDoctor}
                  onChange={(e) => setDoctorId(e.target.value)}
                  helperText={doctors.length ? undefined : "No doctor sees patients at that branch yet."}>
                  {doctors.map((d) => <MenuItem key={d.doctorId} value={d.doctorId}>{d.name}</MenuItem>)}
                </TextField>

                {destination?.worksHere ? (
                  <TextField id="transfer-bed" select label="Bed there" value={toBedId} onChange={(e) => setToBedId(e.target.value)}
                    SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}
                    helperText={bedsLoading ? "Loading free beds…" : beds.length ? undefined : "No bed is free there right now."}>
                    <MenuItem value="">No bed yet — assign one when they arrive</MenuItem>
                    {beds.map((b) => <MenuItem key={b.bedId} value={b.bedId}>{b.label}{b.bedTypeName ? ` · ${b.bedTypeName}` : ""}</MenuItem>)}
                  </TextField>
                ) : (
                  <Alert severity="info">
                    You don't work at {destination?.branchName}, so the patient arrives there awaiting a bed and they assign one.
                  </Alert>
                )}

                <TextField id="transfer-reason" label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={1}
                  placeholder="e.g. needs the ICU there" />

                <Divider />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>Bill here to date (estimate)</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatINR(billHere)}</Typography>
                </Box>
                {deposit > 0 && (
                  <>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>Advance held</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: BRAND.action }}>{formatINR(deposit)}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>Carried to {destination?.branchName}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: SEMANTIC.success }}>{formatINR(carried)}</Typography>
                    </Box>
                  </>
                )}
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Bed days and any new orders are finalised when you transfer. Orders still waiting at the pharmacy are cancelled, as at discharge.
                </Typography>
                {admission.payerType && admission.payerType !== "CASH" && (
                  <Alert severity="warning">
                    An open insurance claim closes with this branch's bill. Raise a new claim at {destination?.branchName} for the rest of the stay.
                  </Alert>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !toBranchId || !chosenDoctor}>
          {saving ? "Transferring…" : "Close stay here and transfer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
