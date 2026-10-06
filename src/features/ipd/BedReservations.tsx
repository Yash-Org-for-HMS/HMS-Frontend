import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Paper, Typography, TextField, MenuItem, Button, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import { AddRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import SoftChip from "@/components/SoftChip";
import SearchableSelect from "@/components/form/SearchableSelect";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import AdmitDialog from "@/components/ipd/AdmitDialog";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import { SEMANTIC } from "@/styles/accents";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import PatientPicker, { type PickedPatient } from "@/features/mrd/PatientPicker";

/**
 * Bed reservations — the admission desk's (15_System_Roles ADMISSION_DESK:
 * "bed allocation, reservations, transfers"; workbook 06 RESERVED: held for a
 * planned admission, with an expiry). Every bed on hold, who for and until
 * when. A bed held for a named patient takes only them until the hold ends;
 * then it reads as available again without anyone releasing it.
 */

interface Hold {
  bedId: string; label: string; wardName: string | null; reservedUntil: string | null; reservedAt: string | null; reason: string | null;
  patient: { patientId: string; name: string; uhid: string } | null; endingSoon: boolean;
}
interface FreeBed { bedId: string; label: string; status: string; dailyCharge: number | null }
const HOURS = [4, 8, 12, 24, 48, 72];

function ReserveDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [bedId, setBedId] = useState("");
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [hours, setHours] = useState("24");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const beds = useQuery<FreeBed[]>({ queryKey: ["ipd-available-beds"], queryFn: async () => (await axiosInstance.get("/ipd/beds/available")).data.data });
  const free = (beds.data ?? []).filter((b) => b.status === "AVAILABLE");
  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.put(`/ipd/beds/${bedId}/status`, { status: "RESERVED", holdHours: Number(hours), patientId: patient?.patientId, reason: note.trim() || undefined });
      toast.success("Bed reserved");
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't reserve the bed"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Reserve a bed</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <SearchableSelect
            label="Bed" name="reserve-bed" required value={bedId} onChange={(e) => setBedId(e.target.value)}
            placeholder="Select a free bed" searchPlaceholder="Search by ward, room or bed…"
            options={free.map((b) => ({ value: b.bedId, label: b.label, secondary: b.dailyCharge ? `₹${Number(b.dailyCharge).toFixed(0)}/day` : undefined }))}
            helperText={beds.data && !free.length ? "No free bed to reserve" : undefined}
          />
          <PatientPicker id="reserve-patient" value={patient} onChange={setPatient} label="For patient (optional)" required={false} />
          <Typography variant="caption" sx={{ color: "text.secondary", mt: -1 }}>
            {patient ? "Only this patient can be admitted into it until the hold ends." : "Without a patient, anyone can still be admitted into it."}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField id="reserve-hours" select label="Hold for" value={hours} onChange={(e) => setHours(e.target.value)} sx={{ width: 160 }}>
              {HOURS.map((h) => <MenuItem key={h} value={String(h)}>{h < 24 ? `${h} hours` : `${h / 24} day${h === 24 ? "" : "s"}`}</MenuItem>)}
            </TextField>
            <TextField id="reserve-note" label="Note" placeholder="e.g. Planned surgery, Dr. Rao" value={note} onChange={(e) => setNote(e.target.value)} sx={{ flex: 1, minWidth: 200 }} inputProps={{ maxLength: 200 }} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !bedId}>Reserve</Button>
      </DialogActions>
    </Dialog>
  );
}

