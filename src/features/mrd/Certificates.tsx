import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Paper, Typography, TextField, MenuItem, Button, Stack, ToggleButton, ToggleButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import { AddRounded, PrintRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import SoftChip from "@/components/SoftChip";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import { BRAND, SEMANTIC } from "@/styles/accents";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import { usePrintWindow } from "@/utils/usePrintWindow";
import PatientPicker, { type PickedPatient } from "./PatientPicker";
import type { Mlc } from "./MlcRegister";

/**
 * Numbered certificates (backend /mrd/certificates): medical, fitness and
 * death, each its own series, certified by a consultant. Never edited — a wrong
 * one is cancelled with a reason and its number is not given again. Printed
 * from here; every print after the first is marked a duplicate.
 */

type CertType = "MEDICAL" | "FITNESS" | "DEATH";
interface Cert {
  certificateId: string; certNumber: string; certType: CertType; status: "ISSUED" | "CANCELLED"; issuedAt: string;
  patientName: string; uhid: string; doctorName: string; printCount: number; cancelReason: string | null;
}
const TYPE_LABEL: Record<CertType, string> = { MEDICAL: "Medical", FITNESS: "Fitness", DEATH: "Death" };
const MANNERS: Record<string, string> = { NATURAL: "Natural", ACCIDENT: "Accident", SUICIDE: "Suicide", HOMICIDE: "Homicide", PENDING_INVESTIGATION: "Pending investigation" };
const printPath = (id: string) => `/reception/mrd/certificates/${id}/print`;

function IssueDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const openPrint = usePrintWindow();
  const [issued, setIssued] = useState<{ certificateId: string; certNumber: string } | null>(null);
  const [type, setType] = useState<CertType>("MEDICAL");
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [mlcId, setMlcId] = useState("");
  const [d, setD] = useState<Record<string, string>>({ restFrom: dayjs().format("YYYY-MM-DD"), restTo: dayjs().add(2, "day").format("YYYY-MM-DD"), fitFrom: dayjs().format("YYYY-MM-DD"), dateOfDeath: dayjs().format("YYYY-MM-DDTHH:mm"), mannerOfDeath: "NATURAL" });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setD((s) => ({ ...s, [k]: e.target.value }));
  const doctors = useQuery<{ doctorId: string; name: string }[]>({ queryKey: ["mrd", "doctors"], queryFn: async () => (await axiosInstance.get("/mrd/doctors")).data.data });
  const mlcs = useQuery<Mlc[]>({ queryKey: ["mrd", "mlc", "all"], queryFn: async () => (await axiosInstance.get("/mrd/mlc", { params: { status: "all" } })).data.data, enabled: type === "DEATH" });
  const patientMlcs = (mlcs.data ?? []).filter((m) => m.patientId === patient?.patientId);
  const unnatural = type === "DEATH" && d.mannerOfDeath !== "NATURAL";

  const details = type === "MEDICAL"
    ? { diagnosis: d.diagnosis, restFrom: d.restFrom, restTo: d.restTo, remarks: d.remarks }
    : type === "FITNESS"
      ? { fitFrom: d.fitFrom, purpose: d.purpose, remarks: d.remarks }
      : { dateOfDeath: d.dateOfDeath ? new Date(d.dateOfDeath).toISOString() : undefined, mannerOfDeath: d.mannerOfDeath, causeImmediate: d.causeImmediate, causeAntecedent: d.causeAntecedent, causeUnderlying: d.causeUnderlying, otherConditions: d.otherConditions };
  const ready = !!patient && !!doctorId && (type === "MEDICAL" ? !!d.diagnosis?.trim() && !!d.restFrom && !!d.restTo && d.restTo >= d.restFrom
    : type === "FITNESS" ? !!d.fitFrom && !!d.purpose?.trim()
      : !!d.dateOfDeath && !!d.causeImmediate?.trim() && (!unnatural || !!mlcId));

  const issue = async () => {
    setSaving(true);
    try {
      const cert = (await axiosInstance.post("/mrd/certificates", { certType: type, patientId: patient!.patientId, doctorId, mlcId: mlcId || undefined, details })).data.data as { certificateId: string; certNumber: string };
      toast.success(`Issued ${cert.certNumber}`);
      onDone();
      // Printed from a click of its own: a tab opened after the request returns is a blocked pop-up.
      setIssued(cert);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't issue the certificate"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Issue a certificate</DialogTitle>
      {issued ? (
        <>
          <DialogContent dividers>
            <Typography variant="body1">Issued <b>{issued.certNumber}</b>.</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>Print it now for the consultant to sign — later prints are marked duplicate.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} color="inherit">Close</Button>
            <Button variant="contained" startIcon={<PrintRounded />} onClick={() => { if (openPrint(printPath(issued.certificateId))) onClose(); }}>Print</Button>
          </DialogActions>
        </>
      ) : (
      <>
      <DialogContent dividers>
        <Stack spacing={2}>
          <ToggleButtonGroup size="small" exclusive value={type} onChange={(_e, v) => v && setType(v)}>
            {(Object.keys(TYPE_LABEL) as CertType[]).map((t) => <ToggleButton key={t} value={t}>{TYPE_LABEL[t]}</ToggleButton>)}
          </ToggleButtonGroup>
          <PatientPicker id="cert-patient" value={patient} onChange={(p) => { setPatient(p); setMlcId(""); }} />
          <TextField id="cert-doctor" select required label="Certifying consultant" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} helperText="Signs the printed certificate">
            {(doctors.data ?? []).map((x) => <MenuItem key={x.doctorId} value={x.doctorId}>{x.name}</MenuItem>)}
          </TextField>
          {type === "MEDICAL" && (
            <>
              <TextField id="cert-diagnosis" required label="Diagnosis" value={d.diagnosis ?? ""} onChange={set("diagnosis")} />
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField id="cert-rest-from" required type="date" label="Rest from" value={d.restFrom} onChange={set("restFrom")} InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 180 }} />
                <TextField id="cert-rest-to" required type="date" label="Rest to" value={d.restTo} onChange={set("restTo")} InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 180 }} error={!!d.restTo && d.restTo < d.restFrom} />
              </Box>
            </>
          )}
          {type === "FITNESS" && (
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <TextField id="cert-fit-from" required type="date" label="Fit from" value={d.fitFrom} onChange={set("fitFrom")} InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 180 }} />
              <TextField id="cert-purpose" required label="Fit to (purpose)" placeholder="e.g. resume duty" value={d.purpose ?? ""} onChange={set("purpose")} sx={{ flex: 2, minWidth: 200 }} />
            </Box>
          )}
          {type !== "DEATH" && <TextField id="cert-remarks" label="Remarks (optional)" value={d.remarks ?? ""} onChange={set("remarks")} />}
          {type === "DEATH" && (
            <>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField id="cert-death-at" required type="datetime-local" label="Date and time of death" value={d.dateOfDeath} onChange={set("dateOfDeath")} InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 200 }} />
                <TextField id="cert-manner" select required label="Manner of death" value={d.mannerOfDeath} onChange={set("mannerOfDeath")} sx={{ flex: 1, minWidth: 200 }}>
                  {Object.entries(MANNERS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                </TextField>
              </Box>
              {unnatural && (
                <TextField id="cert-mlc" select required label="Medico-legal case" value={mlcId} onChange={(e) => setMlcId(e.target.value)}
                  helperText={patient && !patientMlcs.length ? "This patient has no medico-legal case — register one first." : "A death that is not natural is medico-legal."}
                  error={!!patient && !patientMlcs.length}>
                  {patientMlcs.map((m) => <MenuItem key={m.mlcId} value={m.mlcId}>{m.mlcNumber}</MenuItem>)}
                </TextField>
              )}
              <TextField id="cert-cause-a" required label="(a) Immediate cause" value={d.causeImmediate ?? ""} onChange={set("causeImmediate")} />
              <TextField id="cert-cause-b" label="(b) Antecedent cause, due to" value={d.causeAntecedent ?? ""} onChange={set("causeAntecedent")} />
              <TextField id="cert-cause-c" label="(c) Underlying cause" value={d.causeUnderlying ?? ""} onChange={set("causeUnderlying")} />
              <TextField id="cert-other" label="Other significant conditions" value={d.otherConditions ?? ""} onChange={set("otherConditions")} />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={issue} disabled={saving || !ready}>Issue</Button>
      </DialogActions>
      </>
      )}
    </Dialog>
  );
}

