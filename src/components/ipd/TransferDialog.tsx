import { useState } from "react";
import { BRAND } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Stack, Typography, Alert,
} from "@mui/material";
import { SwapHorizRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";
import SearchableSelect from "@/components/form/SearchableSelect";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  admission: any; // row with admissionId, bed?.label
}

export default function TransferDialog({ open, onClose, onDone, admission }: Props) {
  const toast = useToast();
  const [toBedId, setToBedId] = useState("");
  const [reason, setReason] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: beds = [] } = useQuery<any[]>({
    queryKey: ["ipd-available-beds"],
    queryFn: async () => (await axiosInstance.get("/ipd/beds/available")).data.data,
    enabled: open,
  });

  // A move into an ICU-type ward (its ward type requires transfer approval) names
  // the receiving consultant who accepted the patient; not within the same ward.
  const target = beds.find((b) => b.bedId === toBedId);
  const needsApproval = !!target?.needsTransferApproval && target.wardId !== admission?.bed?.wardId;
  const { data: doctors = [] } = useQuery<{ doctorId: string; name: string }[]>({
    queryKey: ["ipd-visit-doctors"],
    queryFn: async () => (await axiosInstance.get("/ipd/doctors")).data.data,
    enabled: open && needsApproval,
  });

  const submit = async () => {
    if (!toBedId || (needsApproval && !approvedBy)) return;
    setSaving(true);
    try {
      await axiosInstance.post(`/ipd/admissions/${admission.admissionId}/transfer`, { toBedId, reason: reason || undefined, approvedByDoctorId: needsApproval ? approvedBy : undefined });
      toast.success("Patient transferred");
      onDone();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to transfer"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <SwapHorizRounded sx={{ color: BRAND.action }} /> Transfer Bed
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Currently in: <strong>{admission?.bed?.label || "-"}</strong>
          </Typography>
          <SearchableSelect
            label="Move to bed" name="toBedId" required
            value={toBedId} onChange={(e) => setToBedId(e.target.value)}
            placeholder="Select a bed"
            searchPlaceholder="Search by ward, room or bed…"
            options={beds.map((b) => ({
              value: b.bedId,
              label: b.label,
              secondary: b.status === "RESERVED" ? "reserved" : undefined,
            }))}
            helperText={beds.length === 0 ? "No other beds available" : undefined}
          />
          {needsApproval && (
            <>
              <Alert severity="info">{target?.wardName} takes transfers only when the receiving doctor accepts the patient.</Alert>
              <SearchableSelect
                label="Approved by" name="approvedBy" required
                value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="Doctor who accepted the patient"
                searchPlaceholder="Search doctors…"
                options={doctors.map((d) => ({ value: d.doctorId, label: d.name }))}
              />
            </>
          )}
          <TextField fullWidth label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !toBedId || (needsApproval && !approvedBy)}
          startIcon={saving ? <HeartbeatLoader size={22} /> : <SwapHorizRounded />}
>Transfer</Button>
      </DialogActions>
    </Dialog>
  );
}