function ExtendDialog({ hold, onClose, onDone }: { hold: Hold; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [hours, setHours] = useState("24");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.put(`/ipd/beds/${hold.bedId}/reservation`, { holdHours: Number(hours) });
      toast.success(`Held until ${dayjs().add(Number(hours), "hour").format("DD MMM, h:mm A")}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't change the hold"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Hold {hold.label} longer</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Now held until {hold.reservedUntil ? dayjs(hold.reservedUntil).format("DD MMM, h:mm A") : "—"}. The new hold runs from now.
        </Typography>
        <TextField id="extend-hours" select fullWidth label="Hold for" value={hours} onChange={(e) => setHours(e.target.value)}>
          {HOURS.map((h) => <MenuItem key={h} value={String(h)}>{h < 24 ? `${h} hours` : `${h / 24} day${h === 24 ? "" : "s"}`} from now</MenuItem>)}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function BedReservations() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ kind: "reserve" } | { kind: "extend"; hold: Hold } | { kind: "admit"; hold: Hold } | null>(null);
  const q = useQuery<Hold[]>({ queryKey: ["ipd-reservations"], queryFn: async () => (await axiosInstance.get("/ipd/reservations")).data.data, refetchOnWindowFocus: true });
  const done = () => {
    qc.invalidateQueries({ queryKey: ["ipd-reservations"] });
    qc.invalidateQueries({ queryKey: ["ipd-available-beds"] });
    qc.invalidateQueries({ queryKey: ["role-home", "admission-desk"] });
  };
  const release = async (h: Hold) => {
    const ok = await confirm({ title: `Release ${h.label}`, message: `The bed goes back to available${h.patient ? ` and is no longer held for ${h.patient.name}` : ""}.`, confirmText: "Release" });
    if (!ok) return;
    try {
      await axiosInstance.put(`/ipd/beds/${h.bedId}/status`, { status: "AVAILABLE" });
      toast.success(`${h.label} released`);
      done();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't release the bed"));
    }
  };

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title="Bed reservations"
        subtitle="Beds held for planned admissions. A bed held for a patient takes only them until the hold ends; then it is free again on its own."
        actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setDialog({ kind: "reserve" })}>Reserve a bed</Button>}
      />
      {q.isError ? <ErrorState title="Couldn't load the reservations" message={apiErrorText(q.error)} onRetry={() => q.refetch()} /> : !q.isLoading && !q.data?.length ? (
        <Paper sx={{ p: 3 }}><Mascot pose="all-caught-up" title="No bed is on hold" /></Paper>
      ) : (
        <TableContainer component={Paper} sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Bed</TableCell>
                <TableCell>Held for</TableCell>
                <TableCell>Until</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {q.isLoading ? <TableRowsSkeleton rows={4} columns={4} /> : q.data!.map((h) => (
                <TableRow key={h.bedId} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{h.label}</Typography>
                    {h.reservedAt && <Typography variant="caption" sx={{ color: "text.secondary" }}>Reserved {dayjs(h.reservedAt).format("DD MMM, h:mm A")}</Typography>}
                  </TableCell>
                  <TableCell>
                    {h.patient ? (
                      <>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{h.patient.name}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{h.patient.uhid}{h.reason ? ` · ${h.reason}` : ""}</Typography>
                      </>
                    ) : (
                      <Typography variant="body2" sx={{ color: h.reason ? "text.primary" : "text.secondary" }}>{h.reason || "No patient named"}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {h.reservedUntil ? (h.endingSoon
                      ? <SoftChip label={`Ends ${dayjs(h.reservedUntil).format("h:mm A")}`} bg={`${SEMANTIC.warning}22`} color={SEMANTIC.warningDark} />
                      : dayjs(h.reservedUntil).format("DD MMM, h:mm A")) : "—"}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {h.patient && <Button size="small" variant="contained" onClick={() => setDialog({ kind: "admit", hold: h })} sx={{ mr: 1 }}>Admit</Button>}
                    <Button size="small" onClick={() => setDialog({ kind: "extend", hold: h })}>Extend</Button>
                    <Button size="small" color="inherit" onClick={() => release(h)}>Release</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {dialog?.kind === "reserve" && <ReserveDialog onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "extend" && <ExtendDialog hold={dialog.hold} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "admit" && dialog.hold.patient && (
        <AdmitDialog open onClose={() => setDialog(null)} onAdmitted={() => { setDialog(null); done(); }} prefilledPatientId={dialog.hold.patient.patientId} />
      )}
    </Box>
  );
}
