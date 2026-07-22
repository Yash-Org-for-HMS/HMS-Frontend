import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, TextField,
  MenuItem, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { AddRounded, CallSplitRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import HeartbeatLoader from "../HeartbeatLoader";
import { useToast } from "@/providers/ToastContext";
import { ACCENTS } from "@/styles/accents";

interface ReferralDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Pre-select (and optionally lock) the patient — used from appointment/patient contexts. */
  prefilledPatientId?: string;
  prefilledFromDepartmentId?: string;
  lockPatient?: boolean;
  /** Shown read-only when the patient is locked and we can't list them in the dropdown. */
  patientLabel?: string;
}

/**
 * Create-a-referral dialog, reusable from the Referrals page and from anywhere a
 * patient is already in context (appointment row, patient profile). When
 * prefilledPatientId + lockPatient are passed, the patient is fixed.
 */
export default function ReferralDialog({
  open, onClose, onCreated, prefilledPatientId, prefilledFromDepartmentId, lockPatient, patientLabel,
}: ReferralDialogProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patientId: prefilledPatientId || "",
    referralType: "INTERNAL",
    fromDepartmentId: prefilledFromDepartmentId || "",
    toDepartmentId: "",
    externalFacility: "",
    externalContact: "",
    reason: "",
    notes: "",
  });

  // Re-seed when the prefill changes (e.g. opening for a different appointment).
  useEffect(() => {
    if (open) {
      setForm((f) => ({
        ...f,
        patientId: prefilledPatientId || f.patientId,
        fromDepartmentId: prefilledFromDepartmentId || f.fromDepartmentId,
      }));
    }
  }, [open, prefilledPatientId, prefilledFromDepartmentId]);

  const { data: dropdowns = { departments: [], patients: [] } } = useQuery({
    queryKey: ["appointment-dropdowns"],
    queryFn: async () => (await axiosInstance.get("/reception/appointments/dropdowns")).data.data,
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const isExternal = form.referralType === "EXTERNAL";
  const canSubmit = form.patientId && form.reason.trim().length > 0 &&
    (isExternal ? form.externalFacility.trim().length > 0 : !!form.toDepartmentId);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await axiosInstance.post("/reception/referrals", {
        patientId: form.patientId,
        referralType: form.referralType,
        fromDepartmentId: form.fromDepartmentId || undefined,
        toDepartmentId: isExternal ? undefined : form.toDepartmentId,
        externalFacility: isExternal ? form.externalFacility : undefined,
        externalContact: isExternal ? form.externalContact : undefined,
        reason: form.reason,
        notes: form.notes || undefined,
      });
      toast.success("Referral created");
      // Reset the editable fields so the dialog is clean if reopened.
      setForm((f) => ({ ...f, toDepartmentId: "", externalFacility: "", externalContact: "", reason: "", notes: "" }));
      onCreated();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to create referral"));
    } finally {
      setSaving(false);
    }
  };

  const matchedPatient = (dropdowns?.patients || []).find((p: any) => p.patientId === form.patientId);
  const lockedPatientName = matchedPatient
    ? `${matchedPatient.firstName} ${matchedPatient.lastName} — ${matchedPatient.uhidNumber}`
    : (patientLabel || "Selected patient");

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CallSplitRounded sx={{ color: "#06b6d4" }} /> New Referral
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            {lockPatient ? (
              <TextField fullWidth label="Patient" value={lockedPatientName} disabled
                helperText="Referring the patient from this record" />
            ) : (
              <TextField select fullWidth required label="Patient" value={form.patientId} onChange={(e) => set("patientId", e.target.value)}>
                <MenuItem value="" disabled>Select a patient</MenuItem>
                {(dropdowns?.patients || []).map((p: any) => (
                  <MenuItem key={p.patientId} value={p.patientId}>{p.firstName} {p.lastName} — {p.uhidNumber}</MenuItem>
                ))}
              </TextField>
            )}
          </Grid>

          <Grid size={{ xs: 12 }}>
            <ToggleButtonGroup exclusive size="small" value={form.referralType} onChange={(_, v) => v && set("referralType", v)}
              sx={{ "& .MuiToggleButton-root.Mui-selected": { bgcolor: ACCENTS.reception, color: "#fff", "&:hover": { bgcolor: ACCENTS.receptionDark } } }}>
              <ToggleButton value="INTERNAL" sx={{ textTransform: "none", px: 2 }}>Internal (department)</ToggleButton>
              <ToggleButton value="EXTERNAL" sx={{ textTransform: "none", px: 2 }}>External (facility)</ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth label="From department (optional)" value={form.fromDepartmentId} onChange={(e) => set("fromDepartmentId", e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {(dropdowns?.departments || []).map((d: any) => (
                <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {isExternal ? (
            <>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth required label="External facility" value={form.externalFacility} onChange={(e) => set("externalFacility", e.target.value)} placeholder="e.g. City Diagnostics" />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Facility contact (optional)" value={form.externalContact} onChange={(e) => set("externalContact", e.target.value)} placeholder="Phone / address" />
              </Grid>
            </>
          ) : (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth required label="To department" value={form.toDepartmentId} onChange={(e) => set("toDepartmentId", e.target.value)}>
                <MenuItem value="" disabled>Select a department</MenuItem>
                {(dropdowns?.departments || []).map((d: any) => (
                  <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>
                ))}
              </TextField>
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <TextField fullWidth required label="Reason" value={form.reason} onChange={(e) => set("reason", e.target.value)} multiline rows={2} placeholder="Why is the patient being referred?" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="Notes (optional)" value={form.notes} onChange={(e) => set("notes", e.target.value)} multiline rows={2} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !canSubmit}
          startIcon={saving ? <HeartbeatLoader size={22} /> : <AddRounded />}
          sx={{ bgcolor: ACCENTS.reception, "&:hover": { bgcolor: ACCENTS.receptionDark } }}>
          Create Referral
        </Button>
      </DialogActions>
    </Dialog>
  );
}
