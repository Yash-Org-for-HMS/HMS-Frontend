import { useState } from "react";
import { SEMANTIC, NEUTRAL, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Chip, Menu, MenuItem, Button, Stack, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Switch,
  Autocomplete, CircularProgress,
} from "@mui/material";
import {
  MedicalServicesRounded, AddRounded, EventRounded, WarningAmberRounded,
  ChevronLeftRounded, ChevronRightRounded, MoreVertRounded, PersonRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";

/**
 * Tomorrow's operating list.
 *
 * One column per theatre, cases in running order — the shape of the sheet that
 * gets printed and stuck on the theatre wall, because that is what this screen
 * has to replace to be used at all.
 *
 * Emergencies sit in their own column rather than being threaded into a
 * numbered order they arrived outside of, and unscheduled cases (booked with no
 * theatre yet) get a column too so they cannot be silently lost.
 */

type OtCase = {
  surgeryId: string;
  patientName: string;
  uhid: string;
  admissionId: string | null;
  procedureName: string;
  surgeryType: string;
  surgeonId: string | null;
  surgeonName: string | null;
  operatingTheatreId: string | null;
  theatreName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  anaesthesiaType: string | null;
  isEmergency: boolean;
  listPosition: number | null;
  status: string;
  cancellationReason: string | null;
  price: string | number | null;
  notes: string | null;
};
type TheatreList = {
  operatingTheatreId: string;
  theatreName: string;
  theatreType: string;
  status: string;
  cases: OtCase[];
};

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: BRAND.action,
  IN_PROGRESS: SEMANTIC.warning,
  COMPLETED: SEMANTIC.success,
  CANCELLED: NEUTRAL.muted,
};
const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled", IN_PROGRESS: "In theatre", COMPLETED: "Done", CANCELLED: "Cancelled",
};
const ANAESTHESIA = ["GENERAL", "SPINAL", "EPIDURAL", "REGIONAL", "LOCAL", "SEDATION", "BLOCK"];
const ANAESTHESIA_LABEL: Record<string, string> = {
  GENERAL: "General", SPINAL: "Spinal", EPIDURAL: "Epidural", REGIONAL: "Regional",
  LOCAL: "Local", SEDATION: "Sedation", BLOCK: "Block",
};
const CANCEL_REASONS: { value: string; label: string }[] = [
  { value: "PATIENT_UNFIT", label: "Patient unfit" },
  { value: "PATIENT_NOT_ARRIVED", label: "Patient did not arrive" },
  { value: "CONSENT_WITHDRAWN", label: "Consent withdrawn" },
  { value: "LIST_OVERRAN", label: "List overran" },
  { value: "EQUIPMENT_UNAVAILABLE", label: "Equipment unavailable" },
  { value: "SURGEON_UNAVAILABLE", label: "Surgeon unavailable" },
  { value: "THEATRE_UNAVAILABLE", label: "Theatre unavailable" },
  { value: "OTHER", label: "Other" },
];

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const clock = (s: string | null) =>
  s ? new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
/** "09:00 – 11:00", or the date alone for a case recorded without times. */
const caseWindow = (c: OtCase) =>
  c.scheduledStart ? `${clock(c.scheduledStart)} – ${clock(c.scheduledEnd)}` : "No time set";

const Tile = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
    <Typography variant="h5" sx={{ fontWeight: 800, color }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
  </Paper>
);

