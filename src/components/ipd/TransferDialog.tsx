import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Stack, Typography,
} from "@mui/material";
import { SwapHorizRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";

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
  const [saving, setSaving] = useState(false);

  const { data: beds = [] } = useQuery<any[]>({
    queryKey: ["ipd-available-beds"],
    queryFn: async () => (await axiosInstance.get("/ipd/beds/available")).data.data,
    enabled: open,
  });

  const submit = async () => {
    if (!toBedId) return;
    setSaving(true);
    try {
      await axiosInstance.post(`/ipd/admissions/${admission.admissionId}/transfer`, { toBedId, reason: reason || undefined });
      toast.success("Patient transferred");
      onDone();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to transfer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <SwapHorizRounded sx={{ color: "#0891b2" }} /> Transfer Bed
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Currently in: <strong>{admission?.bed?.label || "—"}</strong>
          </Typography>
          <TextField select fullWidth required label="Move to bed" value={toBedId} onChange={(e) => setToBedId(e.target.value)}
            helperText={beds.length === 0 ? "No other beds available" : undefined}>
            <MenuItem value="" disabled>Select a bed</MenuItem>
            {beds.map((b) => <MenuItem key={b.bedId} value={b.bedId}>{b.label}{b.status === "RESERVED" ? " (reserved)" : ""}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} multiline rows={2} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !toBedId}
          startIcon={saving ? <HeartbeatLoader size={22} /> : <SwapHorizRounded />}
          sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" } }}>Transfer</Button>
      </DialogActions>
    </Dialog>
  );
}
