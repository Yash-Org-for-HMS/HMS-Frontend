import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Paper, Typography, TextField, MenuItem, Button, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import { LogoutRounded, ContentCopyRounded } from "@mui/icons-material";
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
 * The record room's register (backend /mrd/files, /mrd/copies): which paper
 * files are out and with whom — one place at a time, overdue flagged — and
 * every copy of records handed out, to whom, against what identity.
 */

interface FileOut { movementId: string; patientId: string; patientName: string; uhid: string; party: string | null; purpose: string | null; outAt: string; dueBackAt: string | null; overdue: boolean }
interface Copy { movementId: string; patientName: string; uhid: string; party: string; partyType: string; purpose: string | null; documents: string; idProof: string | null; createdAt: string }
const PARTY: Record<string, string> = { PATIENT: "Patient", NEXT_OF_KIN: "Next of kin", INSURER: "Insurer / TPA", POLICE: "Police", COURT: "Court", OTHER: "Other" };

function SendOutDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [f, setF] = useState({ party: "", purpose: "", dueBackAt: dayjs().add(1, "day").hour(17).minute(0).format("YYYY-MM-DDTHH:mm") });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.post("/mrd/files/out", { patientId: patient!.patientId, party: f.party.trim(), purpose: f.purpose.trim() || undefined, dueBackAt: f.dueBackAt ? new Date(f.dueBackAt).toISOString() : undefined });
      toast.success("File booked out");
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't book the file out"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Send a file out</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <PatientPicker id="file-patient" value={patient} onChange={setPatient} />
          <TextField id="file-party" required label="Who takes it" placeholder="e.g. Medicine OPD — Dr. Rao" value={f.party} onChange={set("party")} />
          <TextField id="file-purpose" label="Purpose" value={f.purpose} onChange={set("purpose")} />
          <TextField id="file-due" type="datetime-local" label="Due back" value={f.dueBackAt} onChange={set("dueBackAt")} InputLabelProps={{ shrink: true }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !patient || !f.party.trim()}>Book out</Button>
      </DialogActions>
    </Dialog>
  );
}

function CopyDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [f, setF] = useState({ partyType: "PATIENT", party: "", documents: "", purpose: "", idProof: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.post("/mrd/copies", { patientId: patient!.patientId, partyType: f.partyType, party: f.party.trim(), documents: f.documents.trim(), purpose: f.purpose.trim() || undefined, idProof: f.idProof.trim() || undefined });
      toast.success("Copy logged");
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't log the copy"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Log a copy handed out</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <PatientPicker id="copy-patient" value={patient} onChange={setPatient} />
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField id="copy-party-type" select label="Given to" value={f.partyType} onChange={set("partyType")} sx={{ flex: 1, minWidth: 180 }}>
              {Object.entries(PARTY).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <TextField id="copy-party" required label="Name" value={f.party} onChange={set("party")} sx={{ flex: 2, minWidth: 200 }} />
          </Box>
          <TextField id="copy-documents" required label="What was copied" placeholder="e.g. Discharge summary, lab reports" value={f.documents} onChange={set("documents")} />
          <TextField id="copy-purpose" label="Purpose" placeholder="e.g. Insurance claim" value={f.purpose} onChange={set("purpose")} />
          <TextField id="copy-id" label="Identity seen" placeholder="e.g. Aadhaar ending 4321, police letter no." value={f.idProof} onChange={set("idProof")} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !patient || !f.party.trim() || !f.documents.trim()}>Log copy</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function FilesAndCopies() {
  const toast = useToast();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<"out" | "copy" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const files = useQuery<FileOut[]>({ queryKey: ["mrd", "files-out"], queryFn: async () => (await axiosInstance.get("/mrd/files/out")).data.data });
  const copies = useQuery<Copy[]>({ queryKey: ["mrd", "copies"], queryFn: async () => (await axiosInstance.get("/mrd/copies")).data.data });

  const backIn = async (f: FileOut) => {
    setBusy(f.movementId);
    try {
      await axiosInstance.post("/mrd/files/in", { patientId: f.patientId });
      toast.success(`${f.patientName}'s file is back in`);
      qc.invalidateQueries({ queryKey: ["mrd", "files-out"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't book the file in"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Button variant="outlined" startIcon={<ContentCopyRounded />} onClick={() => setDialog("copy")}>Log a copy</Button>
        <Button variant="contained" startIcon={<LogoutRounded />} onClick={() => setDialog("out")}>Send a file out</Button>
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>Files out of the record room</Typography>
      {files.isError ? <ErrorState title="Couldn't load the files out" message={apiErrorText(files.error)} onRetry={() => files.refetch()} /> : !files.isLoading && !files.data?.length ? (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}><Mascot pose="all-caught-up" title="Every file is in the record room" size={40} /></Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Patient</TableCell>
                <TableCell>With</TableCell>
                <TableCell>Out since</TableCell>
                <TableCell>Due back</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {files.isLoading ? <TableRowsSkeleton rows={3} columns={5} /> : files.data!.map((f) => (
                <TableRow key={f.movementId} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{f.patientName}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{f.uhid}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{f.party}</Typography>
                    {f.purpose && <Typography variant="caption" sx={{ color: "text.secondary" }}>{f.purpose}</Typography>}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{dayjs(f.outAt).format("DD MMM, h:mm A")}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {f.dueBackAt ? (f.overdue ? <SoftChip label={`Overdue — ${dayjs(f.dueBackAt).format("DD MMM, h:mm A")}`} bg={`${SEMANTIC.danger}1a`} color={SEMANTIC.danger} /> : dayjs(f.dueBackAt).format("DD MMM, h:mm A")) : "—"}
                  </TableCell>
                  <TableCell align="right"><Button size="small" disabled={busy === f.movementId} onClick={() => backIn(f)}>Back in</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>Copies handed out</Typography>
      {copies.isError ? <ErrorState title="Couldn't load the copies log" message={apiErrorText(copies.error)} onRetry={() => copies.refetch()} /> : !copies.isLoading && !copies.data?.length ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}><Mascot pose="nothing-here-yet" title="No copy handed out yet" size={40} /></Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Given to</TableCell>
                <TableCell>What</TableCell>
                <TableCell>Identity seen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {copies.isLoading ? <TableRowsSkeleton rows={3} columns={5} /> : copies.data!.map((c) => (
                <TableRow key={c.movementId} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{dayjs(c.createdAt).format("DD MMM YYYY, h:mm A")}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.patientName}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{c.uhid}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{c.party}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{PARTY[c.partyType] ?? c.partyType}{c.purpose ? ` · ${c.purpose}` : ""}</Typography>
                  </TableCell>
                  <TableCell>{c.documents}</TableCell>
                  <TableCell>{c.idProof ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {dialog === "out" && <SendOutDialog onClose={() => setDialog(null)} onDone={() => qc.invalidateQueries({ queryKey: ["mrd", "files-out"] })} />}
      {dialog === "copy" && <CopyDialog onClose={() => setDialog(null)} onDone={() => qc.invalidateQueries({ queryKey: ["mrd", "copies"] })} />}
    </Box>
  );
}