export default function OtSchedule({ readOnly = false }: { readOnly?: boolean } = {}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => isoDay(new Date()));
  const [booking, setBooking] = useState<{ theatreId: string | null } | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement | null; row: OtCase | null }>({ anchor: null, row: null });
  const [cancelling, setCancelling] = useState<OtCase | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ot-day-list", date],
    queryFn: async () => (await axiosInstance.get(`/ipd/ot/list?date=${date}`)).data.data,
  });

  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: string }) =>
      axiosInstance.put(`/ipd/ot/cases/${v.id}`, { status: v.status }),
    onSuccess: () => { toast.success("Case updated"); qc.invalidateQueries({ queryKey: ["ot-day-list"] }); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not update the case")),
  });

  const shiftDay = (days: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + days);
    setDate(isoDay(d));
  };

  const lists: TheatreList[] = data?.lists ?? [];
  const emergencies: OtCase[] = data?.emergencies ?? [];
  const unassigned: OtCase[] = data?.unassigned ?? [];
  const s = data?.summary ?? { total: 0, scheduled: 0, inProgress: 0, completed: 0, cancelled: 0, emergencies: 0 };

  const CaseRow = ({ c }: { c: OtCase }) => (
    <Box
      sx={{
        p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider",
        bgcolor: c.status === "CANCELLED" ? "action.hover" : "background.paper",
        opacity: c.status === "CANCELLED" ? 0.6 : 1,
        display: "flex", gap: 1, alignItems: "flex-start",
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          {c.listPosition && !c.isEmergency && (
            <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>#{c.listPosition}</Typography>
          )}
          <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }} noWrap>
            {caseWindow(c)}
          </Typography>
          <Chip
            size="small" label={STATUS_LABEL[c.status] ?? c.status}
            sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, bgcolor: `${STATUS_COLOR[c.status]}1a`, color: STATUS_COLOR[c.status] }}
          />
          {c.isEmergency && (
            <Chip size="small" icon={<WarningAmberRounded sx={{ fontSize: 12 }} />} label="Emergency"
              sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, bgcolor: `${SEMANTIC.danger}1a`, color: SEMANTIC.danger }} />
          )}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }} noWrap>{c.procedureName}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.3 }} noWrap>
          <PersonRounded sx={{ fontSize: 12 }} /> {c.patientName} · {c.uhid}
          {c.admissionId ? "" : " · day case"}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }} noWrap>
          {c.surgeonName || "No surgeon named"}
          {c.anaesthesiaType ? ` · ${ANAESTHESIA_LABEL[c.anaesthesiaType] ?? c.anaesthesiaType}` : ""}
        </Typography>
        {c.status === "CANCELLED" && c.cancellationReason && (
          <Typography variant="caption" sx={{ color: SEMANTIC.danger, display: "block" }} noWrap>
            {c.cancellationReason.replace(/_/g, " ").toLowerCase()}
          </Typography>
        )}
      </Box>
      {!readOnly && c.status !== "CANCELLED" && (
        <Box
          component="button"
          onClick={(e: React.MouseEvent<HTMLElement>) => setMenu({ anchor: e.currentTarget, row: c })}
          sx={{ border: "none", bgcolor: "transparent", cursor: "pointer", p: 0.5, color: "text.secondary", lineHeight: 0 }}
          aria-label={`Actions for ${c.procedureName}`}
        >
          <MoreVertRounded fontSize="small" />
        </Box>
      )}
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="Operating list"
        subtitle="What each theatre is doing, in running order"
        actions={!readOnly ? (
          <Button variant="contained" startIcon={<AddRounded />} sx={{ textTransform: "none", fontWeight: 700 }}
            onClick={() => setBooking({ theatreId: null })}>
            Book a case
          </Button>
        ) : undefined}
      />

      {/* The day being looked at. A list is always about one day. */}
      <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Button size="small" onClick={() => shiftDay(-1)} sx={{ minWidth: 36, textTransform: "none" }} aria-label="Previous day"><ChevronLeftRounded /></Button>
        <TextField type="date" size="small" value={date} onChange={(e) => setDate(e.target.value)} sx={{ width: 170 }} />
        <Button size="small" onClick={() => shiftDay(1)} sx={{ minWidth: 36, textTransform: "none" }} aria-label="Next day"><ChevronRightRounded /></Button>
        <Button size="small" onClick={() => setDate(isoDay(new Date()))} sx={{ textTransform: "none" }} startIcon={<EventRounded />}>Today</Button>
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {new Date(date + "T12:00:00").toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </Typography>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Cases" value={s.total} color={BRAND.action} /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Scheduled" value={s.scheduled} color={STATUS_COLOR.SCHEDULED} /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><Tile label="In theatre" value={s.inProgress} color={STATUS_COLOR.IN_PROGRESS} /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Done" value={s.completed} color={STATUS_COLOR.COMPLETED} /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><Tile label="Cancelled" value={s.cancelled} color={STATUS_COLOR.CANCELLED} /></Grid>
      </Grid>

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : lists.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, borderRadius: 3, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
          <Mascot
            pose="nothing-here-yet"
            title="No theatres yet"
            subtitle="A list needs somewhere to run. A hospital admin can add theatres under Operating Theatres."
            size={130}
          />
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {lists.map((l) => (
            <Grid key={l.operatingTheatreId} size={{ xs: 12, md: 6, lg: 4 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <MedicalServicesRounded sx={{ color: BRAND.action, fontSize: 20 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>{l.theatreName}</Typography>
                  <Chip size="small" label={`${l.cases.length} case${l.cases.length === 1 ? "" : "s"}`}
                    sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700 }} />
                </Box>
                <Stack spacing={1}>
                  {l.cases.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.secondary", py: 2, textAlign: "center" }}>
                      Nothing booked
                    </Typography>
                  ) : l.cases.map((c) => <CaseRow key={c.surgeryId} c={c} />)}
                </Stack>
                {!readOnly && (
                  <Button fullWidth size="small" startIcon={<AddRounded />} sx={{ mt: 1.5, textTransform: "none" }}
                    onClick={() => setBooking({ theatreId: l.operatingTheatreId })}>
                    Add to this list
                  </Button>
                )}
              </Paper>
            </Grid>
          ))}

          {/* Out-of-order work, kept out of the numbered lists but never hidden. */}
          {(emergencies.length > 0 || unassigned.length > 0) && (
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: SEMANTIC.warning, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <WarningAmberRounded sx={{ color: SEMANTIC.warning, fontSize: 20 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Out of order</Typography>
                </Box>
                <Stack spacing={1}>
                  {emergencies.map((c) => <CaseRow key={c.surgeryId} c={c} />)}
                  {emergencies.length > 0 && unassigned.length > 0 && <Divider />}
                  {unassigned.length > 0 && (
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                      Booked with no theatre yet
                    </Typography>
                  )}
                  {unassigned.map((c) => <CaseRow key={c.surgeryId} c={c} />)}
                </Stack>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={() => setMenu({ anchor: null, row: null })}>
        {menu.row?.status === "SCHEDULED" && (
          <MenuItem onClick={() => { setStatus.mutate({ id: menu.row!.surgeryId, status: "IN_PROGRESS" }); setMenu({ anchor: null, row: null }); }}>
            Mark wheeled in
          </MenuItem>
        )}
        {menu.row?.status === "IN_PROGRESS" && (
          <MenuItem onClick={() => { setStatus.mutate({ id: menu.row!.surgeryId, status: "COMPLETED" }); setMenu({ anchor: null, row: null }); }}>
            Mark finished
          </MenuItem>
        )}
        <MenuItem onClick={() => { setBooking({ theatreId: menu.row?.operatingTheatreId ?? null }); }} disabled>
          {/* Editing a booked case is the reschedule dialog; kept visible so the
              action is discoverable even before it is reachable from here. */}
          Reschedule — open the case
        </MenuItem>
        <MenuItem onClick={() => { setCancelling(menu.row); setMenu({ anchor: null, row: null }); }} sx={{ color: SEMANTIC.danger }}>
          Cancel this case
        </MenuItem>
      </Menu>

      {booking && (
        <BookCaseDialog
          date={date}
          theatreId={booking.theatreId}
          onClose={() => setBooking(null)}
          onDone={() => { setBooking(null); qc.invalidateQueries({ queryKey: ["ot-day-list"] }); }}
        />
      )}
      {cancelling && (
        <CancelCaseDialog
          row={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => { setCancelling(null); qc.invalidateQueries({ queryKey: ["ot-day-list"] }); }}
        />
      )}
    </Box>
  );
}

/**
 * Booking a case.
 *
 * The patient can be an inpatient (pick their admission) or a day case (pick
 * the patient, no admission) — day-care surgery is a real thing that the old
 * admission-only model could not represent at all.
 */
function BookCaseDialog({ date, theatreId, onClose, onDone }: {
  date: string; theatreId: string | null; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [dayCase, setDayCase] = useState(false);
  const [admissionId, setAdmissionId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [form, setForm] = useState({
    procedureName: "", surgeryType: "MAJOR", surgeonId: "", anaesthesiaType: "",
    operatingTheatreId: theatreId ?? "", startTime: "09:00", endTime: "10:00",
    isEmergency: false, price: "", notes: "",
  });

  const { data: theatres } = useQuery({
    queryKey: ["ot-theatres-pick"],
    queryFn: async () => (await axiosInstance.get("/ipd/theatres")).data.data,
  });
  const { data: admissions } = useQuery({
    queryKey: ["ot-admissions-pick"],
    queryFn: async () => (await axiosInstance.get("/ipd/admissions", { params: { status: "ADMITTED", limit: 200 } })).data,
    enabled: !dayCase,
  });
  const { data: dropdowns } = useQuery({
    queryKey: ["appointment-dropdowns"],
    queryFn: async () => (await axiosInstance.get("/reception/appointments/dropdowns")).data.data,
  });
  const { data: patients, isFetching: searchingPatients } = useQuery({
    queryKey: ["ot-patient-search", patientQuery],
    queryFn: async () => (await axiosInstance.get("/reception/patients", { params: { search: patientQuery, limit: 20 } })).data.data,
    enabled: dayCase && patientQuery.trim().length >= 2,
  });

  const book = useMutation({
    mutationFn: async () => {
      const start = form.startTime ? new Date(`${date}T${form.startTime}:00`).toISOString() : undefined;
      const end = form.endTime ? new Date(`${date}T${form.endTime}:00`).toISOString() : undefined;
      return axiosInstance.post("/ipd/ot/cases", {
        ...(dayCase ? { patientId } : { admissionId }),
        procedureName: form.procedureName.trim(),
        surgeryType: form.surgeryType,
        surgeonId: form.surgeonId || undefined,
        anaesthesiaType: form.anaesthesiaType || undefined,
        operatingTheatreId: form.operatingTheatreId || undefined,
        scheduledStart: form.operatingTheatreId ? start : undefined,
        scheduledEnd: form.operatingTheatreId ? end : undefined,
        isEmergency: form.isEmergency,
        price: form.price ? Number(form.price) : undefined,
        notes: form.notes.trim() || undefined,
      });
    },
    onSuccess: () => { toast.success("Case booked"); onDone(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not book the case")),
  });

  const theatreRows = (theatres?.theatres ?? []) as { operatingTheatreId: string; theatreName: string }[];
  // The endpoint returns { success, data: [...] }, so the rows are one level
  // in from the axios body.
  const admissionRows = (admissions?.data ?? []) as Record<string, unknown>[];
  const doctors = (dropdowns?.doctors ?? []) as { doctorId: string; user?: { firstName?: string; lastName?: string } }[];
  const canSave = form.procedureName.trim() && (dayCase ? patientId : admissionId);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Book a case</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <FormControlLabel
            control={<Switch checked={dayCase} onChange={(e) => { setDayCase(e.target.checked); setAdmissionId(""); setPatientId(""); }} />}
            label={dayCase ? "Day case — no admission" : "In-patient — pick the admission"}
          />

          {dayCase ? (
            <Autocomplete
              options={(patients ?? []) as Record<string, string>[]}
              getOptionLabel={(o) => `${o.firstName || ""} ${o.lastName || ""} · ${o.uhidNumber || ""}`.trim()}
              onInputChange={(_, v) => setPatientQuery(v)}
              onChange={(_, v) => setPatientId(v?.patientId ?? "")}
              loading={searchingPatients}
              noOptionsText={patientQuery.trim().length < 2 ? "Type at least two letters" : "No patient found"}
              renderInput={(p) => (
                <TextField {...p} label="Patient" required
                  helperText="Search by name or UHID"
                  InputProps={{ ...p.InputProps, endAdornment: (<>{searchingPatients ? <CircularProgress size={16} /> : null}{p.InputProps.endAdornment}</>) }} />
              )}
            />
          ) : (
            <TextField select label="Admission" required fullWidth value={admissionId} onChange={(e) => setAdmissionId(e.target.value)}
              helperText={admissionRows.length ? "Currently admitted patients" : "No admitted patients"}>
              {admissionRows.map((a) => (
                <MenuItem key={String(a.admissionId)} value={String(a.admissionId)}>
                  {String(a.patientName ?? "Patient")} · {String(a.uhid ?? "")} · {String(a.admissionNumber ?? "")}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField label="Procedure" required fullWidth value={form.procedureName}
            onChange={(e) => setForm({ ...form, procedureName: e.target.value })} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label="Type" fullWidth value={form.surgeryType} onChange={(e) => setForm({ ...form, surgeryType: e.target.value })}>
              <MenuItem value="MAJOR">Major</MenuItem>
              <MenuItem value="MINOR">Minor</MenuItem>
            </TextField>
            <TextField select label="Anaesthesia" fullWidth value={form.anaesthesiaType} onChange={(e) => setForm({ ...form, anaesthesiaType: e.target.value })}>
              <MenuItem value=""><em>Not decided</em></MenuItem>
              {ANAESTHESIA.map((a) => <MenuItem key={a} value={a}>{ANAESTHESIA_LABEL[a]}</MenuItem>)}
            </TextField>
          </Stack>

          <TextField select label="Surgeon" fullWidth value={form.surgeonId} onChange={(e) => setForm({ ...form, surgeonId: e.target.value })}
            helperText="Checked against their other cases, their OPD list and their leave">
            <MenuItem value=""><em>Not decided</em></MenuItem>
            {/* The name lives on the nested user, not on the doctor row —
                reading d.name gives every surgeon the label "Doctor". */}
            {doctors.map((d) => (
              <MenuItem key={d.doctorId} value={d.doctorId}>
                Dr. {d.user?.firstName || "Unknown"} {d.user?.lastName || ""}
              </MenuItem>
            ))}
          </TextField>

          <TextField select label="Theatre" fullWidth value={form.operatingTheatreId}
            onChange={(e) => setForm({ ...form, operatingTheatreId: e.target.value })}
            helperText="Leave blank to book the case without a slot yet">
            <MenuItem value=""><em>No theatre yet</em></MenuItem>
            {theatreRows.map((t) => <MenuItem key={t.operatingTheatreId} value={t.operatingTheatreId}>{t.theatreName}</MenuItem>)}
          </TextField>

          {form.operatingTheatreId && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField type="time" label="Planned start" fullWidth InputLabelProps={{ shrink: true }}
                value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              <TextField type="time" label="Planned end" fullWidth InputLabelProps={{ shrink: true }}
                value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </Stack>
          )}

          <FormControlLabel
            control={<Switch checked={form.isEmergency} onChange={(e) => setForm({ ...form, isEmergency: e.target.checked })} />}
            label="Emergency — added out of order, and may already have happened"
          />

          <TextField label="Price" fullWidth value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
            helperText="Leave blank to price it from the schedule of charges later" />
          <TextField label="Notes" fullWidth multiline minRows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" sx={{ textTransform: "none" }} disabled={!canSave || book.isPending} onClick={() => book.mutate()}>
          {book.isPending ? "Booking…" : "Book the case"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Cancelling asks why, because the reason is the whole cancellation report. */
function CancelCaseDialog({ row, onClose, onDone }: { row: OtCase; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");

  const go = useMutation({
    mutationFn: async () => axiosInstance.post(`/ipd/ot/cases/${row.surgeryId}/cancel`, { reason, detail: detail.trim() || undefined }),
    onSuccess: () => { toast.success("Case cancelled"); onDone(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not cancel the case")),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Cancel this case</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {row.procedureName} · {row.patientName} · {caseWindow(row)}
        </Typography>
        <Stack spacing={2}>
          <TextField select label="Why" required fullWidth value={reason} onChange={(e) => setReason(e.target.value)}
            helperText="A cancellation with no reason cannot be reported on">
            {CANCEL_REASONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
          <TextField label="Anything to add (optional)" fullWidth value={detail} onChange={(e) => setDetail(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Keep it</Button>
        <Button variant="contained" color="error" sx={{ textTransform: "none" }}
          disabled={!reason || go.isPending} onClick={() => go.mutate()}>
          {go.isPending ? "Cancelling…" : "Cancel the case"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
