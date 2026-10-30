import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment,
  MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { AddRounded, EditRounded, SearchRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { useToast } from "@/providers/ToastContext";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { PAYER_TYPE_OPTIONS } from "./claimMeta";

// The hospital's insurers, TPAs and government schemes (backend claims payers),
// and the rate list each one bills by. The claim form picks from the active
// ones; the rate lists themselves and their room rents live in Bed tariffs.

interface RateList { rateListId: string; name: string }
interface Payer {
  payerId: string; payerCode: string; payerName: string; payerType: string; portalName: string | null; contactInfo: string | null;
  isActive: boolean; rateListId: string | null; rateList: RateList | null;
}

const typeLabel = (t: string) => PAYER_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
const headCell = { color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", borderColor: "divider" } as const;

export default function InsurancePayersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [showOff, setShowOff] = useState(false);
  const [editing, setEditing] = useState<Payer | "new" | null>(null);

  const { data: payers = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["insurance-payers"],
    queryFn: async () => (await axiosInstance.get("/claims/payers", { params: { includeInactive: "true" } })).data.data as Payer[],
  });
  const { data: rateLists = [] } = useQuery({
    queryKey: ["claim-rate-lists"],
    queryFn: async () => (await axiosInstance.get("/claims/rate-lists")).data.data as RateList[],
  });
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payers.filter((p) => (showOff || p.isActive) && (!type || p.payerType === type)
      && (!q || p.payerName.toLowerCase().includes(q) || (p.portalName ?? "").toLowerCase().includes(q)));
  }, [payers, search, type, showOff]);
  const offCount = payers.filter((p) => !p.isActive).length;

  const changed = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["claim-payers"] });
  };
  const setActive = async (p: Payer, isActive: boolean) => {
    try {
      await axiosInstance.put(`/claims/payers/${p.payerId}`, { isActive });
      toast.success(isActive ? `${p.payerName} is back on the list` : `${p.payerName} switched off`);
      changed();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not change the payer"));
    }
  };

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  return (
    <Box>
      <PageHeader
        title="Insurance & TPA"
        subtitle="The insurers, TPAs and government schemes the hospital works with, and the rate list each one bills by."
        actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setEditing("new")} sx={{ textTransform: "none" }}>Add payer</Button>}
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        A payer on a rate list bills its insured patients that list's room rents; a payer on none bills the general Insurance rents.
        The rate lists and their rents are set in Ward & Bed Setup, under Bed tariffs.
      </Alert>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ p: 2, alignItems: { md: "center" }, borderBottom: "1px solid", borderColor: "divider" }}>
          <TextField size="small" placeholder="Search name or portal..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 280 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" sx={{ color: "text.secondary" }} /></InputAdornment> }} />
          <TextField select size="small" label="Type" value={type} onChange={(e) => setType(e.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="">All types</MenuItem>
            {PAYER_TYPE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <FormControlLabel control={<Switch checked={showOff} onChange={(e) => setShowOff(e.target.checked)} />} label={`Show switched off (${offCount})`} />
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>{shown.length} payer{shown.length === 1 ? "" : "s"}</Typography>
        </Stack>
        {payers.length === 0 ? (
          <Mascot pose="nothing-here-yet" title="No insurers or TPAs yet" subtitle="Use Add payer, or import sheet 15 Insurance & TPA from the workbook." />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Name", "Type", "Portal", "Rate list", "Contact", "Active", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.length === 0 && (
                  <TableRow><TableCell colSpan={7} sx={{ border: 0, py: 3 }}><Mascot pose="nothing-here-yet" subtitle="No payers match." size={110} /></TableCell></TableRow>
                )}
                {shown.map((p) => (
                  <TableRow key={p.payerId} hover sx={{ opacity: p.isActive ? 1 : 0.55 }}>
                    <TableCell sx={{ borderColor: "divider", fontWeight: 600 }}>{p.payerName}</TableCell>
                    <TableCell sx={{ borderColor: "divider" }}>{typeLabel(p.payerType)}</TableCell>
                    <TableCell sx={{ borderColor: "divider", color: p.portalName ? "text.primary" : "text.disabled" }}>{p.portalName || "-"}</TableCell>
                    <TableCell sx={{ borderColor: "divider" }}>
                      {p.rateList ? <Chip size="small" label={p.rateList.name} /> : <Typography variant="body2" sx={{ color: "text.secondary" }}>General Insurance rates</Typography>}
                    </TableCell>
                    <TableCell sx={{ borderColor: "divider", color: p.contactInfo ? "text.primary" : "text.disabled", maxWidth: 240 }}>{p.contactInfo || "-"}</TableCell>
                    <TableCell sx={{ borderColor: "divider" }}>
                      <Switch size="small" checked={p.isActive} onChange={(e) => setActive(p, e.target.checked)} inputProps={{ "aria-label": `${p.payerName} active` }} />
                    </TableCell>
                    <TableCell align="right" sx={{ borderColor: "divider" }}>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditing(p)}><EditRounded fontSize="small" /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {editing && (
        <PayerDialog payer={editing === "new" ? null : editing} rateLists={rateLists}
          onClose={() => setEditing(null)} onDone={() => { setEditing(null); changed(); }} />
      )}
    </Box>
  );
}

function PayerDialog({ payer, rateLists, onClose, onDone }: { payer: Payer | null; rateLists: RateList[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    payerName: payer?.payerName ?? "",
    payerType: payer?.payerType ?? "TPA",
    portalName: payer?.portalName ?? "",
    contactInfo: payer?.contactInfo ?? "",
    rateListId: payer?.rateListId ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    const body = { ...f, payerName: f.payerName.trim(), rateListId: f.rateListId || null };
    try {
      if (payer) await axiosInstance.put(`/claims/payers/${payer.payerId}`, body);
      else await axiosInstance.post("/claims/payers", body);
      toast.success(payer ? "Payer saved" : "Payer added");
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not save the payer"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{payer ? `Edit ${payer.payerName}` : "Add payer"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Name" required value={f.payerName} onChange={set("payerName")} inputProps={{ maxLength: 150 }} placeholder="e.g. Medi Assist, Star Health, PMJAY" />
          <TextField select label="Type" value={f.payerType} onChange={set("payerType")}>
            {PAYER_TYPE_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField label="Portal (optional)" value={f.portalName} onChange={set("portalName")} inputProps={{ maxLength: 80 }} placeholder="e.g. IHX, Medi Assist portal" />
          <TextField label="Contact (optional)" value={f.contactInfo} onChange={set("contactInfo")} inputProps={{ maxLength: 200 }} placeholder="Desk phone, email or the person to call" />
          <TextField select label="Rate list" value={f.rateListId} onChange={set("rateListId")}
            helperText={rateLists.length ? "The room rents this payer's insured patients are billed." : "No rate lists yet - add them in Ward & Bed Setup, under Bed tariffs."}>
            <MenuItem value="">General Insurance rates</MenuItem>
            {rateLists.map((l) => <MenuItem key={l.rateListId} value={l.rateListId}>{l.name}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" disabled={busy || !f.payerName.trim()} onClick={save} sx={{ textTransform: "none" }}>{payer ? "Save" : "Add payer"}</Button>
      </DialogActions>
    </Dialog>
  );
}
