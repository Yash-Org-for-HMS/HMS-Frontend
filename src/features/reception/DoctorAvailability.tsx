import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Chip, TextField, Avatar, InputAdornment,
  Button, Divider, Dialog, DialogTitle, DialogContent, IconButton, Tooltip,
  LinearProgress, MenuItem,
} from "@mui/material";
import {
  EventAvailableRounded, BeachAccessRounded, SearchRounded,
  ScheduleRounded, AddRounded, CloseRounded, BoltRounded, EventBusyRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { CardGridSkeleton } from "@/components/TableRowsSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import AppointmentForm from "./AppointmentForm";
import BillingModal from "./BillingModal";
import { useToast } from "@/providers/ToastContext";
import dayjs from "dayjs";
import { apiErrorText } from "@/utils/apiError";
import { formatINR } from "@/utils/format";
import { SEMANTIC, BRAND, NEUTRAL } from "@/styles/accents";

/**
 * Reception's answer to "who can see this patient, and how soon?".
 *
 * The page used to report the opposite: a headcount of appointments and the time
 * of the doctor's NEXT one — when they are busy, not when they are free — which
 * is the wrong half of the question for somebody holding a walk-in. Every card
 * now leads with the earliest free slot, and the list is ordered by it, so the
 * first card is the answer.
 *
 * There is no "off" state: a doctor with no weekly hours for the day is still
 * bookable (the appointment form offers default hours), so only leave means not
 * working. Missing hours is a setup gap and is labelled as one.
 */
const STATUS = {
  AVAILABLE: { label: "Available", color: SEMANTIC.success, icon: <EventAvailableRounded fontSize="small" /> },
  ON_LEAVE: { label: "On leave", color: SEMANTIC.danger, icon: <BeachAccessRounded fontSize="small" /> },
} as const;

/** Where the doctor is in their day, phrased for someone scanning the row. */
const DAY_STATE: Record<string, { label: string; color: string } | undefined> = {
  IN_CLINIC: { label: "In clinic now", color: SEMANTIC.success },
  BEFORE: { label: "Not started yet", color: NEUTRAL.muted },
  FINISHED: { label: "Day finished", color: NEUTRAL.muted },
};

const fmtTime = (hhmm: string) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  if (isNaN(h)) return hhmm;
  return dayjs().hour(h).minute(m || 0).format("h:mm A");
};

interface DoctorRow {
  doctorId: string;
  name: string;
  department: string | null;
  qualification: string | null;
  consultationFee: string | number | null;
  schedule: { startTime: string; endTime: string; slotDurationMinutes: number } | null;
  usingDefaultHours?: boolean;
  onLeave: boolean;
  leaveReason: string | null;
  appointmentCount: number;
  slotsTotal: number;
  slotsBooked: number;
  nextFreeSlot: string | null;
  dayState: "BEFORE" | "IN_CLINIC" | "FINISHED" | "PAST" | "OTHER_DAY";
  status: "AVAILABLE" | "ON_LEAVE";
}

