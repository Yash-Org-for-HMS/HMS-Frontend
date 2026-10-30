import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment,
  MenuItem, Paper, Stack, Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import { AddRounded, EditRounded, ListAltRounded, PaymentsRounded, SearchRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { useToast } from "@/providers/ToastContext";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { formatINR } from "@/utils/format";
import { RateListsEditor } from "@/features/hospitalAuth/settings/BedTariffsDialog";
import { PAYER_TYPE_OPTIONS } from "./claimMeta";

// The hospital's insurers, TPAs and government schemes (backend claims payers),
// and the rate list each one bills by. The claim form picks from the active
// ones. The Rate lists tab shows each list with its payers and room rents (read
// from Bed tariffs, where the rents are set); lists and their payers can be
// changed here with the same editor Bed tariffs uses.

interface RateList { rateListId: string; name: string }
interface TariffRow { roomClassId: string; payerType: string; rateListId?: string | null; roomRent: string | number; nursingCharge: string | number }
interface TariffData {
  rateLists: { rateListId: string; name: string; payerIds: string[] }[];
  payers: { payerId: string; payerName: string; payerType: string }[];
  roomClasses: { roomClassId: string; name: string; isActive: boolean }[];
  current: TariffRow[];
}
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
  const [tab, setTab] = useState(0);

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
    qc.invalidateQueries({ queryKey: ["claim-rate-lists"] });
    qc.invalidateQueries({ queryKey: ["bed-tariffs"] });
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
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab label={`Payers (${payers.filter((p) => p.isActive).length})`} sx={{ textTransform: "none" }} />
        <Tab label={`Rate lists (${rateLists.length})`} sx={{ textTransform: "none" }} />
      </Tabs>
      {tab === 1 ? <RateListsTab payers={payers} onChanged={changed} /> : (<>
      <Alert severity="info" sx={{ mb: 2 }}>
        A payer on a rate list bills its insured patients that list's room rents; a payer on none bills the general Insurance rents.
        See each list and its rents on the Rate lists tab.
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
      </>)}

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

/** Each rate list: the payers on it and the room rent it agreed, room class by room class. */
function RateListsTab({ payers, onChanged }: { payers: Payer[]; onChanged: () => void }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["bed-tariffs", ""],
    queryFn: async () => (await axiosInstance.get("/ipd/bed-tariffs")).data.data as TariffData,
  });
  if (isLoading) return <DetailSkeleton />;
  // Rate lists price room rent, so they live with the IPD module.
  if (isError || !data) return <Alert severity="warning">{apiErrorText(error)} Rate lists price room rent, which needs the IPD module.</Alert>;

  const payerOf = new Map(payers.map((p) => [p.payerId, p]));
  const classes = data.roomClasses.filter((c) => c.isActive);
  const rent = (roomClassId: string, rateListId: string | null) => data.current.find((r) => r.roomClassId === roomClassId && (rateListId ? r.rateListId === rateListId : r.payerType === "INSURANCE" && !r.rateListId));

  return (
    <Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 2, alignItems: { md: "center" } }}>
        <Typography variant="body2" sx={{ color: "text.secondary", flex: 1 }}>
          A rate list is what an insurer or TPA agreed with the hospital: room rents (below) and service prices (in the Schedule of Charges, with the list picked). What a list does not price bills the usual rate.
        </Typography>
        <Button variant="outlined" startIcon={<ListAltRounded />} onClick={() => setEditing((v) => !v)} sx={{ textTransform: "none" }}>
          {editing ? "Close" : "Change lists and payers"}
        </Button>
        <Button variant="outlined" startIcon={<PaymentsRounded />} onClick={() => navigate("/hospital/facility-setup?tariffs=1")} sx={{ textTransform: "none" }}>Change rents</Button>
      </Stack>
      {editing && (
        <Box sx={{ mb: 2 }}>
          <RateListsEditor rateLists={data.rateLists} payers={data.payers} onSaved={() => { setEditing(false); refetch(); onChanged(); }} />
        </Box>
      )}
      {data.rateLists.length === 0 ? (
        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Mascot pose="nothing-here-yet" title="No rate lists yet" subtitle="Every insured stay bills the general Insurance rent. Use Change lists and payers to add one." />
        </Paper>
      ) : (
        <Stack spacing={2}>
          {data.rateLists.map((l) => {
            const priced = classes.filter((c) => rent(c.roomClassId, l.rateListId)).length;
            return (
              <Paper key={l.rateListId} elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{l.name}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", flex: 1 }}>{priced} of {classes.length} room classes priced</Typography>
                    <Button size="small" onClick={() => navigate(`/hospital/soc?list=${l.rateListId}`)} sx={{ textTransform: "none" }}>Service prices</Button>
                  </Stack>
                  <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                    {l.payerIds.length === 0
                      ? <Typography variant="body2" sx={{ color: "text.secondary" }}>No payers on this list yet - nobody is billed by it.</Typography>
                      : l.payerIds.map((id) => {
                        const p = payerOf.get(id);
                        return <Chip key={id} size="small" label={p ? `${p.payerName}${p.isActive ? "" : " (switched off)"}` : id} sx={{ opacity: p?.isActive === false ? 0.6 : 1 }} />;
                      })}
                  </Stack>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>{["Room class", "Room rent / day", "Nursing / day", "General Insurance rent"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow>
                    </TableHead>
                    <TableBody>
                      {classes.map((c) => {
                        const own = rent(c.roomClassId, l.rateListId);
                        const general = rent(c.roomClassId, null);
                        return (
                          <TableRow key={c.roomClassId}>
                            <TableCell sx={{ borderColor: "divider", fontWeight: 600 }}>{c.name}</TableCell>
                            <TableCell sx={{ borderColor: "divider", fontWeight: own ? 700 : 400, color: own ? "text.primary" : "text.disabled" }}>
                              {own ? formatINR(own.roomRent) : "Not on this list"}
                            </TableCell>
                            <TableCell sx={{ borderColor: "divider", color: own ? "text.primary" : "text.disabled" }}>{own ? formatINR(own.nursingCharge) : "-"}</TableCell>
                            <TableCell sx={{ borderColor: "divider", color: "text.secondary" }}>{general ? formatINR(general.roomRent) : "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
