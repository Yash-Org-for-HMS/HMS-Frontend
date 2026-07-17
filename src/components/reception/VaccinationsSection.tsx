import { ACCENTS } from "../../styles/accents";
import { getApiErrorMessage, apiErrorText } from "../../utils/apiError";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Chip, Button, Grid,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip, IconButton,
  MenuItem, ToggleButtonGroup, ToggleButton,
} from "@mui/material";
import {
  VaccinesRounded, ChevronLeftRounded, ChevronRightRounded, TodayRounded,
  CheckCircleRounded, BlockRounded, ReplayRounded, EventBusyRounded, AddRounded,
  ReceiptLongRounded, PrintRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { ListSkeleton } from "../TableRowsSkeleton";
import ErrorState from "../ErrorState";
import Mascot from "../Mascot";
import { useToast } from "../../contexts/ToastContext";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import dayjs, { Dayjs } from "dayjs";

const ACCENT = ACCENTS.reception;
const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const STATE_META: Record<string, { label: string; color: string }> = {
  OVERDUE: { label: "Overdue", color: "#ef4444" },
  DUE_SOON: { label: "Due soon", color: "#f59e0b" },
  UPCOMING: { label: "Upcoming", color: "#64748b" },
  DONE: { label: "Done", color: "#10b981" },
  SKIPPED: { label: "Skipped", color: "#94a3b8" },
};

type Row = {
  patientVaccinationId: string; vaccineName: string; vaccineCode: string; doseLabel: string;
  ageLabel: string | null; dueDate: string; administeredDate: string | null;
  batchNumber: string | null; notes: string | null; invoiceId: string | null; invoiceNumber: string | null; state: string;
};

// Prints a formatted immunization certificate (hidden iframe — same pattern as
// the invoice/lab-report prints elsewhere) listing only administered doses.
function printCertificate(opts: { hospitalName: string; patientName: string; patientUhid: string; patientDob: string | null; rows: Row[] }) {
  const doneRows = opts.rows.filter((r) => r.state === "DONE");
  const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map((el) => el.outerHTML).join("");
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }

  const rowsHtml = doneRows.length
    ? doneRows.map((r) => `
        <tr>
          <td>${r.vaccineName}</td>
          <td>${r.doseLabel}</td>
          <td>${r.administeredDate ? dayjs(r.administeredDate).format("DD MMM YYYY") : "—"}</td>
          <td>${r.batchNumber || "—"}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" style="text-align:center;color:#64748b;padding:24px">No administered doses on record</td></tr>`;

  doc.open();
  doc.write(`<!doctype html><html><head><title>Immunization Certificate — ${opts.patientName}</title>${headStyles}
    <style>
      @media print { @page { margin: 1.5cm } }
      body { font-family: Inter, Arial, sans-serif; color: #0f172a; }
      h1 { font-size: 20px; margin-bottom: 2px; }
      .sub { color: #475569; font-size: 13px; margin-bottom: 20px; }
      .info { display: flex; gap: 32px; margin-bottom: 20px; font-size: 14px; }
      .info div span { display: block; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 13px; }
      th { background: #f1f5f9; text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; color: #475569; }
      .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
      .sign { border-top: 1px solid #94a3b8; width: 200px; text-align: center; padding-top: 6px; margin-top: 40px; }
    </style></head>
    <body>
      <h1>${opts.hospitalName}</h1>
      <div class="sub">Immunization Certificate</div>
      <div class="info">
        <div><span>Patient</span>${opts.patientName}</div>
        <div><span>UHID</span>${opts.patientUhid}</div>
        <div><span>Date of birth</span>${opts.patientDob ? dayjs(opts.patientDob).format("DD MMM YYYY") : "—"}</div>
      </div>
      <table>
        <thead><tr><th>Vaccine</th><th>Dose</th><th>Date given</th><th>Batch no.</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="footer">
        <div>Printed on ${dayjs().format("DD MMM YYYY")}</div>
        <div class="sign">Authorized signature</div>
      </div>
    </body></html>`);
  doc.close();
  const win = iframe.contentWindow!;
  const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); };
  win.onafterprint = cleanup;
  setTimeout(() => { win.focus(); win.print(); setTimeout(cleanup, 1000); }, 350);
}