export default function DoctorAvailability() {
  const toast = useToast();
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [search, setSearch] = useState("");
  // Seeded from the URL so the Department Directory can hand a department
  // straight over — "who is free in Cardiology" is one click from finding
  // Cardiology, rather than finding it again here.
  const [params] = useSearchParams();
  const [dept, setDept] = useState(params.get("dept") ?? "");
  // Booking from a doctor's card opens the SAME appointment form used everywhere
  // else (Front Desk, Appointments list) inline here, rather than navigating
  // away — one booking flow regardless of entry point.
  const [bookingDoctorId, setBookingDoctorId] = useState<string | null>(null);
  const [billingDialog, setBillingDialog] = useState({ open: false, apptId: "", patientName: "", apptDate: "" });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["doctor-availability", date],
    queryFn: async () => (await axiosInstance.get("/reception/doctors/availability", { params: { date } })).data.data,
  });

  const summary = data?.summary;
  const isPast: boolean = !!data?.isPast;
  const doctors: DoctorRow[] = useMemo(() => data?.doctors ?? [], [data]);

  const departments = useMemo(
    () => [...new Set(doctors.map((d) => d.department).filter(Boolean))].sort() as string[],
    [doctors],
  );

  // Reception searches by whoever the patient asked for, so name and department
  // are both matched; the server has already ordered by soonest free.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return doctors.filter(
      (d) =>
        (!dept || d.department === dept) &&
        (!q || d.name.toLowerCase().includes(q) || (d.department ?? "").toLowerCase().includes(q)),
    );
  }, [doctors, search, dept]);

  const soonest = shown.find((d) => d.nextFreeSlot && !d.onLeave);

  return (
    <Box sx={{ pb: 5 }}>
      <PageHeader
        title="Doctor Availability"
        subtitle="Who can see a patient, and how soon"
        actions={
          <TextField
            type="date" size="small" label="Date"
            InputLabelProps={{ shrink: true }}
            value={date} onChange={(e) => setDate(e.target.value)}
            sx={{ minWidth: 180 }}
          />
        }
      />

      {/* The headline answer, above the grid, so the common question is answered
          without reading any card at all. */}
      {!isLoading && !isError && !isPast && (
        <Paper
          elevation={0}
          sx={{
            p: 2, mb: 2.5, borderRadius: 3, display: "flex", alignItems: "center", gap: 1.5,
            border: "1px solid", borderColor: soonest ? `${SEMANTIC.success}55` : "divider",
            bgcolor: soonest ? `${SEMANTIC.success}0f` : "action.hover",
          }}
        >
          <BoltRounded sx={{ color: soonest ? SEMANTIC.success : "text.disabled" }} />
          {soonest ? (
            <>
              <Typography variant="body2" sx={{ color: "text.primary" }}>
                Earliest free:{" "}
                <Box component="span" sx={{ fontWeight: 800 }}>{fmtTime(soonest.nextFreeSlot!)}</Box>
                {" with "}
                <Box component="span" sx={{ fontWeight: 800 }}>{soonest.name}</Box>
                {soonest.department ? ` (${soonest.department})` : ""}
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small" variant="contained" startIcon={<AddRounded />}
                onClick={() => setBookingDoctorId(soonest.doctorId)}
                sx={{ textTransform: "none", fontWeight: 700, bgcolor: BRAND.action }}
              >
                Book this
              </Button>
            </>
          ) : (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No free slots left {dayjs(date).isSame(dayjs(), "day") ? "today" : `on ${dayjs(date).format("D MMM")}`}
              {shown.length ? " — every doctor shown is booked out or on leave." : "."}
            </Typography>
          )}
        </Paper>
      )}

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
        <TextField
          size="small" placeholder="Search doctor or department…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 20, color: "text.secondary" }} /></InputAdornment> }}
          sx={{ minWidth: 260 }}
        />
        <TextField
          select size="small" label="Department" value={dept}
          onChange={(e) => setDept(e.target.value)} sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All departments</MenuItem>
          {departments.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
        </TextField>

        <Box sx={{ flex: 1 }} />

        {summary && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            {summary.inClinicNow > 0 && (
              <Chip size="small" icon={<EventAvailableRounded fontSize="small" />} label={`${summary.inClinicNow} in clinic`}
                sx={{ fontWeight: 700, bgcolor: `${SEMANTIC.success}1f`, color: SEMANTIC.success }} />
            )}
            {summary.fullyBooked > 0 && (
              <Chip size="small" icon={<EventBusyRounded fontSize="small" />} label={`${summary.fullyBooked} booked out`}
                sx={{ fontWeight: 700, bgcolor: `${SEMANTIC.warning}1f`, color: SEMANTIC.warning }} />
            )}
            {summary.onLeave > 0 && (
              <Chip size="small" icon={<BeachAccessRounded fontSize="small" />} label={`${summary.onLeave} on leave`}
                sx={{ fontWeight: 700, bgcolor: `${SEMANTIC.danger}1f`, color: SEMANTIC.danger }} />
            )}
            {summary.noHoursSet > 0 && (
              <Tooltip title="These doctors have no weekly schedule for this day, so they are shown on the default hours the booking form uses">
                <Chip size="small" label={`${summary.noHoursSet} on default hours`}
                  sx={{ fontWeight: 700, bgcolor: "action.hover", color: "text.secondary" }} />
              </Tooltip>
            )}
          </Box>
        )}
      </Box>

      {isLoading ? (
        <CardGridSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : doctors.length === 0 ? (
        <Mascot pose="all-caught-up" title="No doctors" subtitle="No doctors are configured for this hospital yet." />
      ) : shown.length === 0 ? (
        <Mascot pose="all-caught-up" title="No match" subtitle="No doctor matches that search." />
      ) : (
        <Grid container spacing={2}>
          {shown.map((doc) => (
            <Grid key={doc.doctorId} size={{ xs: 12, sm: 6, lg: 4 }}>
              <DoctorCard
                doc={doc}
                isPast={isPast}
                onBook={() => setBookingDoctorId(doc.doctorId)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={!!bookingDoctorId} onClose={() => setBookingDoctorId(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Book Appointment
          <IconButton onClick={() => setBookingDoctorId(null)} sx={{ color: "text.secondary" }}><CloseRounded /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {bookingDoctorId && (
            <AppointmentForm
              isEmbedded
              initialDoctorId={bookingDoctorId}
              initialDate={date}
              onSuccess={(apptId, pName, apptDate) => {
                toast.success(`Appointment booked${pName ? ` for ${pName}` : ""}`);
                setBookingDoctorId(null);
                refetch();
                if (apptId) {
                  setBillingDialog({ open: true, apptId, patientName: pName || "Patient", apptDate: apptDate || new Date().toISOString() });
                }
              }}
              onCancel={() => setBookingDoctorId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {billingDialog.open && (
        <BillingModal
          open={billingDialog.open}
          onClose={() => setBillingDialog({ open: false, apptId: "", patientName: "", apptDate: "" })}
          appointmentId={billingDialog.apptId}
          patientName={billingDialog.patientName}
          appointmentDate={billingDialog.apptDate}
        />
      )}
    </Box>
  );
}

function DoctorCard({ doc, isPast, onBook }: { doc: DoctorRow; isPast: boolean; onBook: () => void }) {
  const s = STATUS[doc.status] ?? STATUS.AVAILABLE;
  const day = DAY_STATE[doc.dayState];
  const load = doc.slotsTotal > 0 ? Math.round((doc.slotsBooked / doc.slotsTotal) * 100) : 0;
  // Amber once the day is mostly gone, red when there is nothing left — the two
  // moments a receptionist needs to notice before promising a time.
  const loadColor = doc.nextFreeSlot === null ? SEMANTIC.danger : load >= 75 ? SEMANTIC.warning : SEMANTIC.success;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5, borderRadius: 3, height: "100%", display: "flex", flexDirection: "column", gap: 1.5,
        border: "1px solid", borderColor: "divider", bgcolor: "background.paper",
        transition: "all 0.15s ease",
        opacity: doc.onLeave ? 0.75 : 1,
        "&:hover": doc.onLeave ? undefined : { borderColor: `${BRAND.action}66`, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ bgcolor: s.color, width: 44, height: 44, fontWeight: 700 }}>
          {doc.name?.replace("Dr. ", "").charAt(0) || "D"}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }} noWrap>{doc.name}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
            {doc.department || "—"}{doc.qualification ? ` • ${doc.qualification}` : ""}
          </Typography>
        </Box>
        <Chip icon={s.icon} label={s.label} size="small" sx={{ bgcolor: `${s.color}1f`, color: s.color, fontWeight: 700 }} />
      </Box>

      <Divider sx={{ borderColor: "divider" }} />

      {/* The line the page exists for. */}
      {doc.onLeave ? (
        <Typography variant="body2" sx={{ color: SEMANTIC.danger, fontWeight: 700 }}>
          On leave{doc.leaveReason ? ` — ${doc.leaveReason}` : ""}
        </Typography>
      ) : isPast ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {doc.slotsBooked} of {doc.slotsTotal} slots were booked
        </Typography>
      ) : doc.nextFreeSlot ? (
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: SEMANTIC.success, lineHeight: 1.2 }}>
            Free at {fmtTime(doc.nextFreeSlot)}
          </Typography>
          {day && (
            <Typography variant="caption" sx={{ color: day.color, fontWeight: 600 }}>{day.label}</Typography>
          )}
        </Box>
      ) : (
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: SEMANTIC.warning, lineHeight: 1.2 }}>
            {doc.dayState === "FINISHED" ? "Day finished" : "Fully booked"}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {doc.dayState === "FINISHED" ? "Hours ended for today" : "No free slots left"}
          </Typography>
        </Box>
      )}

      {/* How full the day is — the difference between "can fit one more" and
          "you would be overbooking them". */}
      {!doc.onLeave && doc.slotsTotal > 0 && (
        <Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
              {doc.slotsBooked} of {doc.slotsTotal} slots booked
            </Typography>
            <Typography variant="caption" sx={{ color: loadColor, fontWeight: 700 }}>{load}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate" value={Math.min(load, 100)}
            sx={{ height: 6, borderRadius: 3, bgcolor: "action.hover", "& .MuiLinearProgress-bar": { bgcolor: loadColor, borderRadius: 3 } }}
          />
        </Box>
      )}

      {/* Hours and fee are what you quote when booking, so they are irrelevant on
          a day the doctor is away — and pushing them to the bottom of an
          otherwise empty leave card left a hole where the load bar would be. */}
      {!doc.onLeave && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: "auto" }}>
          <ScheduleRounded sx={{ fontSize: 16, color: "text.secondary" }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {doc.schedule ? (
              <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                {fmtTime(doc.schedule.startTime)} – {fmtTime(doc.schedule.endTime)} · {doc.schedule.slotDurationMinutes}-min
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>No hours scheduled</Typography>
            )}
            {/* Bookable, but on the fallback the appointment form uses rather than
                hours anyone chose for this doctor. */}
            {doc.usingDefaultHours && (
              <Typography variant="caption" sx={{ color: SEMANTIC.warning, fontWeight: 600, display: "block" }}>
                Default hours — no weekly schedule set
              </Typography>
            )}
          </Box>
          {Number(doc.consultationFee) > 0 && (
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, whiteSpace: "nowrap" }}>
              {formatINR(doc.consultationFee, 0)}
            </Typography>
          )}
        </Box>
      )}

      {!doc.onLeave && !isPast && (
        <Button
          fullWidth size="small" variant="outlined" startIcon={<AddRounded />} onClick={onBook}
          sx={{ textTransform: "none", fontWeight: 700, color: BRAND.action, borderColor: `${BRAND.action}55` }}
        >
          {doc.nextFreeSlot ? `Book ${fmtTime(doc.nextFreeSlot)}` : "Book anyway"}
        </Button>
      )}
    </Paper>
  );
}
