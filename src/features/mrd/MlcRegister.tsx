import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Paper, Typography, TextField, MenuItem, Button, Stack, ToggleButton, ToggleButtonGroup, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import { AddRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import SoftChip from "@/components/SoftChip";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import { SEMANTIC } from "@/styles/accents";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import PatientPicker, { type PickedPatient } from "./PatientPicker";

/**
 * The medico-legal register (backend /mrd/mlc): every case the police must be
 * told of, numbered in the MLC series. A case closes only once the police
 * intimation is on record.
 */

export interface Mlc {
  mlcId: string; mlcNumber: string; patientId: string; patientName: string; uhid: string; caseType: string;
  broughtAt: string; broughtBy: string | null; history: string; policeStation: string | null; policeIntimatedAt: string | null;
  policeOfficer: string | null; firNumber: string | null; status: "OPEN" | "CLOSED"; closingNote: string | null; policePending: boolean;
}

const CASE_TYPES: Record<string, string> = {
  ROAD_ACCIDENT: "Road accident", ASSAULT: "Assault", POISONING: "Poisoning", BURNS: "Burns", FALL: "Fall",
  SEXUAL_ASSAULT: "Sexual assault", ANIMAL_BITE: "Animal bite", SELF_HARM: "Self-harm", UNKNOWN: "Unknown cause", OTHER: "Other",
};
const nowLocal = () => dayjs().format("YYYY-MM-DDTHH:mm");
const iso = (local: string) => (local ? new Date(local).toISOString() : undefined);

function RegisterDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [f, setF] = useState({ caseType: "", broughtAt: nowLocal(), broughtBy: "", history: "", policeStation: "", policeIntimatedAt: "", policeOfficer: "", firNumber: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      const { mlcNumber } = (await axiosInstance.post("/mrd/mlc", {
        patientId: patient!.patientId, caseType: f.caseType, broughtAt: iso(f.broughtAt), broughtBy: f.broughtBy || undefined, history: f.history,
        policeStation: f.policeStation || undefined, policeIntimatedAt: iso(f.policeIntimatedAt), policeOfficer: f.policeOfficer || undefined, firNumber: f.firNumber || undefined,
      })).data.data as { mlcNumber: string };
      toast.success(`Registered ${mlcNumber}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't register the case"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Register a medico-legal case</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <PatientPicker id="mlc-patient" value={patient} onChange={setPatient} />
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField id="mlc-type" select required label="Kind of case" value={f.caseType} onChange={set("caseType")} sx={{ flex: 1, minWidth: 200 }}>
              {Object.entries(CASE_TYPES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <TextField id="mlc-brought-at" type="datetime-local" required label="Brought in at" value={f.broughtAt} onChange={set("broughtAt")} InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 200 }} />
          </Box>
          <TextField id="mlc-brought-by" label="Brought by (name, relation)" value={f.broughtBy} onChange={set("broughtBy")} />
          <TextField id="mlc-history" required multiline minRows={3} label="What happened, and the injuries seen" value={f.history} onChange={set("history")} inputProps={{ maxLength: 4000 }} />
          <Typography variant="subtitle2" sx={{ pt: 1 }}>Police intimation <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>(can be added later)</Typography></Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField id="mlc-station" label="Police station" value={f.policeStation} onChange={set("policeStation")} sx={{ flex: 1, minWidth: 200 }} />
            <TextField id="mlc-told-at" type="datetime-local" label="Told at" value={f.policeIntimatedAt} onChange={set("policeIntimatedAt")} InputLabelProps={{ shrink: true }} sx={{ flex: 1, minWidth: 200 }} />
          </Box>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField id="mlc-officer" label="Officer (name, buckle no.)" value={f.policeOfficer} onChange={set("policeOfficer")} sx={{ flex: 1, minWidth: 200 }} />
            <TextField id="mlc-fir" label="FIR / DD number" value={f.firNumber} onChange={set("firNumber")} sx={{ flex: 1, minWidth: 200 }} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !patient || !f.caseType || !f.broughtAt || !f.history.trim() || (!!f.policeIntimatedAt && !f.policeStation.trim())}>Register</Button>
      </DialogActions>
    </Dialog>
  );
}

function PoliceDialog({ mlc, onClose, onDone }: { mlc: Mlc; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ policeStation: mlc.policeStation ?? "", policeIntimatedAt: nowLocal(), policeOfficer: mlc.policeOfficer ?? "", firNumber: mlc.firNumber ?? "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.put(`/mrd/mlc/${mlc.mlcId}/police`, { ...f, policeIntimatedAt: iso(f.policeIntimatedAt), policeOfficer: f.policeOfficer || undefined, firNumber: f.firNumber || undefined });
      toast.success("Police intimation recorded");
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't save"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Police told · {mlc.mlcNumber}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField id="police-station" required label="Police station" value={f.policeStation} onChange={set("policeStation")} />
          <TextField id="police-at" required type="datetime-local" label="Told at" value={f.policeIntimatedAt} onChange={set("policeIntimatedAt")} InputLabelProps={{ shrink: true }} />
          <TextField id="police-officer" label="Officer (name, buckle no.)" value={f.policeOfficer} onChange={set("policeOfficer")} />
          <TextField id="police-fir" label="FIR / DD number" value={f.firNumber} onChange={set("firNumber")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !f.policeStation.trim() || !f.policeIntimatedAt}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function CloseDialog({ mlc, onClose, onDone }: { mlc: Mlc; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.post(`/mrd/mlc/${mlc.mlcId}/close`, { closingNote: note.trim() });
      toast.success(`${mlc.mlcNumber} closed`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't close the case"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Close {mlc.mlcNumber}</DialogTitle>
      <DialogContent>
        <TextField id="mlc-close-note" autoFocus fullWidth multiline minRows={2} label="Closing note" placeholder="e.g. Discharged; statement recorded by police" value={note} onChange={(e) => setNote(e.target.value)} sx={{ mt: 1 }} inputProps={{ maxLength: 1000 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !note.trim()}>Close case</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function MlcRegister() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "all">("open");
  const [dialog, setDialog] = useState<{ kind: "register" } | { kind: "police" | "close"; mlc: Mlc } | null>(null);
  const q = useQuery<Mlc[]>({
    queryKey: ["mrd", "mlc", status],
    queryFn: async () => (await axiosInstance.get("/mrd/mlc", { params: { status } })).data.data,
  });
  const done = () => qc.invalidateQueries({ queryKey: ["mrd", "mlc"] });

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 2, flexWrap: "wrap" }}>
        <ToggleButtonGroup size="small" exclusive value={status} onChange={(_e, v) => v && setStatus(v)}>
          <ToggleButton value="open">Open</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setDialog({ kind: "register" })}>Register MLC</Button>
      </Box>
      {q.isError ? <ErrorState title="Couldn't load the register" message={apiErrorText(q.error)} onRetry={() => q.refetch()} /> : !q.isLoading && !q.data?.length ? (
        <Paper variant="outlined" sx={{ p: 3 }}><Mascot pose="all-caught-up" title={status === "open" ? "No open medico-legal case" : "No medico-legal case registered yet"} /></Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>MLC no.</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Case</TableCell>
                <TableCell>Brought in</TableCell>
                <TableCell>Police</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {q.isLoading ? <TableRowsSkeleton rows={4} columns={6} /> : q.data!.map((m) => (
                <TableRow key={m.mlcId} hover>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{m.mlcNumber}</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.patientName}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{m.uhid}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{CASE_TYPES[m.caseType] ?? m.caseType}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.history}>{m.history}</Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography variant="body2">{dayjs(m.broughtAt).format("DD MMM, h:mm A")}</Typography>
                    {m.broughtBy && <Typography variant="caption" sx={{ color: "text.secondary" }}>by {m.broughtBy}</Typography>}
                  </TableCell>
                  <TableCell>
                    {m.policeIntimatedAt ? (
                      <>
                        <Typography variant="body2">{m.policeStation}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{dayjs(m.policeIntimatedAt).format("DD MMM, h:mm A")}{m.firNumber ? ` · FIR ${m.firNumber}` : ""}</Typography>
                      </>
                    ) : <SoftChip label="Not told yet" bg={`${SEMANTIC.danger}1a`} color={SEMANTIC.danger} />}
                  </TableCell>
                  <TableCell align="right">
                    {m.status === "CLOSED" ? (
                      <Tooltip title={m.closingNote ?? ""}><span><SoftChip label="Closed" bg="rgba(100,116,139,0.12)" color="#475569" /></span></Tooltip>
                    ) : (
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <Button size="small" sx={{ whiteSpace: "nowrap" }} onClick={() => setDialog({ kind: "police", mlc: m })}>{m.policePending ? "Police told" : "Update police"}</Button>
                        <Tooltip title={m.policePending ? "Record the police intimation first" : ""}>
                          <span><Button size="small" color="inherit" disabled={m.policePending} onClick={() => setDialog({ kind: "close", mlc: m })}>Close</Button></span>
                        </Tooltip>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {dialog?.kind === "register" && <RegisterDialog onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "police" && <PoliceDialog mlc={dialog.mlc} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "close" && <CloseDialog mlc={dialog.mlc} onClose={() => setDialog(null)} onDone={done} />}
    </Box>
  );
}