export default function VaccinationsSection({ patientId, patientName, patientUhid, patientDob, readOnly = false }: { patientId: string; patientName: string; patientUhid: string; patientDob: string | null; readOnly?: boolean }) {
  const toast = useToast();
  const { hospital } = useHospitalAuth();
  const qc = useQueryClient();
  // Administering a priced vaccine raises a real invoice — the sibling
  // Billing tab on this same patient page (queryKey ["patient-billing", id])
  // fetches once on mount and has no other reason to know that happened, so
  // it'd show stale totals until a manual refresh without this.
  const invalidateBillingIfCharged = (invoiceId: string | null | undefined) => {
    if (invoiceId) qc.invalidateQueries({ queryKey: ["patient-billing", patientId] });
  };
  const [anchor, setAnchor] = useState<Dayjs>(dayjs().startOf("month"));
  const [actionTarget, setActionTarget] = useState<{ row: Row; kind: "administer" | "skip" } | null>(null);
  const [administeredDate, setAdministeredDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [batchNumber, setBatchNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // "+ Add Vaccine" — assign any catalog vaccine to this patient outside the
  // auto-generated standard schedule (a flu shot, a hospital-specific vaccine,
  // a catch-up dose, etc.), either logged as already given or scheduled ahead.
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"given" | "schedule">("given");
  const [addVaccineId, setAddVaccineId] = useState("");
  const [addDoseLabel, setAddDoseLabel] = useState("");
  const [addDate, setAddDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [addBatch, setAddBatch] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["patient-vaccination-schedule", patientId],
    queryFn: async () => (await axiosInstance.get(`/vaccination/patients/${patientId}/schedule`)).data.data,
  });
  const { data: catalog = [] } = useQuery<{ vaccineId: string; vaccineName: string; vaccineCode: string; price: number | string | null }[]>({
    queryKey: ["vaccine-catalog"],
    queryFn: async () => (await axiosInstance.get("/vaccination/catalog")).data.data,
    enabled: addOpen,
    staleTime: 5 * 60 * 1000,
  });
  // The backend already excludes irrelevant pending childhood doses once the
  // patient is an adult (18+) — nothing to filter client-side.
  const rows: Row[] = data?.rows ?? [];
  const isAdult: boolean = data?.isAdult ?? false;

  // Calendar cells for the visible month, with due-dose markers per day.
  const byDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const key = dayjs(r.dueDate).format("YYYY-MM-DD");
      const list = map.get(key);
      if (list) list.push(r); else map.set(key, [r]);
    }
    return map;
  }, [rows]);

  const monthStart = anchor.startOf("month");
  const gridStart = monthStart.startOf("week");
  const days = Array.from({ length: 42 }, (_, i) => gridStart.add(i, "day"));

  const openAdminister = (row: Row) => {
    setActionTarget({ row, kind: "administer" });
    setAdministeredDate(dayjs().format("YYYY-MM-DD"));
    setBatchNumber("");
    setNotes("");
  };
  const openSkip = (row: Row) => {
    setActionTarget({ row, kind: "skip" });
    setNotes("");
  };

  const submitAction = async () => {
    if (!actionTarget) return;
    setSaving(true);
    try {
      if (actionTarget.kind === "administer") {
        const res = await axiosInstance.put(`/vaccination/records/${actionTarget.row.patientVaccinationId}/administer`, {
          administeredDate, batchNumber: batchNumber || undefined, notes: notes || undefined,
        });
        invalidateBillingIfCharged(res.data?.data?.invoiceId);
        toast.success(`${actionTarget.row.vaccineName} (${actionTarget.row.doseLabel}) marked administered`);
      } else {
        await axiosInstance.put(`/vaccination/records/${actionTarget.row.patientVaccinationId}/skip`, { notes: notes || undefined });
        toast.success(`${actionTarget.row.vaccineName} (${actionTarget.row.doseLabel}) marked skipped`);
      }
      setActionTarget(null);
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const undo = async (row: Row) => {
    try {
      await axiosInstance.put(`/vaccination/records/${row.patientVaccinationId}/undo`, {});
      toast.success(`${row.vaccineName} (${row.doseLabel}) reverted to pending`);
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to undo"));
    }
  };

  const openAddVaccine = () => {
    setAddMode("given");
    setAddVaccineId("");
    setAddDoseLabel("");
    setAddDate(dayjs().format("YYYY-MM-DD"));
    setAddBatch("");
    setAddNotes("");
    setAddOpen(true);
  };

  const submitAddVaccine = async () => {
    if (!addVaccineId) return;
    setAddSaving(true);
    try {
      const res = await axiosInstance.post(`/vaccination/patients/${patientId}/records`, {
        vaccineId: addVaccineId,
        doseLabel: addDoseLabel || undefined,
        ...(addMode === "given" ? { administeredDate: addDate, batchNumber: addBatch || undefined } : { dueDate: addDate }),
        notes: addNotes || undefined,
      });
      invalidateBillingIfCharged(res.data?.data?.invoiceId);
      toast.success(addMode === "given" ? "Vaccine logged as administered" : "Vaccine scheduled");
      setAddOpen(false);
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to add vaccine"));
    } finally {
      setAddSaving(false);
    }
  };

  if (isLoading) return <ListSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const totals = data?.totals ?? { due: 0, overdue: 0, done: 0, upcoming: 0 };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mb: 1.5 }}>
        <Button variant="outlined" size="small" startIcon={<PrintRounded fontSize="small" />}
          onClick={() => printCertificate({ hospitalName: hospital?.name || "Hospital", patientName, patientUhid, patientDob, rows })}
          sx={{ textTransform: "none", color: ACCENT, borderColor: `${ACCENT}66` }}>
          Print Certificate
        </Button>
        {!readOnly && (
          <Button variant="contained" size="small" startIcon={<AddRounded fontSize="small" />} onClick={openAddVaccine}
            sx={{ textTransform: "none", bgcolor: ACCENT, "&:hover": { bgcolor: ACCENTS.receptionDark } }}>
            Add Vaccine
          </Button>
        )}
      </Box>

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Overdue" value={totals.overdue} color={STATE_META.OVERDUE.color} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Due soon" value={totals.due} color={STATE_META.DUE_SOON.color} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Upcoming" value={totals.upcoming} color={STATE_META.UPCOMING.color} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Tile label="Completed" value={totals.done} color={STATE_META.DONE.color} /></Grid>
      </Grid>

      {/* Month calendar with due-dose markers */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 1 }}>
          <VaccinesRounded sx={{ color: ACCENT }} fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>{anchor.format("MMMM YYYY")}</Typography>
          <IconButton size="small" onClick={() => setAnchor(anchor.subtract(1, "month"))}><ChevronLeftRounded /></IconButton>
          <Button size="small" startIcon={<TodayRounded fontSize="small" />} onClick={() => setAnchor(dayjs().startOf("month"))} sx={{ textTransform: "none" }}>Today</Button>
          <IconButton size="small" onClick={() => setAnchor(anchor.add(1, "month"))}><ChevronRightRounded /></IconButton>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <Typography key={d} variant="caption" sx={{ textAlign: "center", color: "text.secondary", fontWeight: 700, py: 0.5 }}>{d}</Typography>
          ))}
          {days.map((d) => {
            const key = d.format("YYYY-MM-DD");
            const doses = byDay.get(key) ?? [];
            const inMonth = d.isSame(monthStart, "month");
            const isToday = d.isSame(dayjs(), "day");
            return (
              <Box key={key} sx={{
                minHeight: 64, borderRadius: 1.5, p: 0.75, border: "1px solid", borderColor: isToday ? ACCENT : "divider",
                bgcolor: inMonth ? "background.paper" : "action.hover", opacity: inMonth ? 1 : 0.5,
              }}>
                <Typography variant="caption" sx={{ fontWeight: isToday ? 800 : 500, color: isToday ? ACCENT : "text.secondary" }}>{d.date()}</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4, mt: 0.4 }}>
                  {doses.slice(0, 4).map((dose) => (
                    <Tooltip key={dose.patientVaccinationId} title={`${dose.vaccineName} — ${dose.doseLabel} (${STATE_META[dose.state]?.label})`}>
                      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: STATE_META[dose.state]?.color || "#94a3b8" }} />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* Dose list */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Immunization schedule</Typography>
          {isAdult && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Standard childhood schedule doesn't apply (patient is an adult) — completed doses on record still show below. Use "+ Add Vaccine" to log or schedule any vaccine.
            </Typography>
          )}
        </Box>
        {rows.length === 0 ? (
          <Mascot pose="all-caught-up" title="No doses to show"
            subtitle={isAdult ? "No vaccination history on record for this patient. Use '+ Add Vaccine' to log one." : "This patient is fully up to date."} />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Vaccine", "Dose", "Age", "Due date", "Status", "Details", ""].map((h) => (
                    <TableCell key={h} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", borderColor: "divider" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => {
                  const meta = STATE_META[r.state] || STATE_META.UPCOMING;
                  return (
                    <TableRow key={r.patientVaccinationId} hover>
                      <TableCell sx={{ borderColor: "divider", fontWeight: 600 }}>{r.vaccineName}</TableCell>
                      <TableCell sx={{ borderColor: "divider" }}>{r.doseLabel}</TableCell>
                      <TableCell sx={{ borderColor: "divider", color: "text.secondary" }}>{r.ageLabel || "—"}</TableCell>
                      <TableCell sx={{ borderColor: "divider" }}>{dayjs(r.dueDate).format("DD MMM YYYY")}</TableCell>
                      <TableCell sx={{ borderColor: "divider" }}>
                        <Chip size="small" label={meta.label} sx={{ bgcolor: `${meta.color}1f`, color: meta.color, fontWeight: 700 }} />
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider", color: "text.secondary", fontSize: "0.8rem" }}>
                        {r.state === "DONE" && (
                          <Box>
                            <Box>Batch: {r.batchNumber || "—"} · {dayjs(r.administeredDate).format("DD MMM YYYY")}</Box>
                            {r.invoiceNumber && (
                              <Chip size="small" icon={<ReceiptLongRounded sx={{ fontSize: "13px !important" }} />} label={`Billed: ${r.invoiceNumber}`}
                                sx={{ mt: 0.5, height: 20, bgcolor: `${ACCENT}1a`, color: ACCENT, fontWeight: 600, "& .MuiChip-label": { px: 1, fontSize: "0.7rem" } }} />
                            )}
                          </Box>
                        )}
                        {r.state === "SKIPPED" && (r.notes || "—")}
                      </TableCell>
                      <TableCell align="right" sx={{ borderColor: "divider" }}>
                        {!readOnly && (r.state === "OVERDUE" || r.state === "DUE_SOON" || r.state === "UPCOMING") && (
                          <>
                            <Tooltip title="Mark administered">
                              <IconButton size="small" onClick={() => openAdminister(r)} sx={{ color: "#10b981" }}><CheckCircleRounded fontSize="small" /></IconButton>
                            </Tooltip>
                            <Tooltip title="Mark skipped / not applicable">
                              <IconButton size="small" onClick={() => openSkip(r)} sx={{ color: "text.secondary" }}><BlockRounded fontSize="small" /></IconButton>
                            </Tooltip>
                          </>
                        )}
                        {!readOnly && (r.state === "DONE" || r.state === "SKIPPED") && (
                          <Tooltip title="Undo">
                            <IconButton size="small" onClick={() => undo(r)} sx={{ color: "text.secondary" }}><ReplayRounded fontSize="small" /></IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Administer / Skip dialog */}
      <Dialog open={!!actionTarget} onClose={() => (saving ? undefined : setActionTarget(null))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {actionTarget?.kind === "administer" ? <CheckCircleRounded sx={{ color: "#10b981" }} /> : <EventBusyRounded sx={{ color: "text.secondary" }} />}
          {actionTarget?.kind === "administer" ? "Mark dose administered" : "Mark dose skipped"}
        </DialogTitle>
        <DialogContent dividers>
          {actionTarget && (
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              {actionTarget.row.vaccineName} — {actionTarget.row.doseLabel}
            </Typography>
          )}
          {actionTarget?.kind === "administer" && (
            <TextField fullWidth type="date" label="Administered date" InputLabelProps={{ shrink: true }} sx={{ mb: 2 }}
              value={administeredDate} onChange={(e) => setAdministeredDate(e.target.value)} inputProps={{ max: dayjs().format("YYYY-MM-DD") }} />
          )}
          {actionTarget?.kind === "administer" && (
            <TextField fullWidth label="Batch number (optional)" sx={{ mb: 2 }} value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
          )}
          <TextField fullWidth multiline minRows={2} label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActionTarget(null)} color="inherit" disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={submitAction} disabled={saving} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENTS.receptionDark } }}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Add Vaccine dialog — assign any catalog vaccine outside the standard schedule */}
      <Dialog open={addOpen} onClose={() => (addSaving ? undefined : setAddOpen(false))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <VaccinesRounded sx={{ color: ACCENT }} /> Add vaccine
        </DialogTitle>
        <DialogContent dividers>
          <TextField select fullWidth label="Vaccine" value={addVaccineId} onChange={(e) => setAddVaccineId(e.target.value)} sx={{ mb: 2 }}>
            {catalog.length === 0 ? (
              <MenuItem value="" disabled>Loading…</MenuItem>
            ) : (
              catalog.map((v) => <MenuItem key={v.vaccineId} value={v.vaccineId}>{v.vaccineName}{v.price ? ` — ${inr(v.price)}` : ""}</MenuItem>)
            )}
          </TextField>
          <TextField fullWidth label="Dose label (optional)" placeholder="e.g. Booster, Annual dose" sx={{ mb: 2 }}
            value={addDoseLabel} onChange={(e) => setAddDoseLabel(e.target.value)} />

          <ToggleButtonGroup exclusive fullWidth size="small" value={addMode} onChange={(_, v) => v && setAddMode(v)} sx={{ mb: 2 }}>
            <ToggleButton value="given">Given today</ToggleButton>
            <ToggleButton value="schedule">Schedule for later</ToggleButton>
          </ToggleButtonGroup>

          <TextField fullWidth type="date" label={addMode === "given" ? "Date given" : "Due date"} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }}
            value={addDate} onChange={(e) => setAddDate(e.target.value)}
            inputProps={addMode === "given" ? { max: dayjs().format("YYYY-MM-DD") } : { min: dayjs().format("YYYY-MM-DD") }} />

          {addMode === "given" && (
            <TextField fullWidth label="Batch number (optional)" sx={{ mb: 2 }} value={addBatch} onChange={(e) => setAddBatch(e.target.value)} />
          )}
          <TextField fullWidth multiline minRows={2} label="Notes (optional)" value={addNotes} onChange={(e) => setAddNotes(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddOpen(false)} color="inherit" disabled={addSaving}>Cancel</Button>
          <Button variant="contained" onClick={submitAddVaccine} disabled={addSaving || !addVaccineId} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: ACCENTS.receptionDark } }}>
            {addMode === "given" ? "Log vaccine" : "Schedule vaccine"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
    </Paper>
  );
}
