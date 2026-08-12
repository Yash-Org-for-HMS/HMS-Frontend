import { useState } from "react";
import { ACCENTS, SEMANTIC, NEUTRAL } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatINR } from "@/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Autocomplete,
  Stack, Typography, Box, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Divider, Tooltip, Chip,
} from "@mui/material";
import { MedicalServicesRounded, AddRounded, DeleteOutlineRounded, ReceiptLongRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import HeartbeatLoader from "../HeartbeatLoader";
import SoftChip from "../SoftChip";

interface Props {
  open: boolean;
  onClose: () => void;
  admission: any; // { admissionId, patientName }
}

export default function IpdDoctorVisitsDialog({ open, onClose, admission }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [doctor, setDoctor] = useState<any>(null);
  const [visitDate, setVisitDate] = useState(dayjs().format("YYYY-MM-DDTHH:mm"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visitsKey = ["ipd-admission-visits", admission?.admissionId];
  const { data, isFetching, refetch } = useQuery<{ visits: any[]; byDoctor: any[]; total: number }>({
    queryKey: visitsKey,
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admission.admissionId}/doctor-visits`)).data.data,
    enabled: open && !!admission?.admissionId,
  });
  const visits = data?.visits || [];
  const byDoctor = data?.byDoctor || [];

  const { data: doctors = [], isFetching: docLoading } = useQuery<any[]>({
    queryKey: ["ipd-visit-doctors"],
    queryFn: async () => (await axiosInstance.get("/ipd/doctors")).data.data,
    enabled: open,
  });

  const afterChange = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["ipd-admission", admission?.admissionId] });
  };

  const submit = async () => {
    if (!doctor) return;
    setSaving(true);
    try {
      await axiosInstance.post(`/ipd/admissions/${admission.admissionId}/doctor-visits`, {
        doctorId: doctor.doctorId,
        visitDate: visitDate ? new Date(visitDate).toISOString() : undefined,
        notes: notes || undefined,
      });
      toast.success("Visit logged");
      setNotes("");
      setVisitDate(dayjs().format("YYYY-MM-DDTHH:mm"));
      afterChange();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to log visit"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v: any) => {
    const ok = await confirm({
      title: "Remove visit", message: `Remove this ${v.doctorName ? `Dr. ${v.doctorName}` : "doctor"} visit? It hasn't been billed yet.`,
      confirmText: "Remove", destructive: true,
    });
    if (!ok) return;
    setBusyId(v.visitId);
    try {
      await axiosInstance.delete(`/ipd/admissions/${admission.admissionId}/doctor-visits/${v.visitId}`);
      toast.success("Visit removed");
      afterChange();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to remove"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <MedicalServicesRounded sx={{ color: ACCENTS.ipd }} /> Doctor Visits
        {isFetching && <HeartbeatLoader size={18} />}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {admission?.patientName} — log each routine doctor visit during the stay. Every visit is billed at the doctor's IPD visit charge and added to the discharge bill.
        </Typography>

        {/* Per-doctor summary */}
        {byDoctor.length > 0 && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
            {byDoctor.map((d) => (
              <Chip key={d.doctorId} label={`Dr. ${d.doctorName || "Doctor"} · ${d.count} visit${d.count === 1 ? "" : "s"} · ${formatINR(d.total)}`}
                sx={{ bgcolor: "rgba(8,145,178,0.1)", color: ACCENTS.ipd, fontWeight: 600 }} />
            ))}
          </Box>
        )}

        {visits.length > 0 && (
          <TableContainer sx={{ mb: 3, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Doctor</TableCell>
                  <TableCell>Date & time</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell align="right">Charge</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visits.filter((v) => v.status !== "CANCELLED").map((v) => (
                  <TableRow key={v.visitId}>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>Dr. {v.doctorName || "Doctor"}</Typography></TableCell>
                    <TableCell>{v.visitDate ? dayjs(v.visitDate).format("DD MMM · HH:mm") : "—"}</TableCell>
                    <TableCell><Typography variant="caption" sx={{ color: "text.secondary" }}>{v.notes || "—"}</Typography></TableCell>
                    <TableCell align="right">{formatINR(v.charge)}</TableCell>
                    <TableCell>
                      {v.status === "BILLED"
                        ? <SoftChip icon={<ReceiptLongRounded sx={{ fontSize: 14 }} />} label="Billed" bg="rgba(8,145,178,0.12)" color={ACCENTS.ipd} />
                        : <SoftChip label="Pending" bg="rgba(245,158,11,0.12)" color="#b45309" />}
                    </TableCell>
                    <TableCell align="right">
                      {v.status !== "BILLED" && (
                        <Tooltip title="Remove visit">
                          <IconButton size="small" disabled={busyId === v.visitId} onClick={() => remove(v)} sx={{ color: SEMANTIC.danger }}>
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} sx={{ fontWeight: 700, borderBottom: 0 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, borderBottom: 0 }}>{formatINR(data?.total || 0)}</TableCell>
                  <TableCell colSpan={2} sx={{ borderBottom: 0 }} />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Divider sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>Log a Visit</Typography>
        </Divider>

        <Stack spacing={2}>
          <Autocomplete
            options={doctors}
            loading={docLoading}
            value={doctor}
            onChange={(_, v) => setDoctor(v)}
            getOptionLabel={(o: any) => (o ? o.name : "")}
            isOptionEqualToValue={(o: any, v: any) => o.doctorId === v?.doctorId}
            renderOption={(props, o: any) => (
              <li {...props} key={o.doctorId}>
                <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <span>{o.name}</span>
                  <span style={{ color: o.ipdVisitCharge > 0 ? NEUTRAL.muted : SEMANTIC.danger, fontSize: "0.8rem" }}>
                    {o.ipdVisitCharge > 0 ? `${formatINR(o.ipdVisitCharge)} / visit` : "no visit charge set"}
                  </span>
                </Box>
              </li>
            )}
            renderInput={(params) => <TextField {...params} required label="Doctor" placeholder="Which doctor visited?" />}
          />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr" }, gap: 2 }}>
            <TextField type="datetime-local" label="Visit date & time" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Morning round" />
          </Box>
          {doctor && (
            <Typography variant="caption" sx={{ color: doctor.ipdVisitCharge > 0 ? "text.secondary" : SEMANTIC.danger }}>
              {doctor.ipdVisitCharge > 0
                ? <>This visit will be billed at <strong>{formatINR(doctor.ipdVisitCharge)}</strong> and added to the discharge bill.</>
                : <>This doctor has no IPD visit charge set — the visit will bill at ₹0. Set a charge in Doctor management.</>}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Close</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !doctor}
          startIcon={saving ? <HeartbeatLoader size={22} /> : <AddRounded />}
>Log Visit</Button>
      </DialogActions>
    </Dialog>
  );
}
