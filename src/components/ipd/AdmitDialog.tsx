import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, TextField,
  MenuItem, Box, Switch, FormControlLabel, Typography, Divider,
} from "@mui/material";
import { LocalHotelRounded, PersonAddRounded, HealthAndSafetyRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";
import PatientForm from "../../pages/reception/PatientForm";
import { SCHEME_OPTIONS } from "../../pages/claims/claimMeta";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdmitted: () => void;
  prefilledPatientId?: string;
}

export default function AdmitDialog({ open, onClose, onAdmitted, prefilledPatientId }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [newPatientLabel, setNewPatientLabel] = useState("");
  const [form, setForm] = useState({
    patientId: prefilledPatientId || "", doctorId: "", bedId: "",
    admittingDiagnosis: "", reason: "", notes: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Insurance / scheme case — optional; captured here and turned into a claim
  // (linked to the new admission) so the pre-auth flow can start right away.
  const [insuranceOn, setInsuranceOn] = useState(false);
  const [ins, setIns] = useState({ schemeType: "INSURANCE", payerId: "", policyOrCardNumber: "", tpaName: "", estimatedCost: "" });
  const setI = (k: string, v: string) => setIns((f) => ({ ...f, [k]: v }));

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
  const { data: payers = [] } = useQuery<any[]>({
    queryKey: ["claim-payers"],
    queryFn: async () => (await axiosInstance.get("/claims/payers")).data.data,
    enabled: open && insuranceOn,
  });

  const canSubmit = form.patientId && form.bedId;

  const handleNewPatient = async (patientId: string, mrn: string) => {
    // Pull the fresh patient into the dropdown, then pre-select it.
    await qc.invalidateQueries({ queryKey: ["appointment-dropdowns"] });
    set("patientId", patientId);
    setNewPatientLabel(`New patient · ${mrn}`);
    setRegisterOpen(false);
    toast.success(`Registered ${mrn}`);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await axiosInstance.post("/ipd/admissions", {
        patientId: form.patientId,
        doctorId: form.doctorId || undefined,
        bedId: form.bedId,
        admittingDiagnosis: form.admittingDiagnosis || undefined,
        reason: form.reason || undefined,
        notes: form.notes || undefined,
      });
      const admissionId = res.data?.data?.admissionId;

      // If this is an insurance/scheme case, start the claim against the new
      // admission. A claim failure (e.g. permission) must not undo the admit —
      // warn but keep the admission.
      if (insuranceOn && admissionId) {
        try {
          await axiosInstance.post("/claims", {
            patientId: form.patientId,
            admissionId,
            schemeType: ins.schemeType,
            payerId: ins.payerId || undefined,
            policyOrCardNumber: ins.policyOrCardNumber || undefined,
            tpaName: ins.tpaName || undefined,
            estimatedCost: ins.estimatedCost ? Number(ins.estimatedCost) : undefined,
          });
          toast.success("Patient admitted & insurance claim started");
        } catch (claimErr: any) {
          toast.error(`Admitted, but couldn't start the claim: ${claimErr.response?.data?.message || "permission or validation error"}`);
        }
      } else {
        toast.success("Patient admitted");
      }
      onAdmitted();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to admit patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LocalHotelRounded sx={{ color: "#0891b2" }} /> Admit Patient
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <TextField select fullWidth required label="Patient" value={form.patientId} onChange={(e) => set("patientId", e.target.value)} disabled={!!prefilledPatientId}
                  helperText={newPatientLabel || undefined}>
                  <MenuItem value="" disabled>Select a patient</MenuItem>
                  {(dropdowns?.patients || []).map((p: any) => (
                    <MenuItem key={p.patientId} value={p.patientId}>{p.firstName} {p.lastName} — {p.uhidNumber}</MenuItem>
                  ))}
                </TextField>
                {!prefilledPatientId && (
                  <Button variant="outlined" startIcon={<PersonAddRounded />} onClick={() => setRegisterOpen(true)}
                    sx={{ whiteSpace: "nowrap", mt: 0.25, borderColor: "divider", color: "text.primary" }}>New</Button>
                )}
              </Box>
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

            {/* Insurance / scheme — optional, starts a claim on admit */}
            <Grid size={{ xs: 12 }}>
              <Divider sx={{ mb: 1 }} />
              <FormControlLabel
                control={<Switch checked={insuranceOn} onChange={(e) => setInsuranceOn(e.target.checked)} />}
                label={<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><HealthAndSafetyRounded fontSize="small" sx={{ color: "#0891b2" }} /><Typography variant="body2" sx={{ fontWeight: 600 }}>Insurance / government-scheme case</Typography></Box>}
              />
            </Grid>
            {insuranceOn && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField select fullWidth label="Scheme" value={ins.schemeType} onChange={(e) => setI("schemeType", e.target.value)}>
                    {SCHEME_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField select fullWidth label="Payer / TPA" value={ins.payerId} onChange={(e) => setI("payerId", e.target.value)}>
                    <MenuItem value="">— None —</MenuItem>
                    {payers.map((p: any) => <MenuItem key={p.payerId} value={p.payerId}>{p.payerName}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="Policy / MAA card number" value={ins.policyOrCardNumber} onChange={(e) => setI("policyOrCardNumber", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth label="TPA name" value={ins.tpaName} onChange={(e) => setI("tpaName", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth type="number" label="Estimated cost (₹)" value={ins.estimatedCost} onChange={(e) => setI("estimatedCost", e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>A claim (status: Registered) is created and linked to this admission; manage pre-auth & documents from Insurance Claims.</Typography>
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={saving || !canSubmit}
            startIcon={saving ? <HeartbeatLoader size={22} /> : <LocalHotelRounded />}
            sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" } }}>Admit</Button>
        </DialogActions>
      </Dialog>

      {/* Inline new-patient registration (reuses the reception PatientForm modal). */}
      <Dialog open={registerOpen} onClose={() => setRegisterOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PersonAddRounded sx={{ color: "#0891b2" }} /> Register New Patient
        </DialogTitle>
        <DialogContent dividers>
          <PatientForm isModal onSuccess={handleNewPatient} onCancel={() => setRegisterOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
