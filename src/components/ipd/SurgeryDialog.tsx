import { useState } from "react";
import { getApiErrorMessage } from "../../utils/apiError";
import { formatINR } from "../../utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Stack, Typography, Box, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, IconButton, Divider, Tooltip,
} from "@mui/material";
import {
  MedicalServicesRounded, AddRounded, CheckCircleRounded, CancelRounded, ReceiptLongRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../contexts/ConfirmContext";
import HeartbeatLoader from "../HeartbeatLoader";
import { validate, hasErrors, required, isNonNegativeNumber } from "../../utils/validation";

interface Props {
  open: boolean;
  onClose: () => void;
  admission: any; // { admissionId, patientId, patientName }
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Scheduled", color: "#f59e0b" },
  COMPLETED: { label: "Completed", color: "#10b981" },
  CANCELLED: { label: "Cancelled", color: "#64748b" },
};

const emptyForm = { procedureName: "", surgeryType: "MINOR", gradeId: "", surgeonId: "", surgeryDate: "", price: "", notes: "" };

export default function SurgeryDialog({ open, onClose, admission }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<{ procedureName?: string; price?: string }>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const surgeriesKey = ["ipd-admission-surgeries", admission?.admissionId];
  const { data: surgeries = [], isFetching, refetch } = useQuery<any[]>({
    queryKey: surgeriesKey,
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admission.admissionId}/surgeries`)).data.data,
    enabled: open && !!admission?.admissionId,
  });

  const { data: grades = [] } = useQuery<any[]>({
    queryKey: ["hospital-lookups", "surgeryGrade"],
    queryFn: async () => (await axiosInstance.get("/hospital/lookups?type=surgeryGrade")).data.data,
    enabled: open,
  });

  const { data: dropdowns = { doctors: [] } } = useQuery({
    queryKey: ["appointment-dropdowns"],
    queryFn: async () => (await axiosInstance.get("/reception/appointments/dropdowns")).data.data,
    enabled: open,
  });

  const invalidateBillingIfCharged = (invoiceId: string | null | undefined) => {
    if (invoiceId) qc.invalidateQueries({ queryKey: ["patient-billing", admission?.patientId] });
  };

  const submit = async () => {
    const found = validate(form, {
      procedureName: [required("Surgical details")],
      price: [isNonNegativeNumber],
    });
    if (hasErrors(found)) {
      setErrors(found);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await axiosInstance.post(`/ipd/admissions/${admission.admissionId}/surgeries`, {
        procedureName: form.procedureName.trim(),
        surgeryType: form.surgeryType,
        gradeId: form.gradeId || undefined,
        surgeonId: form.surgeonId || undefined,
        surgeryDate: form.surgeryDate || undefined,
        price: form.price ? Number(form.price) : undefined,
        notes: form.notes || undefined,
      });
      toast.success("Surgery added");
      setForm(emptyForm);
      refetch();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to add surgery"));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (surgeryId: string, status: "COMPLETED" | "CANCELLED") => {
    if (status === "CANCELLED") {
      const ok = await confirm({
        title: "Cancel surgery",
        message: "Are you sure you want to cancel this scheduled surgery?",
        confirmText: "Cancel surgery",
        destructive: true,
      });
      if (!ok) return;
    }
    setBusyId(surgeryId);
    try {
      const res = await axiosInstance.put(`/ipd/surgeries/${surgeryId}`, { status });
      toast.success(status === "COMPLETED" ? "Marked completed" : "Surgery cancelled");
      invalidateBillingIfCharged(res.data?.data?.invoiceId);
      refetch();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Failed to update surgery"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <MedicalServicesRounded sx={{ color: "#0891b2" }} /> Surgery Details
        {isFetching && <HeartbeatLoader size={18} />}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {admission?.patientName}
        </Typography>

        {surgeries.length > 0 && (
          <TableContainer sx={{ mb: 3, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Procedure</TableCell>
                  <TableCell>Type / Grade</TableCell>
                  <TableCell>Surgeon</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {surgeries.map((s) => {
                  const sm = STATUS_META[s.status] || STATUS_META.SCHEDULED;
                  return (
                    <TableRow key={s.surgeryId}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.procedureName}</Typography>
                        {s.notes && <Typography variant="caption" sx={{ color: "text.secondary" }}>{s.notes}</Typography>}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ display: "block" }}>{s.surgeryType === "MAJOR" ? "Major" : "Minor"}</Typography>
                        {s.gradeName && <Typography variant="caption" sx={{ color: "text.secondary" }}>{s.gradeName}</Typography>}
                      </TableCell>
                      <TableCell>{s.surgeonName || "—"}</TableCell>
                      <TableCell>{s.surgeryDate ? dayjs(s.surgeryDate).format("DD MMM YYYY") : "—"}</TableCell>
                      <TableCell align="right">{s.price ? formatINR(s.price) : "—"}</TableCell>
                      <TableCell>
                        <Chip label={sm.label} size="small" sx={{ bgcolor: `${sm.color}22`, color: sm.color, fontWeight: 700, mb: s.invoiceNumber ? 0.5 : 0 }} />
                        {s.invoiceNumber && (
                          <Chip icon={<ReceiptLongRounded sx={{ fontSize: 14 }} />} label={`Billed: ${s.invoiceNumber}`} size="small"
                            sx={{ display: "block", mt: 0.5, bgcolor: "rgba(8,145,178,0.12)", color: "#0891b2", fontWeight: 700 }} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {s.status === "SCHEDULED" && (
                          <>
                            <Tooltip title="Mark completed">
                              <IconButton size="small" disabled={busyId === s.surgeryId} onClick={() => setStatus(s.surgeryId, "COMPLETED")} sx={{ color: "#10b981" }}>
                                <CheckCircleRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton size="small" disabled={busyId === s.surgeryId} onClick={() => setStatus(s.surgeryId, "CANCELLED")} sx={{ color: "#ef4444" }}>
                                <CancelRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Divider sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>Add Surgery</Typography>
        </Divider>

        <Stack spacing={2}>
          <TextField fullWidth required label="Surgical Details" placeholder="e.g. Appendectomy"
            value={form.procedureName} onChange={(e) => { setForm({ ...form, procedureName: e.target.value }); setErrors((p) => ({ ...p, procedureName: undefined })); }}
            error={!!errors.procedureName} helperText={errors.procedureName} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField select fullWidth label="Major / Minor" value={form.surgeryType} onChange={(e) => setForm({ ...form, surgeryType: e.target.value })}>
              <MenuItem value="MAJOR">Major</MenuItem>
              <MenuItem value="MINOR">Minor</MenuItem>
            </TextField>
            <TextField select fullWidth label="Grade (optional)" value={form.gradeId} onChange={(e) => setForm({ ...form, gradeId: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {grades.filter((g: any) => g.isActive).map((g: any) => <MenuItem key={g.surgeryGradeId} value={g.surgeryGradeId}>{g.gradeName}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField select fullWidth label="Surgeon (optional)" value={form.surgeonId} onChange={(e) => setForm({ ...form, surgeonId: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {(dropdowns?.doctors || []).map((d: any) => (
                <MenuItem key={d.doctorId} value={d.doctorId}>Dr. {d.user?.firstName || "Unknown"} {d.user?.lastName || ""}</MenuItem>
              ))}
            </TextField>
            <TextField fullWidth type="date" label="Surgery date (optional)" InputLabelProps={{ shrink: true }}
              value={form.surgeryDate} onChange={(e) => setForm({ ...form, surgeryDate: e.target.value })} />
          </Box>
          <TextField fullWidth type="number" label="Price (₹, optional)"
            error={!!errors.price}
            helperText={errors.price || "Marking this surgery completed will raise a charge for this amount"}
            value={form.price} onChange={(e) => { setForm({ ...form, price: e.target.value }); setErrors((p) => ({ ...p, price: undefined })); }} />
          <TextField fullWidth multiline rows={2} label="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Close</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !form.procedureName.trim()}
          startIcon={saving ? <HeartbeatLoader size={22} /> : <AddRounded />}
          sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" } }}>Add Surgery</Button>
      </DialogActions>
    </Dialog>
  );
}
