import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, TextField,
  MenuItem,
} from "@mui/material";
import { LocalHotelRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdmitted: () => void;
  prefilledPatientId?: string;
}

export default function AdmitDialog({ open, onClose, onAdmitted, prefilledPatientId }: Props) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patientId: prefilledPatientId || "", doctorId: "", bedId: "",
    admittingDiagnosis: "", reason: "", notes: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const { data: dropdowns = { patients: [], doctors: [] } } = useQuery({
    queryKey: ["appointment-dropdowns"],
    queryFn: async () => (await axiosInstance.get("/reception/appointments/dropdowns")).data.data,
    enabled: open,
  });
  const { data: beds = [] } = useQuery<any[]>({
    queryKey: ["ipd-available-beds"],
    queryFn: async () => (await axiosInstance.get("/ipd/beds/available")).data.data,
    enabled: open,
  });

  const canSubmit = form.patientId && form.bedId;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await axiosInstance.post("/ipd/admissions", {
        patientId: form.patientId,
        doctorId: form.doctorId || undefined,
        bedId: form.bedId,
        admittingDiagnosis: form.admittingDiagnosis || undefined,
        reason: form.reason || undefined,
        notes: form.notes || undefined,
      });
      toast.success("Patient admitted");
      onAdmitted();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to admit patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LocalHotelRounded sx={{ color: "#0891b2" }} /> Admit Patient
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            <TextField select fullWidth required label="Patient" value={form.patientId} onChange={(e) => set("patientId", e.target.value)} disabled={!!prefilledPatientId}>
              <MenuItem value="" disabled>Select a patient</MenuItem>
              {(dropdowns?.patients || []).map((p: any) => (
                <MenuItem key={p.patientId} value={p.patientId}>{p.firstName} {p.lastName} — {p.uhidNumber}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth label="Admitting doctor" value={form.doctorId} onChange={(e) => set("doctorId", e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {(dropdowns?.doctors || []).map((d: any) => (
                <MenuItem key={d.doctorId} value={d.doctorId}>Dr. {d.user?.firstName || ""} {d.user?.lastName || ""}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth required label="Bed" value={form.bedId} onChange={(e) => set("bedId", e.target.value)}
              helperText={beds.length === 0 ? "No beds available — free or add one" : undefined}>
              <MenuItem value="" disabled>Select a bed</MenuItem>
              {beds.map((b) => (
                <MenuItem key={b.bedId} value={b.bedId}>{b.label}{b.dailyCharge ? ` — ₹${Number(b.dailyCharge).toFixed(0)}/day` : ""}{b.status === "RESERVED" ? " (reserved)" : ""}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="Admitting diagnosis" value={form.admittingDiagnosis} onChange={(e) => set("admittingDiagnosis", e.target.value)} multiline rows={2} placeholder="Provisional diagnosis on admission" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Reason" value={form.reason} onChange={(e) => set("reason", e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !canSubmit}
          startIcon={saving ? <HeartbeatLoader size={22} /> : <LocalHotelRounded />}
          sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" } }}>Admit</Button>
      </DialogActions>
    </Dialog>
  );
}