function CancelDialog({ cert, onClose, onDone }: { cert: Cert; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.post(`/mrd/certificates/${cert.certificateId}/cancel`, { reason: reason.trim() });
      toast.success(`${cert.certNumber} cancelled`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't cancel"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Cancel {cert.certNumber}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>The number stays used and the certificate stays on record as cancelled.</Typography>
        <TextField id="cert-cancel-reason" autoFocus fullWidth label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 300 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Back</Button>
        <Button variant="contained" color="error" onClick={save} disabled={saving || !reason.trim()}>Cancel certificate</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Certificates() {
  const qc = useQueryClient();
  const openPrint = usePrintWindow();
  const [type, setType] = useState<"" | CertType>("");
  const [issuing, setIssuing] = useState(false);
  const [cancelling, setCancelling] = useState<Cert | null>(null);
  const q = useQuery<Cert[]>({
    queryKey: ["mrd", "certificates", type],
    queryFn: async () => (await axiosInstance.get("/mrd/certificates", { params: { type: type || undefined } })).data.data,
  });
  const done = () => qc.invalidateQueries({ queryKey: ["mrd", "certificates"] });

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 2, flexWrap: "wrap" }}>
        <ToggleButtonGroup size="small" exclusive value={type} onChange={(_e, v) => v !== null && setType(v)}>
          <ToggleButton value="">All</ToggleButton>
          {(Object.keys(TYPE_LABEL) as CertType[]).map((t) => <ToggleButton key={t} value={t}>{TYPE_LABEL[t]}</ToggleButton>)}
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setIssuing(true)}>Issue certificate</Button>
      </Box>
      {q.isError ? <ErrorState title="Couldn't load the certificates" message={apiErrorText(q.error)} onRetry={() => q.refetch()} /> : !q.isLoading && !q.data?.length ? (
        <Paper variant="outlined" sx={{ p: 3 }}><Mascot pose="nothing-here-yet" title="No certificate issued yet" /></Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Number</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Certified by</TableCell>
                <TableCell>Issued</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {q.isLoading ? <TableRowsSkeleton rows={4} columns={5} /> : q.data!.map((c) => (
                <TableRow key={c.certificateId} hover sx={{ opacity: c.status === "CANCELLED" ? 0.7 : 1 }}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, textDecoration: c.status === "CANCELLED" ? "line-through" : "none" }}>{c.certNumber}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{TYPE_LABEL[c.certType]}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.patientName}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{c.uhid}</Typography>
                  </TableCell>
                  <TableCell>{c.doctorName}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {dayjs(c.issuedAt).format("DD MMM YYYY, h:mm A")}
                    {c.printCount > 1 && <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Printed {c.printCount} times</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {c.status === "CANCELLED" ? (
                      <SoftChip label={`Cancelled — ${c.cancelReason ?? ""}`} bg={`${SEMANTIC.danger}1a`} color={SEMANTIC.danger} />
                    ) : (
                      <>
                        <Button size="small" startIcon={<PrintRounded />} onClick={() => openPrint(printPath(c.certificateId))} sx={{ color: BRAND.action }}>Print</Button>
                        <Button size="small" color="inherit" onClick={() => setCancelling(c)}>Cancel</Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {issuing && <IssueDialog onClose={() => setIssuing(false)} onDone={done} />}
      {cancelling && <CancelDialog cert={cancelling} onClose={() => setCancelling(null)} onDone={done} />}
    </Box>
  );
}
